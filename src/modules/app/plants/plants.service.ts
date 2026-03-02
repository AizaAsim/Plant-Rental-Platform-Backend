// src/modules/app/plants/plants.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { Prisma, MaintenanceLevel, SunlightRequirement, WaterFrequency, FeatureType, OrderType, ReviewableType } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class PlantsService {
  constructor(private prisma: PrismaService) {}

  // Helper: Calculate distance
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // GET /api/v1/plants - Browse all plants
  async findAll(filterDto: any) {
    const {
      page = 1,
      limit = 20,
      category_id,
      category_slug,
      nursery_id,
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
      nursery: {
        isActive: true,
        isVerified: true,
      },
      stockQuantity: { gt: 0 },
      ...(category_id && { categoryId: category_id }),
      ...(category_slug && {
        category: {
          slug: category_slug,
        },
      }),
      ...(nursery_id && { nurseryId: nursery_id }),
      ...(maintenance_level && { maintenanceLevel: maintenance_level }),
      ...(sunlight_requirement && { sunlightRequirement: sunlight_requirement }),
      ...(water_frequency && { waterFrequency: water_frequency }),
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
            { pincode: pincode },
            {
              serviceAreas: {
                some: {
                  pincode: pincode,
                },
              },
            },
          ],
        },
      }),
      ...(tags && Array.isArray(tags) && tags.length > 0 && {
        tags: {
          some: {
            tag: {
              name: { in: tags },
            },
          },
        },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { scientificName: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    let orderBy: Prisma.PlantOrderByWithRelationInput = {};
    switch (sort_by) {
      case "price_asc":
        orderBy = { buyPrice: "asc" };
        break;
      case "price_desc":
        orderBy = { buyPrice: "desc" };
        break;
      case "rating":
        orderBy = { ratingAvg: "desc" };
        break;
      case "popularity":
        orderBy = { totalRentals: "desc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
    }

    const skip = (page - 1) * limit;

    const [plants, total] = await Promise.all([
      this.prisma.plant.findMany({
        where,
        orderBy,
        skip,
        take: limit,
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
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          category: true,
        },
      }),
      this.prisma.plant.count({ where }),
    ]);

    // Calculate distance if coordinates provided
    let plantsWithDistance = plants.map((plant) => {
      const data: any = { ...plant };

      if (latitude && longitude && plant.nursery.latitude && plant.nursery.longitude) {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          Number(plant.nursery.latitude),
          Number(plant.nursery.longitude)
        );
        data.distance = distance;

        // Filter by radius if provided
        if (radius_km && distance > radius_km) {
          return null;
        }
      }

      return data;
    }).filter(Boolean);

    return {
      items: plantsWithDistance,
      pagination: {
      page,
      limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /api/v1/plants/{plant_id}
  async findById(plantId: string) {
    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        isActive: true,
        nursery: {
        isActive: true,
        },
      },
      include: {
        nursery: {
          include: {
            workingHours: true,
            serviceAreas: true,
          },
        },
        images: {
          orderBy: { displayOrder: "asc" },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            wishlists: true,
          },
        },
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    // Get related plants
    const relatedPlants = await this.prisma.plant.findMany({
      where: {
        categoryId: plant.categoryId,
        id: { not: plantId },
        isActive: true,
        stockQuantity: { gt: 0 },
      },
      take: 6,
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        nursery: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      ...plant,
      relatedPlants,
    };
  }

  // GET /api/v1/plants/slug/{nursery_slug}/{plant_slug}
  async findBySlug(nurserySlug: string, plantSlug: string) {
    const plant = await this.prisma.plant.findFirst({
      where: {
        slug: plantSlug,
        nursery: {
          slug: nurserySlug,
        },
        isActive: true,
      },
      include: {
        nursery: true,
        images: {
          orderBy: { displayOrder: "asc" },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    return plant;
  }

  // GET /api/v1/plants/featured
  async getFeatured(featureType?: FeatureType, limit: number = 20) {
    const where: Prisma.FeaturedPlantWhereInput = {
      isActive: true,
      plant: {
        isActive: true,
        stockQuantity: { gt: 0 },
            nursery: {
          isActive: true,
          isVerified: true,
        },
      },
      ...(featureType && { featureType }),
      ...(featureType ? {} : {
        AND: [
          {
            OR: [
              { startDate: null },
              { startDate: { lte: new Date() } },
            ],
          },
          {
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } },
            ],
          },
        ],
      }),
    };

    const featured = await this.prisma.featuredPlant.findMany({
        where,
      take: limit,
      orderBy: { displayOrder: "asc" },
        include: {
        plant: {
          include: {
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          nursery: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
            },
          },
        },
    });

    return featured.map((f) => f.plant);
  }

  // GET /api/v1/plants/trending
  async getTrending(limit: number = 20, days: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get plants with most interactions in the period
    const interactions = await this.prisma.userPlantInteraction.groupBy({
      by: ["plantId"],
      where: {
        createdAt: { gte: cutoffDate },
        interactionType: {
          in: ["RENT", "BUY", "VIEW", "WISHLIST"],
        },
      },
      _count: {
        plantId: true,
      },
      orderBy: {
        _count: {
          plantId: "desc",
        },
      },
      take: limit,
    });

    const plantIds = interactions.map((i) => i.plantId);

    const plants = await this.prisma.plant.findMany({
      where: {
        id: { in: plantIds },
        isActive: true,
        stockQuantity: { gt: 0 },
        nursery: {
          isActive: true,
          isVerified: true,
        },
      },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        nursery: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    // Sort by interaction count
    const sorted = plants.sort((a, b) => {
      const aCount = interactions.find((i) => i.plantId === a.id)?._count.plantId || 0;
      const bCount = interactions.find((i) => i.plantId === b.id)?._count.plantId || 0;
      return bCount - aCount;
    });

    return sorted;
  }

  // GET /api/v1/plants/seasonal
  async getSeasonal(limit: number = 20) {
    const currentMonth = new Date().getMonth() + 1;
    // Simple seasonal logic - can be enhanced
    const seasonalTags = currentMonth >= 3 && currentMonth <= 5 ? ["spring", "flowering"] :
                         currentMonth >= 6 && currentMonth <= 8 ? ["summer", "outdoor"] :
                         currentMonth >= 9 && currentMonth <= 11 ? ["autumn", "foliage"] :
                         ["winter", "indoor"];

    const plants = await this.prisma.plant.findMany({
      where: {
        isActive: true,
        stockQuantity: { gt: 0 },
        nursery: {
          isActive: true,
          isVerified: true,
        },
        tags: {
          some: {
            tag: {
              name: { in: seasonalTags },
            },
          },
        },
      },
      take: limit,
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        nursery: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        ratingAvg: "desc",
      },
    });

    return plants;
  }

  // GET /api/v1/plants/categories
  async getCategories() {
    const categories = await this.prisma.plantCategory.findMany({
      where: {
        isActive: true,
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            plants: {
              where: {
                isActive: true,
                stockQuantity: { gt: 0 },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return categories;
  }

  // GET /api/v1/plants/categories/{category_id}
  async getCategoryById(categoryId: string, filterDto: any) {
    const category = await this.prisma.plantCategory.findUnique({
      where: { id: categoryId },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    // Get plants in this category with filters
    const plants = await this.findAll({
      ...filterDto,
      category_id: categoryId,
    });

    return {
      category,
      plants,
    };
  }

  // GET /api/v1/plants/{plant_id}/reviews
  async getPlantReviews(plantId: string, filterDto: any) {
    const { page = 1, limit = 20, rating } = filterDto;

    const where: Prisma.ReviewWhereInput = {
      reviewableType: ReviewableType.PLANT,
      reviewableId: plantId,
      isActive: true,
      ...(rating && { rating: parseInt(rating) }),
    };

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
          select: {
            id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          images: true,
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // POST /api/v1/plants/{plant_id}/reviews
  async createReview(userId: string, plantId: string, reviewDto: any) {
    const { rating, title, comment, order_id, images } = reviewDto;

    // Check if plant exists
    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    // Check if user has purchased/rented this plant
    let isVerifiedPurchase = false;
    if (order_id) {
      const order = await this.prisma.order.findFirst({
        where: {
          id: order_id,
          userId,
          items: {
            some: {
              plantId: plantId,
            },
          },
        },
      });
      isVerifiedPurchase = !!order;
    } else {
      // Check if user has any order with this plant
      const hasOrder = await this.prisma.order.findFirst({
        where: {
          userId,
          items: {
            some: {
              plantId: plantId,
            },
          },
        },
      });
      isVerifiedPurchase = !!hasOrder;
    }

    // Check if user already reviewed
    const existingReview = await this.prisma.review.findFirst({
      where: {
        userId,
        reviewableType: ReviewableType.PLANT,
        reviewableId: plantId,
      },
    });

    if (existingReview) {
      throw new ConflictException("You have already reviewed this plant");
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        userId,
        reviewableType: ReviewableType.PLANT,
        reviewableId: plantId,
        rating,
        title,
        comment,
        orderId: order_id,
        isVerifiedPurchase,
        images: {
          create: images?.map((url: string) => ({ imageUrl: url })) || [],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        images: true,
      },
    });

    // Update plant rating
    await this.updatePlantRating(plantId);

    return review;
  }

  // GET /api/v1/plants/{plant_id}/availability
  async checkAvailability(plantId: string, filterDto: any) {
    const { start_date, end_date, quantity = 1 } = filterDto;

    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
    });

    if (!plant || !plant.isActive) {
      return { available: false, available_quantity: 0 };
    }

    if (!start_date || !end_date) {
      return {
        available: plant.stockQuantity >= quantity,
        available_quantity: plant.stockQuantity,
      };
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Check active rentals in this period
    const activeRentals = await this.prisma.orderItem.count({
      where: {
        plantId: plantId,
        orderType: OrderType.RENT,
        rentalStatus: {
          in: ["ACTIVE", "EXTENDED"],
        },
        OR: [
          {
            AND: [
              { rentStartDate: { lte: startDate } },
              { rentEndDate: { gte: startDate } },
            ],
          },
          {
            AND: [
              { rentStartDate: { lte: endDate } },
              { rentEndDate: { gte: endDate } },
            ],
          },
          {
            AND: [
              { rentStartDate: { gte: startDate } },
              { rentEndDate: { lte: endDate } },
            ],
          },
        ],
      },
    });

    const availableQuantity = Math.max(0, plant.stockQuantity - activeRentals);

    return {
      available: availableQuantity >= quantity,
      available_quantity: availableQuantity,
    };
  }

  // Helper: Update plant rating
  private async updatePlantRating(plantId: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        reviewableType: ReviewableType.PLANT,
        reviewableId: plantId,
        isActive: true,
      },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return;
    }

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await this.prisma.plant.update({
      where: { id: plantId },
      data: {
        ratingAvg: new Decimal(Math.round(avgRating * 10) / 10),
        totalReviews: reviews.length,
      },
    });
  }

  // ========== VENDOR PLANT MANAGEMENT ==========

  // POST /api/v1/vendor/plants
  async createPlant(vendorId: string, createDto: any) {
    // Verify vendor has a nursery
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new BadRequestException("Vendor must have a nursery to add plants");
    }

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

    // Validate pricing
    if (!is_available_for_rent && !is_available_for_sale) {
      throw new BadRequestException("Plant must be available for rent or sale");
    }

    if (is_available_for_rent && !rent_price_monthly) {
      throw new BadRequestException("Monthly rent price is required for rental plants");
    }

    if (is_available_for_sale && !buy_price) {
      throw new BadRequestException("Buy price is required for sale plants");
    }

    // Validate images
    if (!images || images.length === 0) {
      throw new BadRequestException("At least one image is required");
    }

    // Generate slug
    const baseSlug = this.generateSlug(name);
    const slug = await this.ensureUniqueSlug(baseSlug, nursery.id);

    // Create plant
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
        rentPriceDaily: rent_price_daily ? new Decimal(rent_price_daily) : null,
        rentPriceWeekly: rent_price_weekly ? new Decimal(rent_price_weekly) : null,
        rentPriceMonthly: rent_price_monthly ? new Decimal(rent_price_monthly) : null,
        buyPrice: buy_price ? new Decimal(buy_price) : null,
        depositAmount: new Decimal(deposit_amount),
        isAvailableForRent: is_available_for_rent,
        isAvailableForSale: is_available_for_sale,
        stockQuantity: stock_quantity,
        minRentDays: min_rent_days,
        maxRentDays: max_rent_days,
        images: {
          create: images.map((img: any, index: number) => ({
            imageUrl: img.image_url,
            isPrimary: img.is_primary || index === 0,
            displayOrder: index,
          })),
        },
        tags: {
          create: tags?.map((tagName: string) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName },
              },
            },
          })) || [],
        },
      },
      include: {
        images: true,
        tags: {
          include: {
            tag: true,
          },
        },
        category: true,
      },
    });

    return plant;
  }

  // GET /api/v1/vendor/plants
  async getVendorPlants(vendorId: string, filterDto: any) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const {
      page = 1,
      limit = 20,
      category_id,
      is_active,
      stock_status,
    } = filterDto;

    const where: Prisma.PlantWhereInput = {
      nurseryId: nursery.id,
      ...(category_id && { categoryId: category_id }),
      ...(is_active !== undefined && { isActive: is_active === true || is_active === "true" }),
      ...(stock_status === "in_stock" && { stockQuantity: { gt: 0 } }),
      ...(stock_status === "out_of_stock" && { stockQuantity: 0 }),
      ...(stock_status === "low_stock" && {
        stockQuantity: {
          lte: 5,
          gt: 0,
        },
      }),
    };

    const skip = (page - 1) * limit;

    const [plants, total] = await Promise.all([
      this.prisma.plant.findMany({
        where,
        skip,
        take: limit,
        include: {
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          category: true,
        _count: {
          select: {
              orderItems: true,
              wishlists: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.plant.count({ where }),
    ]);

    // Add inventory stats
    const plantsWithStats = plants.map((plant) => {
      const stats = {
        totalOrders: plant._count.orderItems,
        totalWishlists: plant._count.wishlists,
        stockStatus: plant.stockQuantity === 0 ? "out_of_stock" :
                    plant.stockQuantity <= 5 ? "low_stock" : "in_stock",
      };

      return {
        ...plant,
        stats,
      };
    });

    return {
      items: plantsWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /api/v1/vendor/plants/{plant_id}
  async getVendorPlant(vendorId: string, plantId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        nurseryId: nursery.id,
      },
      include: {
        images: true,
        tags: {
          include: {
            tag: true,
          },
        },
        category: true,
        _count: {
          select: {
            orderItems: true,
            wishlists: true,
          },
        },
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    // Get order stats
    const orderStats = await this.prisma.orderItem.groupBy({
      by: ["orderType"],
      where: {
        plantId: plantId,
      },
      _count: {
        orderType: true,
      },
    });

    return {
      ...plant,
      orderStats,
    };
  }

  // PUT /api/v1/vendor/plants/{plant_id}
  async updatePlant(vendorId: string, plantId: string, updateDto: any) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        nurseryId: nursery.id,
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    const updateData: Prisma.PlantUpdateInput = {};

    // Update fields
    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
      const baseSlug = this.generateSlug(updateDto.name);
      updateData.slug = await this.ensureUniqueSlug(baseSlug, nursery.id, plantId);
    }
    if (updateDto.category_id !== undefined) {
      updateData.category = {
        connect: { id: updateDto.category_id },
      };
    }
    if (updateDto.scientific_name !== undefined) updateData.scientificName = updateDto.scientific_name;
    if (updateDto.description !== undefined) updateData.description = updateDto.description;
    if (updateDto.care_instructions !== undefined) updateData.careInstructions = updateDto.care_instructions;
    if (updateDto.sunlight_requirement !== undefined) updateData.sunlightRequirement = updateDto.sunlight_requirement;
    if (updateDto.water_frequency !== undefined) updateData.waterFrequency = updateDto.water_frequency;
    if (updateDto.maintenance_level !== undefined) updateData.maintenanceLevel = updateDto.maintenance_level;
    if (updateDto.is_indoor !== undefined) updateData.isIndoor = updateDto.is_indoor;
    if (updateDto.is_pet_friendly !== undefined) updateData.isPetFriendly = updateDto.is_pet_friendly;
    if (updateDto.height_cm !== undefined) updateData.heightCm = updateDto.height_cm;
    if (updateDto.pot_included !== undefined) updateData.potIncluded = updateDto.pot_included;
    if (updateDto.rent_price_daily !== undefined) updateData.rentPriceDaily = new Decimal(updateDto.rent_price_daily);
    if (updateDto.rent_price_weekly !== undefined) updateData.rentPriceWeekly = new Decimal(updateDto.rent_price_weekly);
    if (updateDto.rent_price_monthly !== undefined) updateData.rentPriceMonthly = new Decimal(updateDto.rent_price_monthly);
    if (updateDto.buy_price !== undefined) updateData.buyPrice = new Decimal(updateDto.buy_price);
    if (updateDto.deposit_amount !== undefined) updateData.depositAmount = new Decimal(updateDto.deposit_amount);
    if (updateDto.is_available_for_rent !== undefined) updateData.isAvailableForRent = updateDto.is_available_for_rent;
    if (updateDto.is_available_for_sale !== undefined) updateData.isAvailableForSale = updateDto.is_available_for_sale;
    if (updateDto.stock_quantity !== undefined) updateData.stockQuantity = updateDto.stock_quantity;
    if (updateDto.min_rent_days !== undefined) updateData.minRentDays = updateDto.min_rent_days;
    if (updateDto.max_rent_days !== undefined) updateData.maxRentDays = updateDto.max_rent_days;
    if (updateDto.is_active !== undefined) updateData.isActive = updateDto.is_active;

    const updated = await this.prisma.plant.update({
      where: { id: plantId },
      data: updateData,
      include: {
        images: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return updated;
  }

  // DELETE /api/v1/vendor/plants/{plant_id}
  async deletePlant(vendorId: string, plantId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        nurseryId: nursery.id,
      },
      include: {
        orderItems: {
          where: {
            rentalStatus: {
              in: ["ACTIVE", "EXTENDED"],
            },
          },
        },
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    // If active rentals exist, only deactivate
    if (plant.orderItems.length > 0) {
      await this.prisma.plant.update({
        where: { id: plantId },
        data: { isActive: false },
      });
      return { message: "Plant deactivated due to active rentals" };
    }

    // Otherwise, delete
    await this.prisma.plant.delete({
      where: { id: plantId },
    });

    return { message: "Plant deleted successfully" };
  }

  // PUT /api/v1/vendor/plants/{plant_id}/stock
  async updateStock(vendorId: string, plantId: string, stockDto: any) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        nurseryId: nursery.id,
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    const { stock_quantity, adjustment } = stockDto;

    let newStock: number;
    if (stock_quantity !== undefined) {
      newStock = stock_quantity;
    } else if (adjustment !== undefined) {
      newStock = plant.stockQuantity + adjustment;
    } else {
      throw new BadRequestException("Either stock_quantity or adjustment must be provided");
    }

    if (newStock < 0) {
      throw new BadRequestException("Stock quantity cannot be negative");
    }

    const updated = await this.prisma.plant.update({
      where: { id: plantId },
      data: { stockQuantity: newStock },
    });

    return updated;
  }

  // POST /api/v1/vendor/plants/{plant_id}/images
  async addPlantImages(vendorId: string, plantId: string, imagesDto: any) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        nurseryId: nursery.id,
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    const images = await Promise.all(
      imagesDto.images.map((img: any) =>
        this.prisma.plantImage.create({
          data: {
            plantId: plantId,
            imageUrl: img.image_url,
            isPrimary: img.is_primary || false,
            displayOrder: img.display_order || 0,
          },
        })
      )
    );

    return images;
  }

  // DELETE /api/v1/vendor/plants/{plant_id}/images/{image_id}
  async deletePlantImage(vendorId: string, plantId: string, imageId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        nurseryId: nursery.id,
      },
      include: {
        images: true,
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    if (plant.images.length <= 1) {
      throw new BadRequestException("Cannot delete the only remaining image");
    }

    await this.prisma.plantImage.delete({
      where: { id: imageId },
    });

    return { message: "Image deleted successfully" };
  }

  // PUT /api/v1/vendor/plants/{plant_id}/pricing
  async updatePricing(vendorId: string, plantId: string, pricingDto: any) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        nurseryId: nursery.id,
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    const updateData: Prisma.PlantUpdateInput = {};

    if (pricingDto.rent_price_daily !== undefined) {
      updateData.rentPriceDaily = new Decimal(pricingDto.rent_price_daily);
    }
    if (pricingDto.rent_price_weekly !== undefined) {
      updateData.rentPriceWeekly = new Decimal(pricingDto.rent_price_weekly);
    }
    if (pricingDto.rent_price_monthly !== undefined) {
      updateData.rentPriceMonthly = new Decimal(pricingDto.rent_price_monthly);
    }
    if (pricingDto.buy_price !== undefined) {
      updateData.buyPrice = new Decimal(pricingDto.buy_price);
    }
    if (pricingDto.deposit_amount !== undefined) {
      updateData.depositAmount = new Decimal(pricingDto.deposit_amount);
    }

    const updated = await this.prisma.plant.update({
      where: { id: plantId },
      data: updateData,
    });

    return updated;
  }

  // PUT /api/v1/vendor/plants/bulk-update
  async bulkUpdate(vendorId: string, bulkDto: any) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const { plant_ids, updates } = bulkDto;

    // Verify all plants belong to vendor
    const plants = await this.prisma.plant.findMany({
      where: {
        id: { in: plant_ids },
        nurseryId: nursery.id,
      },
    });

    if (plants.length !== plant_ids.length) {
      throw new BadRequestException("Some plants not found or don't belong to vendor");
    }

    const updateData: Prisma.PlantUpdateInput = {};

    if (updates.is_active !== undefined) {
      updateData.isActive = updates.is_active;
    }

    if (updates.price_adjustment_percent !== undefined) {
      // This would require fetching current prices and updating
      // For now, we'll just update is_active
    }

    const result = await this.prisma.plant.updateMany({
      where: {
        id: { in: plant_ids },
        nurseryId: nursery.id,
      },
      data: updateData,
    });

    return {
      message: "Bulk update completed",
      updated_count: result.count,
    };
  }
}
