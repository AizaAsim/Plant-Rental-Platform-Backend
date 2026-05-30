import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { validate } from "class-validator";
import { instanceToPlain, plainToInstance } from "class-transformer";
import type { PlantImage } from "@prisma/client";
import {
  Prisma,
  MaintenanceLevel,
  SunlightRequirement,
  WaterFrequency,
  FeatureType,
  OrderType,
  ReviewableType,
  InteractionType,
  RentalStatus,
} from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";
import { MediaService } from "../media/media.service";
import { UpdatePlantDto, UpdateStockDto } from "./dto/plant-body.dto";

type UploadFileMeta = { buffer: Buffer; mimetype: string; size: number };

@Injectable()
export class PlantsService {
  constructor(
    private prisma: PrismaService,
    private media: MediaService
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async ensureUniqueSlug(baseSlug: string, nurseryId: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.plant.findFirst({
        where: {
          slug,
          nurseryId,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (!existing) return slug;
      slug = `${baseSlug}-${counter++}`;
    }
  }

  // ─── GET /api/v1/plants ───────────────────────────────────────────────────

  async findAll(filterDto: any) {
    const {
      page = 1,
      limit = 20,
      category_id,
      category_slug,
      nursery_id,
      nurseryId: nurseryIdCamel,
      maintenance_level,
      sunlight_requirement,
      water_frequency,
      is_indoor,
      is_pet_friendly,
      available_for,
      price_min,
      price_max,
      latitude,
      longitude,
      radius_km,
      pincode,
      tags,
      search,
      sort_by = "newest",
    } = filterDto;

    const where: Prisma.PlantWhereInput = {
      isActive: true,
      nursery: { isActive: true, isVerified: true },
      stockQuantity: { gt: 0 },
      ...(category_id && { categoryId: category_id }),
      ...(category_slug && { category: { slug: category_slug } }),
      ...(nursery_id || nurseryIdCamel
        ? { nurseryId: String(nursery_id || nurseryIdCamel) }
        : {}),
      ...(maintenance_level && { maintenanceLevel: maintenance_level as MaintenanceLevel }),
      ...(sunlight_requirement && { sunlightRequirement: sunlight_requirement as SunlightRequirement }),
      ...(water_frequency && { waterFrequency: water_frequency as WaterFrequency }),
      ...(is_indoor !== undefined && { isIndoor: is_indoor === true || is_indoor === "true" }),
      ...(is_pet_friendly !== undefined && { isPetFriendly: is_pet_friendly === true || is_pet_friendly === "true" }),
      ...(available_for === "RENT" && { isAvailableForRent: true }),
      ...(available_for === "BUY" && { isAvailableForSale: true }),
      ...(price_min && {
        OR: [
          { rentPriceMonthly: { gte: new Decimal(price_min) } },
          { buyPrice: { gte: new Decimal(price_min) } },
        ],
      }),
      ...(price_max && {
        OR: [
          { rentPriceMonthly: { lte: new Decimal(price_max) } },
          { buyPrice: { lte: new Decimal(price_max) } },
        ],
      }),
      ...(pincode && {
        nursery: {
          OR: [
            { pincode },
            { serviceAreas: { some: { pincode } } },
          ],
        },
      }),
      ...(tags && Array.isArray(tags) && tags.length > 0 && {
        tags: { some: { tag: { name: { in: tags } } } },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { scientificName: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const orderByMap: Record<string, Prisma.PlantOrderByWithRelationInput> = {
      price_asc:  { buyPrice: "asc" },
      price_desc: { buyPrice: "desc" },
      rating:     { ratingAvg: "desc" },
      popularity: { totalRentals: "desc" },
      newest:     { createdAt: "desc" },
    };
    const orderBy = orderByMap[sort_by] ?? { createdAt: "desc" };

    const skip = (Number(page) - 1) * Number(limit);

    const [plants, total] = await Promise.all([
      this.prisma.plant.findMany({
        where,
        orderBy,
        skip,
        take: Number(limit),
        include: {
          nursery: {
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              ratingAvg: true,
              logoUrl: true,
              latitude: true,
              longitude: true,
            },
          },
          images: { where: { isPrimary: true }, take: 1 },
          category: true,
        },
      }),
      this.prisma.plant.count({ where }),
    ]);

    const plantsWithDistance = plants
      .map((plant) => {
        const data: any = { ...plant };
        if (latitude && longitude && plant.nursery.latitude && plant.nursery.longitude) {
          const distance = this.calculateDistance(
            Number(latitude), Number(longitude),
            Number(plant.nursery.latitude), Number(plant.nursery.longitude)
          );
          data.distance = distance;
          if (radius_km && distance > Number(radius_km)) return null;
        }
        return data;
      })
      .filter(Boolean);

    return {
      items: plantsWithDistance,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // ─── GET /api/v1/plants/:plant_id ─────────────────────────────────────────

  async findById(plantId: string) {
    const plant = await this.prisma.plant.findFirst({
      where: { id: plantId, isActive: true, nursery: { isActive: true } },
      include: {
        nursery: { include: { workingHours: true, serviceAreas: true } },
        images: { orderBy: { displayOrder: "asc" } },
        category: true,
        // FIX: relation is `tags` (PlantTagMapping[]), nested relation to PlantTag is `tag`
        tags: { include: { tag: true } },
        _count: { select: { wishlists: true } },
      },
    });

    if (!plant) throw new NotFoundException("Plant not found");

    const relatedPlants = await this.prisma.plant.findMany({
      where: {
        categoryId: plant.categoryId,
        id: { not: plantId },
        isActive: true,
        stockQuantity: { gt: 0 },
      },
      take: 6,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        nursery: { select: { name: true } },
      },
    });

    return { ...plant, relatedPlants };
  }

  // ─── GET /api/v1/plants/slug/:nursery_slug/:plant_slug ────────────────────

  async findBySlug(nurserySlug: string, plantSlug: string) {
    const plant = await this.prisma.plant.findFirst({
      where: {
        slug: plantSlug,
        nursery: { slug: nurserySlug },
        isActive: true,
      },
      include: {
        nursery: true,
        images: { orderBy: { displayOrder: "asc" } },
        category: true,
        tags: { include: { tag: true } },
      },
    });

    if (!plant) throw new NotFoundException("Plant not found");
    return plant;
  }

  // ─── GET /api/v1/plants/featured ─────────────────────────────────────────

  async getFeatured(featureType?: FeatureType, limit: number = 20) {
    const now = new Date();

    const featured = await this.prisma.featuredPlant.findMany({
      where: {
        isActive: true,
        ...(featureType ? { featureType } : {
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        }),
        plant: {
          isActive: true,
          stockQuantity: { gt: 0 },
          nursery: { isActive: true, isVerified: true },
        },
      },
      take: limit,
      orderBy: { displayOrder: "asc" },
      include: {
        plant: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            nursery: { select: { id: true, name: true, city: true } },
          },
        },
      },
    });

    return featured.map((f) => f.plant);
  }

  // ─── GET /api/v1/plants/trending ──────────────────────────────────────────

  async getTrending(limit: number = 20, days: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const interactions = await this.prisma.userPlantInteraction.groupBy({
      by: ["plantId"],
      where: {
        createdAt: { gte: cutoffDate },
        // FIX: use proper InteractionType enum values
        interactionType: {
          in: [
            InteractionType.RENT,
            InteractionType.BUY,
            InteractionType.VIEW,
            InteractionType.WISHLIST,
          ],
        },
      },
      _count: { plantId: true },
      orderBy: { _count: { plantId: "desc" } },
      take: limit,
    });

    const plantIds = interactions.map((i) => i.plantId);
    if (plantIds.length === 0) return [];

    const plants = await this.prisma.plant.findMany({
      where: {
        id: { in: plantIds },
        isActive: true,
        stockQuantity: { gt: 0 },
        nursery: { isActive: true, isVerified: true },
      },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        nursery: { select: { id: true, name: true, city: true } },
      },
    });

    return plants.sort((a, b) => {
      const aCount = interactions.find((i) => i.plantId === a.id)?._count.plantId ?? 0;
      const bCount = interactions.find((i) => i.plantId === b.id)?._count.plantId ?? 0;
      return bCount - aCount;
    });
  }

  // ─── GET /api/v1/plants/seasonal ──────────────────────────────────────────

  async getSeasonal(limit: number = 20) {
    const month = new Date().getMonth() + 1;
    const seasonalTags =
      month >= 3 && month <= 5 ? ["spring", "flowering"] :
      month >= 6 && month <= 8 ? ["summer", "outdoor"] :
      month >= 9 && month <= 11 ? ["autumn", "foliage"] :
      ["winter", "indoor"];

    return this.prisma.plant.findMany({
      where: {
        isActive: true,
        stockQuantity: { gt: 0 },
        nursery: { isActive: true, isVerified: true },
        tags: { some: { tag: { name: { in: seasonalTags } } } },
      },
      take: limit,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        nursery: { select: { id: true, name: true } },
      },
      orderBy: { ratingAvg: "desc" },
    });
  }

  // ─── GET /api/v1/plants/categories ───────────────────────────────────────

  async getCategories() {
    return this.prisma.plantCategory.findMany({
      where: { isActive: true },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            plants: { where: { isActive: true, stockQuantity: { gt: 0 } } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  // ─── GET /api/v1/plants/categories/:category_id ───────────────────────────

  async getCategoryById(categoryId: string, filterDto: any) {
    const category = await this.prisma.plantCategory.findUnique({
      where: { id: categoryId },
      include: { parent: true, children: true },
    });

    if (!category) throw new NotFoundException("Category not found");

    const plants = await this.findAll({ ...filterDto, category_id: categoryId });
    return { category, plants };
  }

  // ─── GET /api/v1/plants/:plant_id/reviews ────────────────────────────────

  async getPlantReviews(plantId: string, filterDto: any) {
    const { page = 1, limit = 20, rating } = filterDto;

    const where: Prisma.ReviewWhereInput = {
      reviewableType: ReviewableType.PLANT,
      reviewableId: plantId,
      isActive: true,
      ...(rating && { rating: parseInt(rating) }),
    };

    const skip = (Number(page) - 1) * Number(limit);

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
          images: true,
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // ─── POST /api/v1/plants/:plant_id/reviews ───────────────────────────────

  async createReview(userId: string, plantId: string, reviewDto: any) {
    const { rating, title, comment, order_id, images } = reviewDto;

    const plant = await this.prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant) throw new NotFoundException("Plant not found");

    const existingReview = await this.prisma.review.findFirst({
      where: { userId, reviewableType: ReviewableType.PLANT, reviewableId: plantId },
    });
    if (existingReview) throw new ConflictException("You have already reviewed this plant");

    // Check verified purchase
    const orderQuery = {
      userId,
      items: { some: { plantId } },
      ...(order_id ? { id: order_id } : {}),
    };
    const hasOrder = await this.prisma.order.findFirst({ where: orderQuery });

    const review = await this.prisma.review.create({
      data: {
        userId,
        reviewableType: ReviewableType.PLANT,
        reviewableId: plantId,
        rating,
        title,
        comment,
        orderId: order_id ?? null,
        isVerifiedPurchase: !!hasOrder,
        images: {
          create: images?.map((url: string) => ({ imageUrl: url })) ?? [],
        },
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        images: true,
      },
    });

    await this.updatePlantRating(plantId);
    return review;
  }

  // ─── GET /api/v1/plants/:plant_id/availability ────────────────────────────

  async checkAvailability(plantId: string, filterDto: any) {
    const { start_date, end_date, quantity = 1 } = filterDto;

    const plant = await this.prisma.plant.findUnique({ where: { id: plantId } });
    if (!plant || !plant.isActive) return { available: false, available_quantity: 0 };

    if (!start_date || !end_date) {
      return {
        available: plant.stockQuantity >= Number(quantity),
        available_quantity: plant.stockQuantity,
      };
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    const activeRentals = await this.prisma.orderItem.count({
      where: {
        plantId,
        orderType: OrderType.RENT,
        // FIX: use proper RentalStatus enum values
        rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
        OR: [
          { AND: [{ rentStartDate: { lte: startDate } }, { rentEndDate: { gte: startDate } }] },
          { AND: [{ rentStartDate: { lte: endDate } },   { rentEndDate: { gte: endDate } }] },
          { AND: [{ rentStartDate: { gte: startDate } }, { rentEndDate: { lte: endDate } }] },
        ],
      },
    });

    const availableQuantity = Math.max(0, plant.stockQuantity - activeRentals);
    return {
      available: availableQuantity >= Number(quantity),
      available_quantity: availableQuantity,
    };
  }

  // ─── Helper: update plant rating ──────────────────────────────────────────

  private async updatePlantRating(plantId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { reviewableType: ReviewableType.PLANT, reviewableId: plantId, isActive: true },
      select: { rating: true },
    });

    if (reviews.length === 0) return;

    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await this.prisma.plant.update({
      where: { id: plantId },
      data: {
        ratingAvg: new Decimal(Math.round(avg * 10) / 10),
        totalReviews: reviews.length,
      },
    });
  }

  // ─── POST /api/v1/plants/vendor/plants/inventory ─────────────────────────

  private async defaultInventoryCategoryId() {
    const preferred = await this.prisma.plantCategory.findFirst({
      where: { slug: "indoor-plants", isActive: true },
      select: { id: true },
    });
    if (preferred) return preferred.id;
    const fallback = await this.prisma.plantCategory.findFirst({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (!fallback) {
      throw new BadRequestException("No plant category configured; seed categories first");
    }
    return fallback.id;
  }

  async createInventoryPlant(
    vendorId: string,
    body: { name: string; stock_quantity: number },
    imageFile: UploadFileMeta
  ) {
    const name = body.name?.trim();
    if (!name || name.length < 2) {
      throw new BadRequestException("name is required (min 2 characters)");
    }
    const stock = Number(body.stock_quantity);
    if (!Number.isInteger(stock) || stock < 0) {
      throw new BadRequestException("stock_quantity must be a non-negative integer");
    }
    if (!imageFile?.buffer?.length) {
      throw new BadRequestException("image file is required");
    }
    if (!imageFile.mimetype?.toLowerCase().startsWith("image/")) {
      throw new BadRequestException("Only image files are allowed");
    }

    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new BadRequestException("Vendor must have a nursery to add plants");

    const categoryId = await this.defaultInventoryCategoryId();
    const slug = await this.ensureUniqueSlug(this.generateSlug(name), nursery.id);
    const { url } = await this.media.uploadFile(vendorId, imageFile, "plants", undefined);

    const plant = await this.prisma.plant.create({
      data: {
        nurseryId: nursery.id,
        categoryId,
        name,
        slug,
        maintenanceLevel: MaintenanceLevel.LOW,
        isAvailableForRent: false,
        isAvailableForSale: false,
        stockQuantity: stock,
        isActive: true,
        images: {
          create: [{ imageUrl: url, isPrimary: true, displayOrder: 0 }],
        },
      },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
      },
    });

    return {
      plant_id: plant.id,
      name: plant.name,
      stock_quantity: plant.stockQuantity,
      stock_status: plant.stockQuantity > 0 ? "AVAILABLE" : "OUT_OF_STOCK",
      image_url: plant.images[0]?.imageUrl ?? url,
      created_at: plant.createdAt.toISOString(),
    };
  }

  // ─── POST /api/v1/plants/vendor/plants ───────────────────────────────────

  async createPlant(vendorId: string, createDto: any) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new BadRequestException("Vendor must have a nursery to add plants");

    const {
      category_id,
      name,
      scientific_name,
      description,
      care_instructions,
      sunlight_requirement,
      water_frequency,
      maintenance_level,
      is_indoor = true,
      is_pet_friendly = false,
      height_cm,
      pot_included = true,
      rent_price_daily,
      rent_price_weekly,
      rent_price_monthly,
      buy_price,
      deposit_amount = 0,
      is_available_for_rent = true,
      is_available_for_sale = true,
      stock_quantity,
      min_rent_days = 7,
      max_rent_days = 365,
      images,
      tags,
    } = createDto;

    // FIX: validate category exists before attempting create
    if (category_id) {
      const category = await this.prisma.plantCategory.findUnique({ where: { id: category_id } });
      if (!category) throw new BadRequestException(`Category not found: ${category_id}`);
    }

    if (!is_available_for_rent && !is_available_for_sale) {
      throw new BadRequestException("Plant must be available for rent or sale");
    }
    if (is_available_for_rent && !rent_price_monthly) {
      throw new BadRequestException("Monthly rent price is required for rental plants");
    }
    if (is_available_for_sale && !buy_price) {
      throw new BadRequestException("Buy price is required for sale plants");
    }
    if (!images || images.length === 0) {
      throw new BadRequestException("At least one image is required");
    }

    const baseSlug = this.generateSlug(name);
    const slug = await this.ensureUniqueSlug(baseSlug, nursery.id);

    const plant = await this.prisma.plant.create({
      data: {
        nurseryId: nursery.id,
        categoryId: category_id,
        name,
        scientificName: scientific_name,
        slug,
        description,
        careInstructions: care_instructions,
        sunlightRequirement: sunlight_requirement,
        waterFrequency: water_frequency,
        maintenanceLevel: maintenance_level,
        isIndoor: is_indoor,
        isPetFriendly: is_pet_friendly,
        heightCm: height_cm,
        potIncluded: pot_included,
        rentPriceDaily:   rent_price_daily   ? new Decimal(rent_price_daily)   : null,
        rentPriceWeekly:  rent_price_weekly  ? new Decimal(rent_price_weekly)  : null,
        rentPriceMonthly: rent_price_monthly ? new Decimal(rent_price_monthly) : null,
        buyPrice:         buy_price          ? new Decimal(buy_price)          : null,
        depositAmount: new Decimal(deposit_amount),
        isAvailableForRent: is_available_for_rent,
        isAvailableForSale: is_available_for_sale,
        stockQuantity: stock_quantity,
        minRentDays: min_rent_days,
        maxRentDays: max_rent_days,
        images: {
          create: images.map((img: any, i: number) => ({
            imageUrl: img.image_url,
            isPrimary: img.is_primary ?? i === 0,
            displayOrder: img.display_order ?? i,
          })),
        },
        // FIX: PlantTagMapping relation to PlantTag model (not a generic Tag model)
        tags: {
          create: tags?.map((tagName: string) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName },
              },
            },
          })) ?? [],
        },
      },
      include: {
        images: true,
        tags: { include: { tag: true } },
        category: true,
      },
    });

    return plant;
  }

  // ─── GET /api/v1/plants/vendor/plants ────────────────────────────────────

  async getVendorPlants(vendorId: string, filterDto: any) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const { page = 1, limit = 20, category_id, is_active, stock_status } = filterDto;

    const where: Prisma.PlantWhereInput = {
      nurseryId: nursery.id,
      ...(category_id && { categoryId: category_id }),
      ...(is_active !== undefined && { isActive: is_active === true || is_active === "true" }),
      ...(stock_status === "in_stock"    && { stockQuantity: { gt: 0 } }),
      ...(stock_status === "out_of_stock" && { stockQuantity: 0 }),
      ...(stock_status === "low_stock"   && { stockQuantity: { lte: 5, gt: 0 } }),
    };

    const skip = (Number(page) - 1) * Number(limit);

    const [plants, total] = await Promise.all([
      this.prisma.plant.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: true,
          _count: { select: { orderItems: true, wishlists: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.plant.count({ where }),
    ]);

    const plantsWithStats = plants.map((plant) => ({
      ...plant,
      stats: {
        totalOrders: plant._count.orderItems,
        totalWishlists: plant._count.wishlists,
        stockStatus:
          plant.stockQuantity === 0 ? "out_of_stock" :
          plant.stockQuantity <= 5  ? "low_stock" : "in_stock",
      },
    }));

    return {
      items: plantsWithStats,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // ─── GET /api/v1/plants/vendor/plants/:plant_id ───────────────────────────

  async getVendorPlant(vendorId: string, plantId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const plant = await this.prisma.plant.findFirst({
      where: { id: plantId, nurseryId: nursery.id },
      include: {
        images: true,
        tags: { include: { tag: true } },
        category: true,
        _count: { select: { orderItems: true, wishlists: true } },
      },
    });

    if (!plant) throw new NotFoundException("Plant not found");

    const orderStats = await this.prisma.orderItem.groupBy({
      by: ["orderType"],
      where: { plantId },
      _count: { orderType: true },
    });

    return { ...plant, orderStats };
  }

  // ─── PUT /api/v1/plants/vendor/plants/:plant_id ───────────────────────────

  async updatePlant(vendorId: string, plantId: string, updateDto: any) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const plant = await this.prisma.plant.findFirst({
      where: { id: plantId, nurseryId: nursery.id },
    });
    if (!plant) throw new NotFoundException("Plant not found");

    // FIX: validate new category if provided
    if (updateDto.category_id) {
      const category = await this.prisma.plantCategory.findUnique({
        where: { id: updateDto.category_id },
      });
      if (!category) throw new BadRequestException(`Category not found: ${updateDto.category_id}`);
    }

    const updateData: Prisma.PlantUpdateInput = {};

    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
      updateData.slug = await this.ensureUniqueSlug(this.generateSlug(updateDto.name), nursery.id, plantId);
    }
    if (updateDto.category_id !== undefined)      updateData.category        = { connect: { id: updateDto.category_id } };
    if (updateDto.scientific_name !== undefined)  updateData.scientificName  = updateDto.scientific_name;
    if (updateDto.description !== undefined)      updateData.description     = updateDto.description;
    if (updateDto.care_instructions !== undefined) updateData.careInstructions = updateDto.care_instructions;
    if (updateDto.sunlight_requirement !== undefined) updateData.sunlightRequirement = updateDto.sunlight_requirement;
    if (updateDto.water_frequency !== undefined)  updateData.waterFrequency  = updateDto.water_frequency;
    if (updateDto.maintenance_level !== undefined) updateData.maintenanceLevel = updateDto.maintenance_level;
    if (updateDto.is_indoor !== undefined)        updateData.isIndoor        = updateDto.is_indoor;
    if (updateDto.is_pet_friendly !== undefined)  updateData.isPetFriendly   = updateDto.is_pet_friendly;
    if (updateDto.height_cm !== undefined)        updateData.heightCm        = updateDto.height_cm;
    if (updateDto.pot_included !== undefined)     updateData.potIncluded     = updateDto.pot_included;
    if (updateDto.rent_price_daily !== undefined)   updateData.rentPriceDaily   = new Decimal(updateDto.rent_price_daily);
    if (updateDto.rent_price_weekly !== undefined)  updateData.rentPriceWeekly  = new Decimal(updateDto.rent_price_weekly);
    if (updateDto.rent_price_monthly !== undefined) updateData.rentPriceMonthly = new Decimal(updateDto.rent_price_monthly);
    if (updateDto.buy_price !== undefined)          updateData.buyPrice         = new Decimal(updateDto.buy_price);
    if (updateDto.deposit_amount !== undefined)     updateData.depositAmount    = new Decimal(updateDto.deposit_amount);
    if (updateDto.is_available_for_rent !== undefined) updateData.isAvailableForRent = updateDto.is_available_for_rent;
    if (updateDto.is_available_for_sale !== undefined) updateData.isAvailableForSale = updateDto.is_available_for_sale;
    if (updateDto.stock_quantity !== undefined)   updateData.stockQuantity   = updateDto.stock_quantity;
    if (updateDto.min_rent_days !== undefined)    updateData.minRentDays     = updateDto.min_rent_days;
    if (updateDto.max_rent_days !== undefined)    updateData.maxRentDays     = updateDto.max_rent_days;
    if (updateDto.is_active !== undefined)        updateData.isActive        = updateDto.is_active;

    return this.prisma.plant.update({
      where: { id: plantId },
      data: updateData,
      include: {
        images: true,
        tags: { include: { tag: true } },
      },
    });
  }

  // ─── DELETE /api/v1/plants/vendor/plants/:plant_id ────────────────────────

  async deletePlant(vendorId: string, plantId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const plant = await this.prisma.plant.findFirst({
      where: { id: plantId, nurseryId: nursery.id },
      include: {
        orderItems: {
          where: { rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] } },
        },
      },
    });
    if (!plant) throw new NotFoundException("Plant not found");

    if (plant.orderItems.length > 0) {
      await this.prisma.plant.update({ where: { id: plantId }, data: { isActive: false } });
      return { message: "Plant deactivated due to active rentals" };
    }

    try {
      await this.prisma.plant.delete({ where: { id: plantId } });
      return { message: "Plant deleted successfully" };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        await this.prisma.plant.update({ where: { id: plantId }, data: { isActive: false } });
        return { message: "Plant has related records; it was deactivated instead of deleted" };
      }
      throw e;
    }
  }

  // ─── PUT /api/v1/plants/vendor/plants/:plant_id/stock ────────────────────

  async updateStock(vendorId: string, plantId: string, stockDto: any) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const plant = await this.prisma.plant.findFirst({
      where: { id: plantId, nurseryId: nursery.id },
    });
    if (!plant) throw new NotFoundException("Plant not found");

    const { stock_quantity, adjustment } = stockDto;

    let newStock: number;
    if (stock_quantity !== undefined)    newStock = stock_quantity;
    else if (adjustment !== undefined)   newStock = plant.stockQuantity + adjustment;
    else throw new BadRequestException("Either stock_quantity or adjustment must be provided");

    if (newStock < 0) throw new BadRequestException("Stock quantity cannot be negative");

    return this.prisma.plant.update({
      where: { id: plantId },
      data: { stockQuantity: newStock },
    });
  }

  // ─── PATCH (multipart) — local disk via MediaService (no S3 required) ─────

  private async assertVendorOwnsPlant(vendorId: string, plantId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const plant = await this.prisma.plant.findFirst({
      where: { id: plantId, nurseryId: nursery.id },
    });
    if (!plant) throw new NotFoundException("Plant not found");
  }

  async attachLocalImagesToPlant(
    vendorId: string,
    plantId: string,
    files: UploadFileMeta[]
  ) {
    if (!files.length) {
      return [];
    }
    await this.assertVendorOwnsPlant(vendorId, plantId);

    const [existingCount, lastOrder] = await Promise.all([
      this.prisma.plantImage.count({ where: { plantId } }),
      this.prisma.plantImage.findFirst({
        where: { plantId },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      }),
    ]);
    const base = (lastOrder?.displayOrder ?? 0) + 1;
    const created: PlantImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.mimetype?.toLowerCase().startsWith("image/")) {
        throw new BadRequestException("Only image files are allowed");
      }
      const { url } = await this.media.uploadFile(vendorId, f, "plants", undefined);
      created.push(
        await this.prisma.plantImage.create({
          data: {
            plantId,
            imageUrl: url,
            isPrimary: existingCount === 0 && i === 0,
            displayOrder: base + i,
          },
        })
      );
    }
    return created;
  }

  async patchVendorPlantWithImages(
    vendorId: string,
    plantId: string,
    dataJson: string | undefined,
    files: UploadFileMeta[] | undefined
  ) {
    const hasFiles = (files?.length ?? 0) > 0;
    let raw: Record<string, unknown> = {};
    if (dataJson != null && String(dataJson).trim() !== "") {
      try {
        raw = JSON.parse(String(dataJson)) as Record<string, unknown>;
      } catch {
        throw new BadRequestException("data must be valid JSON when provided");
      }
    }
    if (Object.keys(raw).length === 0 && !hasFiles) {
      throw new BadRequestException("Provide data (JSON string) and/or image files as images");
    }
    if (Object.keys(raw).length > 0) {
      const { adjustment, ...rest } = raw as { adjustment?: number } & Record<string, unknown>;
      if (adjustment !== undefined) {
        if (typeof adjustment !== "number" || !Number.isFinite(adjustment)) {
          throw new BadRequestException("adjustment must be a number when provided in data");
        }
        await this.updateStock(vendorId, plantId, { adjustment });
      }
      if (Object.keys(rest).length > 0) {
        const dto = plainToInstance(UpdatePlantDto, rest, { enableImplicitConversion: true });
        const err = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (err.length) {
          const parts = err.flatMap((e) => (e.constraints ? Object.values(e.constraints) : []));
          throw new BadRequestException(parts.length ? parts.join(", ") : "Invalid plant data");
        }
        await this.updatePlant(vendorId, plantId, instanceToPlain(dto));
      }
    }
    if (hasFiles) {
      await this.attachLocalImagesToPlant(vendorId, plantId, files!);
    }
    return this.getVendorPlant(vendorId, plantId);
  }

  async patchVendorStockWithImages(
    vendorId: string,
    plantId: string,
    dataJson: string | undefined,
    files: UploadFileMeta[] | undefined
  ) {
    const hasFiles = (files?.length ?? 0) > 0;
    let raw: Record<string, unknown> = {};
    if (dataJson != null && String(dataJson).trim() !== "") {
      try {
        raw = JSON.parse(String(dataJson)) as Record<string, unknown>;
      } catch {
        throw new BadRequestException("data must be valid JSON when provided");
      }
    }
    if (Object.keys(raw).length === 0 && !hasFiles) {
      throw new BadRequestException("Provide data (JSON) with stock update and/or image files as images");
    }
    if (Object.keys(raw).length > 0) {
      const dto = plainToInstance(UpdateStockDto, raw, { enableImplicitConversion: true });
      const err = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      if (err.length) {
        const parts = err.flatMap((e) => (e.constraints ? Object.values(e.constraints) : []));
        throw new BadRequestException(parts.length ? parts.join(", ") : "Invalid stock data");
      }
      await this.updateStock(vendorId, plantId, instanceToPlain(dto));
    }
    if (hasFiles) {
      await this.attachLocalImagesToPlant(vendorId, plantId, files!);
    }
    return this.getVendorPlant(vendorId, plantId);
  }

  // ─── POST /api/v1/plants/vendor/plants/:plant_id/images ──────────────────

  async addPlantImages(vendorId: string, plantId: string, imagesDto: any) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const plant = await this.prisma.plant.findFirst({
      where: { id: plantId, nurseryId: nursery.id },
    });
    if (!plant) throw new NotFoundException("Plant not found");

    return Promise.all(
      imagesDto.images.map((img: any) =>
        this.prisma.plantImage.create({
          data: {
            plantId,
            imageUrl: img.image_url,
            isPrimary: img.is_primary ?? false,
            displayOrder: img.display_order ?? 0,
          },
        })
      )
    );
  }

  // ─── DELETE /api/v1/plants/vendor/plants/:plant_id/images/:image_id ───────

  async deletePlantImage(vendorId: string, plantId: string, imageId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const plant = await this.prisma.plant.findFirst({
      where: { id: plantId, nurseryId: nursery.id },
      include: { images: true },
    });
    if (!plant) throw new NotFoundException("Plant not found");

    if (plant.images.length <= 1) {
      throw new BadRequestException("Cannot delete the only remaining image");
    }

    const image = await this.prisma.plantImage.findFirst({
      where: { id: imageId, plantId },
    });
    if (!image) {
      throw new NotFoundException("Image not found");
    }

    await this.prisma.plantImage.delete({ where: { id: imageId } });
    return { message: "Image deleted successfully" };
  }

  // ─── PUT /api/v1/plants/vendor/plants/:plant_id/pricing ──────────────────

  async updatePricing(vendorId: string, plantId: string, pricingDto: any) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const plant = await this.prisma.plant.findFirst({
      where: { id: plantId, nurseryId: nursery.id },
    });
    if (!plant) throw new NotFoundException("Plant not found");

    const updateData: Prisma.PlantUpdateInput = {};
    if (pricingDto.rent_price_daily !== undefined)   updateData.rentPriceDaily   = new Decimal(pricingDto.rent_price_daily);
    if (pricingDto.rent_price_weekly !== undefined)  updateData.rentPriceWeekly  = new Decimal(pricingDto.rent_price_weekly);
    if (pricingDto.rent_price_monthly !== undefined) updateData.rentPriceMonthly = new Decimal(pricingDto.rent_price_monthly);
    if (pricingDto.buy_price !== undefined)          updateData.buyPrice         = new Decimal(pricingDto.buy_price);
    if (pricingDto.deposit_amount !== undefined)     updateData.depositAmount    = new Decimal(pricingDto.deposit_amount);

    return this.prisma.plant.update({ where: { id: plantId }, data: updateData });
  }

  // ─── PUT /api/v1/plants/vendor/plants/bulk-update ────────────────────────

  async bulkUpdate(vendorId: string, bulkDto: any) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const { plant_ids, updates } = bulkDto;

    const plants = await this.prisma.plant.findMany({
      where: { id: { in: plant_ids }, nurseryId: nursery.id },
    });

    if (plants.length !== plant_ids.length) {
      throw new BadRequestException("Some plants not found or don't belong to this vendor");
    }

    const updateData: Prisma.PlantUpdateManyMutationInput = {};
    if (updates.is_active !== undefined) updateData.isActive = updates.is_active;

    const result = await this.prisma.plant.updateMany({
      where: { id: { in: plant_ids }, nurseryId: nursery.id },
      data: updateData,
    });

    return { message: "Bulk update completed", updated_count: result.count };
  }
}