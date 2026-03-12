// src/modules/app/nurseries/nurseries.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { NurseryFilterDto } from "./dto/nursery-filter.dto";
import {
  UpdateInventoryDto,
  BulkUpdateInventoryDto,
} from "./dto/inventory.dto";
import { CreateNurseryDto } from "./dto/create-nursery.dto";
import { UpdateWorkingHoursDto } from "./dto/working-hours.dto";
import { UpdateServiceAreasDto } from "./dto/service-areas.dto";
import { AddNurseryImagesDto } from "./dto/nursery-images.dto";
import { Prisma, PrismaPromise } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class NurseriesService {
  constructor(private prisma: PrismaService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

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

  private async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.nursery.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return slug;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // ─── Create Nursery ─────────────────────────────────────────────────────────

  async createNursery(vendorId: string, createDto: CreateNurseryDto) {
    const existingNursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (existingNursery) throw new ConflictException("Vendor already has a nursery");

    const slug = await this.ensureUniqueSlug(this.generateSlug(createDto.name));

    return this.prisma.nursery.create({
      data: {
        vendorId,
        name: createDto.name,
        slug,
        description: createDto.description,
        logoUrl: createDto.logo_url,
        coverImageUrl: createDto.cover_image_url,
        addressLine1: createDto.address_line1,
        addressLine2: createDto.address_line2,
        city: createDto.city,
        state: createDto.state,
        pincode: createDto.pincode,
        latitude: createDto.latitude ? new Decimal(createDto.latitude) : null,
        longitude: createDto.longitude ? new Decimal(createDto.longitude) : null,
        serviceRadiusKm: createDto.service_radius_km || 10,
        phone: createDto.phone,
        email: createDto.email,
        isVerified: false,
      },
      include: { workingHours: true, images: true, serviceAreas: true },
    });
  }

  // ─── Browse All Nurseries ───────────────────────────────────────────────────

  async findAllNurseries(filterDto: any) {
    const {
      page = 1, limit = 20, city, state, pincode,
      latitude, longitude, radius_km, rating_min, is_verified, sort_by = "rating",
    } = filterDto;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const parsedRatingMin = rating_min ? Number(rating_min) : undefined;
    const parsedLatitude = latitude ? Number(latitude) : undefined;
    const parsedLongitude = longitude ? Number(longitude) : undefined;
    const parsedRadiusKm = radius_km ? Number(radius_km) : undefined;
    const parsedIsVerified =
      is_verified === "true" ? true : is_verified === "false" ? false : undefined;

    const where: Prisma.NurseryWhereInput = {
      isActive: true,
      ...(parsedIsVerified !== undefined && { isVerified: parsedIsVerified }),
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(state && { state: { contains: state, mode: "insensitive" } }),
      ...(pincode && {
        OR: [
          { pincode: { contains: pincode } },
          { serviceAreas: { some: { pincode: { contains: pincode } } } },
        ],
      }),
      ...(parsedRatingMin !== undefined && {
        ratingAvg: { gte: new Decimal(parsedRatingMin) },
      }),
    };

    let orderBy: Prisma.NurseryOrderByWithRelationInput = {};
    switch (sort_by) {
      case "rating": orderBy = { ratingAvg: "desc" }; break;
      case "name":   orderBy = { name: "asc" }; break;
      default:       orderBy = { ratingAvg: "desc" };
    }

    const skip = (parsedPage - 1) * parsedLimit;
    const [nurseries, total] = await Promise.all([
      this.prisma.nursery.findMany({
        where,
        orderBy,
        skip,
        take: parsedLimit,
        include: {
          workingHours: true,
          images: { orderBy: { displayOrder: "asc" }, take: 3 },
          _count: { select: { plants: true, orders: true } },
        },
      }),
      this.prisma.nursery.count({ where }),
    ]);

    let result = nurseries
      .map((nursery) => {
        const data: any = { ...nursery };
        if (parsedLatitude && parsedLongitude && nursery.latitude && nursery.longitude) {
          const distance = this.calculateDistance(
            parsedLatitude, parsedLongitude,
            Number(nursery.latitude), Number(nursery.longitude)
          );
          data.distance = distance;
          if (parsedRadiusKm && distance > parsedRadiusKm) return null;
        }
        return data;
      })
      .filter(Boolean);

    if (sort_by === "distance" && parsedLatitude && parsedLongitude) {
      result.sort((a, b) => (!a.distance ? 1 : !b.distance ? -1 : a.distance - b.distance));
    }

    return {
      items: result,
      pagination: { page: parsedPage, limit: parsedLimit, total, totalPages: Math.ceil(total / parsedLimit) },
    };
  }

  // ─── Find by ID ─────────────────────────────────────────────────────────────

  async findById(id: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { id },
      include: {
        workingHours: { orderBy: { dayOfWeek: "asc" } },
        images: { orderBy: { displayOrder: "asc" } },
        serviceAreas: true,
        vendor: { select: { id: true, fullName: true, email: true, phone: true } },
        _count: { select: { plants: true, orders: true, gardeners: true } },
      },
    });
    if (!nursery || !nursery.isActive) throw new NotFoundException("Nursery not found");
    return nursery;
  }

  // ─── Find by Slug ───────────────────────────────────────────────────────────

  async findBySlug(slug: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { slug },
      include: {
        workingHours: { orderBy: { dayOfWeek: "asc" } },
        images: { orderBy: { displayOrder: "asc" } },
        serviceAreas: true,
        _count: { select: { plants: true, orders: true, gardeners: true } },
      },
    });
    if (!nursery || !nursery.isActive) throw new NotFoundException("Nursery not found");
    return nursery;
  }

  // ─── Get My Nursery ─────────────────────────────────────────────────────────

  async getMyNursery(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
      include: {
        workingHours: { orderBy: { dayOfWeek: "asc" } },
        images: { orderBy: { displayOrder: "asc" } },
        serviceAreas: true,
        plants: { take: 10, orderBy: { createdAt: "desc" } },
        gardeners: {
          include: { user: { select: { id: true, fullName: true, phone: true } } },
        },
        _count: { select: { plants: true, orders: true, gardeners: true } },
      },
    });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const analytics = await this.getNurseryAnalytics(nursery.id);
    return { ...nursery, analytics };
  }

  // ─── Update My Nursery ──────────────────────────────────────────────────────

  async updateMyNursery(vendorId: string, updateDto: Partial<CreateNurseryDto>) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const updateData: Prisma.NurseryUpdateInput = {};
    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
      updateData.slug = await this.ensureUniqueSlug(this.generateSlug(updateDto.name), nursery.id);
    }
    if (updateDto.description !== undefined) updateData.description = updateDto.description;
    if (updateDto.logo_url !== undefined) updateData.logoUrl = updateDto.logo_url;
    if (updateDto.cover_image_url !== undefined) updateData.coverImageUrl = updateDto.cover_image_url;
    if (updateDto.address_line1 !== undefined) updateData.addressLine1 = updateDto.address_line1;
    if (updateDto.address_line2 !== undefined) updateData.addressLine2 = updateDto.address_line2;
    if (updateDto.city !== undefined) updateData.city = updateDto.city;
    if (updateDto.state !== undefined) updateData.state = updateDto.state;
    if (updateDto.pincode !== undefined) updateData.pincode = updateDto.pincode;
    if (updateDto.latitude !== undefined) updateData.latitude = new Decimal(updateDto.latitude);
    if (updateDto.longitude !== undefined) updateData.longitude = new Decimal(updateDto.longitude);
    if (updateDto.service_radius_km !== undefined) updateData.serviceRadiusKm = updateDto.service_radius_km;
    if (updateDto.phone !== undefined) updateData.phone = updateDto.phone;
    if (updateDto.email !== undefined) updateData.email = updateDto.email;

    return this.prisma.nursery.update({
      where: { id: nursery.id },
      data: updateData,
      include: { workingHours: true, images: true, serviceAreas: true },
    });
  }

  // ─── Images ─────────────────────────────────────────────────────────────────

  async addImages(vendorId: string, addImagesDto: AddNurseryImagesDto) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    return Promise.all(
      addImagesDto.images.map((img) =>
        this.prisma.nurseryImage.create({
          data: { nurseryId: nursery.id, imageUrl: img.image_url, displayOrder: img.display_order },
        })
      )
    );
  }

  async deleteImage(vendorId: string, imageId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const image = await this.prisma.nurseryImage.findFirst({
      where: { id: imageId, nurseryId: nursery.id },
    });
    if (!image) throw new NotFoundException("Image not found");
    await this.prisma.nurseryImage.delete({ where: { id: imageId } });
    return { message: "Image deleted successfully" };
  }

  // ─── Working Hours ──────────────────────────────────────────────────────────

  async updateWorkingHours(vendorId: string, updateDto: UpdateWorkingHoursDto) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    await this.prisma.nurseryWorkingHours.deleteMany({ where: { nurseryId: nursery.id } });
    return Promise.all(
      updateDto.working_hours.map((wh) =>
        this.prisma.nurseryWorkingHours.create({
          data: {
            nurseryId: nursery.id,
            dayOfWeek: wh.day_of_week,
            openTime: wh.open_time,
            closeTime: wh.close_time,
            isClosed: wh.is_closed || false,
          },
        })
      )
    );
  }

  async getWorkingHours(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    return this.prisma.nurseryWorkingHours.findMany({
      where: { nurseryId: nursery.id },
      orderBy: { dayOfWeek: "asc" },
    });
  }

  // ─── Service Areas ──────────────────────────────────────────────────────────

  async updateServiceAreas(vendorId: string, updateDto: UpdateServiceAreasDto) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    await this.prisma.nurseryServiceArea.deleteMany({ where: { nurseryId: nursery.id } });

    const ops: Promise<any>[] = [];
    if (updateDto.pincodes?.length) {
      for (const pincode of updateDto.pincodes) {
        ops.push(this.prisma.nurseryServiceArea.create({ data: { nurseryId: nursery.id, pincode } }));
      }
    }
    if (updateDto.cities?.length) {
      for (const city of updateDto.cities) {
        ops.push(this.prisma.nurseryServiceArea.create({ data: { nurseryId: nursery.id, pincode: city, city } }));
      }
    }
    return Promise.all(ops);
  }

  async getServiceAreas(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    return this.prisma.nurseryServiceArea.findMany({ where: { nurseryId: nursery.id } });
  }

  // ─── Nursery Plants ─────────────────────────────────────────────────────────

  async getNurseryPlants(nurseryId: string, filterDto: any) {
    const {
      page = 1, limit = 20, category_id, maintenance_level,
      price_min, price_max, is_indoor, available_for, sort_by = "rating",
    } = filterDto;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const andConditions: Prisma.PlantWhereInput[] = [];

    if (price_min) {
      andConditions.push({
        OR: [
          { rentPriceMonthly: { gte: new Decimal(Number(price_min)) } },
          { buyPrice: { gte: new Decimal(Number(price_min)) } },
        ],
      });
    }
    if (price_max) {
      andConditions.push({
        OR: [
          { rentPriceMonthly: { lte: new Decimal(Number(price_max)) } },
          { buyPrice: { lte: new Decimal(Number(price_max)) } },
        ],
      });
    }

    const where: Prisma.PlantWhereInput = {
      nurseryId,
      isActive: true,
      ...(category_id && { categoryId: category_id }),
      ...(maintenance_level && { maintenanceLevel: maintenance_level }),
      ...(is_indoor !== undefined && { isIndoor: is_indoor === true || is_indoor === "true" }),
      ...(available_for === "RENT" && { isAvailableForRent: true }),
      ...(available_for === "BUY" && { isAvailableForSale: true }),
      ...(andConditions.length > 0 && { AND: andConditions }),
    };

    let orderBy: Prisma.PlantOrderByWithRelationInput = {};
    switch (sort_by) {
      case "price":      orderBy = { buyPrice: "asc" }; break;
      case "rating":     orderBy = { ratingAvg: "desc" }; break;
      case "popularity": orderBy = { totalRentals: "desc" }; break;
      default:           orderBy = { createdAt: "desc" };
    }

    const skip = (parsedPage - 1) * parsedLimit;
    const [plants, total] = await Promise.all([
      this.prisma.plant.findMany({
        where, orderBy, skip, take: parsedLimit,
        include: { images: { where: { isPrimary: true }, take: 1 }, category: true },
      }),
      this.prisma.plant.count({ where }),
    ]);

    return {
      items: plants,
      pagination: { page: parsedPage, limit: parsedLimit, total, totalPages: Math.ceil(total / parsedLimit) },
    };
  }

  // ─── Nursery Reviews ────────────────────────────────────────────────────────

  async getNurseryReviews(nurseryId: string, filterDto: any) {
    const { page = 1, limit = 20, rating } = filterDto;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    const where: Prisma.ReviewWhereInput = {
      reviewableType: "NURSERY",
      reviewableId: nurseryId,
      isActive: true,
      ...(rating && { rating: Number(rating) }),
    };

    const skip = (parsedPage - 1) * parsedLimit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where, skip, take: parsedLimit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } }, images: true },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: reviews,
      pagination: { page: parsedPage, limit: parsedLimit, total, totalPages: Math.ceil(total / parsedLimit) },
    };
  }

  // ─── Check Serviceability ───────────────────────────────────────────────────

  async checkServiceability(nurseryId: string, pincode: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { id: nurseryId },
      include: { serviceAreas: true },
    });
    if (!nursery || !nursery.isActive) return { serviceable: false };
    if (nursery.pincode === pincode) return { serviceable: true };
    const serviceable = nursery.serviceAreas.some(
      (area) => area.pincode === pincode || area.city === pincode
    );
    return { serviceable };
  }

  // ─── Gardeners ──────────────────────────────────────────────────────────────

  async getAssignedGardeners(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    return this.prisma.gardener.findMany({
      where: { nurseryId: nursery.id },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true } },
        _count: { select: { serviceBookings: true, maintenanceTasks: true } },
      },
    });
  }

  // ─── Invitation System ──────────────────────────────────────────────────────

  async inviteGardener(vendorId: string, gardenerId: string, message?: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const gardener = await this.prisma.gardener.findUnique({ where: { id: gardenerId } });
    if (!gardener) throw new NotFoundException("Gardener not found");

    if (gardener.nurseryId === nursery.id) {
      throw new ConflictException("Gardener is already assigned to this nursery");
    }

    // Check for existing pending invitation
    const existingInvitation = await this.prisma.nurseryInvitation.findFirst({
      where: { nurseryId: nursery.id, gardenerId, status: "PENDING" },
    });
    if (existingInvitation) {
      throw new ConflictException("A pending invitation already exists for this gardener");
    }

    const invitation = await this.prisma.nurseryInvitation.create({
      data: {
        nurseryId: nursery.id,
        gardenerId,
        status: "PENDING",
        message: message || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: {
        gardener: {
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
        nursery: { select: { id: true, name: true } },
      },
    });

    return { message: "Invitation sent successfully", invitation };
  }

  async getNurseryInvitations(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    return this.prisma.nurseryInvitation.findMany({
      where: { nurseryId: nursery.id },
      orderBy: { createdAt: "desc" },
      include: {
        gardener: {
          include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
        },
      },
    });
  }

  async removeGardener(vendorId: string, gardenerId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const gardener = await this.prisma.gardener.findFirst({
      where: { id: gardenerId, nurseryId: nursery.id },
    });
    if (!gardener) throw new NotFoundException("Gardener not assigned to this nursery");

    await this.prisma.gardener.update({
      where: { id: gardenerId },
      data: { nurseryId: null },
    });

    return { message: "Gardener removed successfully" };
  }

  // ─── Private Analytics ──────────────────────────────────────────────────────

  private async getNurseryAnalytics(nurseryId: string) {
    const [totalOrders, totalRevenue, totalPlants, activeRentals] = await Promise.all([
      this.prisma.order.count({ where: { nurseryId } }),
      this.prisma.order.aggregate({ where: { nurseryId }, _sum: { totalAmount: true } }),
      this.prisma.plant.count({ where: { nurseryId, isActive: true } }),
      this.prisma.orderItem.count({ where: { order: { nurseryId }, rentalStatus: "ACTIVE" } }),
    ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalPlants,
      activeRentals,
    };
  }

  // ─── Legacy findAll (internal NurseryFilterDto usage) ───────────────────────

  async findAll(filterDto: NurseryFilterDto) {
    const {
      page = 1, limit = 20, city, state, search, minRating,
      isVerified, isActive = true, sortBy = "rating", sortOrder = "desc",
      latitude, longitude, serviceAreas,
    } = filterDto;

    const where: Prisma.NurseryWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(isVerified !== undefined && { isVerified }),
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(state && { state: { contains: state, mode: "insensitive" } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(minRating && { ratingAvg: { gte: new Decimal(minRating) } }),
      ...(serviceAreas?.length && {
        serviceAreas: { some: { pincode: { in: serviceAreas } } },
      }),
    };

    let orderBy: Prisma.NurseryOrderByWithRelationInput = {};
    switch (sortBy) {
      case "name":         orderBy = { name: sortOrder }; break;
      case "rating":       orderBy = { ratingAvg: sortOrder }; break;
      case "totalReviews": orderBy = { totalReviews: sortOrder }; break;
      default:             orderBy = { createdAt: sortOrder };
    }

    const skip = (page - 1) * limit;
    const [nurseries, total] = await this.prisma.$transaction([
      this.prisma.nursery.findMany({
        where, orderBy, skip, take: limit,
        include: { _count: { select: { plants: true } }, serviceAreas: true },
      }),
      this.prisma.nursery.count({ where }),
    ]);

    const nurseriesWithDistance = nurseries.map((n) => {
      const data: any = { ...n, totalPlants: n._count.plants };
      if (latitude && longitude && n.latitude && n.longitude) {
        data.distance = this.calculateDistance(latitude, longitude, Number(n.latitude), Number(n.longitude));
      }
      delete data._count;
      return data;
    });

    if (sortBy === "distance" && latitude && longitude) {
      nurseriesWithDistance.sort((a, b) =>
        !a.distance ? 1 : !b.distance ? -1 :
        sortOrder === "asc" ? a.distance - b.distance : b.distance - a.distance
      );
    }

    return {
      data: nurseriesWithDistance,
      total, page, limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrevious: page > 1,
    };
  }
}