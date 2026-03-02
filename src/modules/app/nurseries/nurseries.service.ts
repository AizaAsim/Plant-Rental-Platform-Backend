// src/modules/app/nurseries/nurseries.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
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

  // Helper function to calculate distance between two coordinates
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
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
    return R * c; // Distance in km
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

      if (!existing || existing.id === excludeId) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async findAll(filterDto: NurseryFilterDto) {
    const {
      page = 1,
      limit = 20,
      city,
      state,
      search,
      minRating,
      maxDeliveryRange,
      isVerified,
      isActive = true,
      sortBy = "rating",
      sortOrder = "desc",
      latitude,
      longitude,
      serviceAreas,
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
      ...(minRating && { ratingAvg: { gte: minRating } }),
      ...(serviceAreas &&
        serviceAreas.length > 0 && {
          serviceAreas: {
            some: {
              pincode: { in: serviceAreas },
            },
          },
        }),
    };

    // Build orderBy
    let orderBy: Prisma.NurseryOrderByWithRelationInput = {};
    switch (sortBy) {
      case "name":
        orderBy = { name: sortOrder };
        break;
      case "rating":
        orderBy = { ratingAvg: sortOrder };
        break;
      case "totalReviews":
        orderBy = { totalReviews: sortOrder };
        break;
      case "distance":
        // Distance sorting will be handled after fetching
        orderBy = { createdAt: sortOrder };
        break;
      default:
        orderBy = { createdAt: sortOrder };
    }

    const skip = (page - 1) * limit;

    const [nurseries, total] = await this.prisma.$transaction([
      this.prisma.nursery.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              plants: true,
            },
          },
          serviceAreas: true,
        },
      }),
      this.prisma.nursery.count({ where }),
    ]);

    // Calculate distance if user coordinates provided
    let nurseriesWithDistance = nurseries.map((nursery) => {
      const nurseryData: any = {
        ...nursery,
        totalPlants: nursery._count.plants,
        totalOrders: 0, // Would need to calculate from orders
      };

      if (latitude && longitude && nursery.latitude && nursery.longitude) {
        nurseryData.distance = this.calculateDistance(
          latitude,
          longitude,
          Number(nursery.latitude),
          Number(nursery.longitude)
        );
      }

      delete nurseryData._count;
      return nurseryData;
    });

    // Sort by distance if requested and coordinates provided
    if (sortBy === "distance" && latitude && longitude) {
      nurseriesWithDistance.sort((a, b) => {
        if (!a.distance) return 1;
        if (!b.distance) return -1;
        return sortOrder === "asc"
          ? a.distance - b.distance
          : b.distance - a.distance;
      });
    }

    const totalPages = Math.ceil(total / limit);

    return {
      data: nurseriesWithDistance,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async findById(id: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { id },
      include: {
        workingHours: {
          orderBy: { dayOfWeek: "asc" },
        },
        images: {
          orderBy: { displayOrder: "asc" },
        },
        serviceAreas: true,
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: {
            plants: true,
            orders: true,
            gardeners: true,
          },
        },
      },
    });

    if (!nursery || !nursery.isActive) {
      throw new NotFoundException("Nursery not found");
    }

    return nursery;
  }

  async getPlantsByNurseryId(nurseryId: string, filterDto: any) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { id: nurseryId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const {
      page = 1,
      limit = 20,
      category,
      size,
      careLevel,
      available,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filterDto;

    const where: Prisma.PlantWhereInput = {
      nurseryId,
      isActive: true,
      ...(category && { category }),
      ...(size && { size }),
      ...(careLevel && { careLevel }),
      ...(available && { availableStock: { gt: 0 } }),
    };

    // Build orderBy
    let orderBy: Prisma.PlantOrderByWithRelationInput = {};
    switch (sortBy) {
      case "price":
        orderBy = { buyPrice: sortOrder };
        break;
      case "rentalPrice":
        orderBy = { rentPriceMonthly: sortOrder };
        break;
      case "name":
        orderBy = { name: sortOrder };
        break;
      default:
        orderBy = { createdAt: sortOrder };
    }

    const skip = (page - 1) * limit;

    const [plants, total] = await this.prisma.$transaction([
      this.prisma.plant.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      }),
      this.prisma.plant.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      nursery: {
        id: nursery.id,
        name: nursery.name,
        logoUrl: nursery.logoUrl,
      },
      data: plants,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async getInventory(nurseryId: string, userId?: string) {
    // Verify nursery exists
    const nursery = await this.prisma.nursery.findUnique({
      where: { id: nurseryId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    // Get all plants for this nursery with inventory details
    const plants = await this.prisma.plant.findMany({
      where: { nurseryId },
      include: {
        _count: {
          select: {
            orderItems: {
              where: {
                orderType: "RENT",
                rentalStatus: {
                  in: ["ACTIVE", "EXTENDED"],
                },
              },
            },
            cartItems: true,
          },
        },
      },
      orderBy: {
        stockQuantity: "asc", // Show low stock items first
      },
    });

    const inventory = plants.map((plant) => {
      const reservedStock = plant._count.cartItems;
      const inRental = plant._count.orderItems;
      const actualAvailable = Math.max(0, plant.stockQuantity - reservedStock);

      const lowStockThreshold = Math.ceil(plant.stockQuantity * 0.2); // 20% threshold
      const isLowStock =
        actualAvailable <= lowStockThreshold && actualAvailable > 0;

      return {
        plantId: plant.id,
        plantName: plant.name,
        categoryId: plant.categoryId,
        totalStock: plant.stockQuantity,
        availableStock: plant.stockQuantity,
        reservedStock,
        inRental,
        actualAvailable,
        buyPrice: plant.buyPrice,
        rentPriceMonthly: plant.rentPriceMonthly,
        isActive: plant.isActive,
        lowStockThreshold,
        isLowStock,
        status:
          actualAvailable === 0
            ? "OUT_OF_STOCK"
            : isLowStock
              ? "LOW_STOCK"
              : "IN_STOCK",
      };
    });

    return {
      nurseryId,
      nurseryName: nursery.name,
      inventory,
      summary: {
        totalProducts: inventory.length,
        totalStock: inventory.reduce((sum, item) => sum + item.totalStock, 0),
        availableStock: inventory.reduce(
          (sum, item) => sum + item.actualAvailable,
          0
        ),
        lowStockItems: inventory.filter((item) => item.isLowStock).length,
        outOfStockItems: inventory.filter(
          (item) => item.status === "OUT_OF_STOCK"
        ).length,
      },
      lastUpdated: new Date(),
    };
  }

  async updateInventory(
    nurseryId: string,
    updateDto: UpdateInventoryDto | BulkUpdateInventoryDto,
    userId: string
  ) {
    // Verify nursery exists and user has permission
    const nursery = await this.prisma.nursery.findUnique({
      where: { id: nurseryId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    // Check if bulk update
    const updates =
      "updates" in updateDto
        ? updateDto.updates
        : [updateDto as UpdateInventoryDto];

    const updateOperations = updates.map((update) =>
      this.prisma.plant.update({
        where: {
          id: update.plantId,
          nurseryId: nurseryId, // Ensure plant belongs to nursery
        },
        data: {
          ...(update.totalStock !== undefined && {
            totalStock: update.totalStock,
          }),
          ...(update.availableStock !== undefined && {
            availableStock: update.availableStock,
          }),
          ...(update.purchasePrice !== undefined && {
            purchasePrice: update.purchasePrice,
          }),
          ...(update.rentalPrice !== undefined && {
            rentalPrice: update.rentalPrice,
          }),
          ...(update.isActive !== undefined && { isActive: update.isActive }),
        },
      })
    );

    try {
      const updatedPlantsResult = await this.prisma.$transaction(
        // The type `PrismaPromise<any>[]` is correct for the transaction argument.
        updateOperations as PrismaPromise<any>[]
      );

      return {
        message: "Inventory updated successfully",
        updatedCount: updatedPlantsResult.length,
        updatedPlants: updatedPlantsResult.map((p: any) => ({
          plantId: p.id,
          plantName: p.name,
          totalStock: p.totalStock,
          availableStock: p.availableStock,
        })),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2025: Record not found (e.g., plantId or nurseryId mismatch)
        if (error.code === "P2025") {
          throw new NotFoundException(
            "One or more plants not found in this nursery."
          );
        }
      }
      throw error;
    }
  }

  async getAvailability(nurseryId: string, date?: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { id: nurseryId },
      include: {
        plants: {
          where: { isActive: true },
          include: {
            orderItems: {
              where: {
                orderType: "RENT",
                rentalStatus: {
                  in: ["ACTIVE", "EXTENDED"],
                },
                ...(date && {
                  AND: [
                    { rentStartDate: { lte: new Date(date) } },
                    { rentEndDate: { gte: new Date(date) } },
                  ],
                }),
              },
              select: {
                id: true,
                rentStartDate: true,
                rentEndDate: true,
              },
            },
            cartItems: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                },
              },
            },
          },
        },
      },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    // Check if nursery is currently open
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    // Simple logic - can be enhanced with actual working hours from DB
    const isOpen =
      dayOfWeek !== 0 && // Not Sunday
      hour >= 9 &&
      hour < 20; // Between 9 AM and 8 PM

    const plantsAvailability = nursery.plants.map((plant) => {
      const reservedInRentals = plant.orderItems?.length || 0;
      const reservedInCarts = plant.cartItems?.length || 0;
      const totalReserved = reservedInRentals + reservedInCarts;
      const availableQuantity = Math.max(
        0,
        plant.stockQuantity - totalReserved
      );

      // Determine status
      let status: string;
      if (availableQuantity === 0) {
        status = "OUT_OF_STOCK";
      } else if (availableQuantity <= Math.ceil(plant.stockQuantity * 0.2)) {
        status = "LOW_STOCK";
      } else {
        status = "IN_STOCK";
      }

      // Calculate next available dates (simplified)
      const availableDates: string[] = [];
      const checkDate = new Date();
      for (let i = 0; i < 7; i++) {
        const dateStr = checkDate.toISOString().split("T")[0];
        const conflictingRentals = (plant.orderItems || []).filter((item: any) => {
          return (
            item.rentStartDate && item.rentEndDate &&
            new Date(item.rentStartDate) <= checkDate &&
            new Date(item.rentEndDate) >= checkDate
          );
        });

        if (plant.stockQuantity - conflictingRentals.length > 0) {
          availableDates.push(dateStr);
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }

      return {
        plantId: plant.id,
        plantName: plant.name,
        isAvailable: availableQuantity > 0,
        availableQuantity,
        reservedQuantity: totalReserved,
        inRentalQuantity: reservedInRentals,
        status,
        availableDates,
        nextRestockDate:
          availableQuantity === 0
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0]
            : undefined,
      };
    });

    return {
      nurseryId: nursery.id,
      nurseryName: nursery.name,
      plants: plantsAvailability,
      lastUpdated: new Date(),
      isOpen,
      currentStatus: isOpen
        ? `Open until ${dayOfWeek === 6 ? "6:00 PM" : "8:00 PM"}`
        : "Closed",
      summary: {
        totalPlants: plantsAvailability.length,
        availablePlants: plantsAvailability.filter((p) => p.isAvailable).length,
        outOfStock: plantsAvailability.filter(
          (p) => p.status === "OUT_OF_STOCK"
        ).length,
        lowStock: plantsAvailability.filter((p) => p.status === "LOW_STOCK")
          .length,
      },
    };
  }

  // Create Nursery
  async createNursery(vendorId: string, createDto: CreateNurseryDto) {
    // Check if vendor already has a nursery
    const existingNursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (existingNursery) {
      throw new ConflictException("Vendor already has a nursery");
    }

    // Generate slug
    const baseSlug = this.generateSlug(createDto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const nursery = await this.prisma.nursery.create({
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
      include: {
        workingHours: true,
        images: true,
        serviceAreas: true,
      },
    });

    return nursery;
  }

  // Update findAll to match specifications
  async findAllNurseries(filterDto: any) {
    const {
      page = 1,
      limit = 20,
      city,
      state,
      pincode,
      latitude,
      longitude,
      radius_km,
      rating_min,
      is_verified,
      sort_by = "rating",
    } = filterDto;

    const where: Prisma.NurseryWhereInput = {
      isActive: true,
      ...(is_verified !== undefined && { isVerified: is_verified === true || is_verified === "true" }),
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(state && { state: { contains: state, mode: "insensitive" } }),
      ...(pincode && {
        OR: [
          { pincode: { contains: pincode } },
          {
            serviceAreas: {
              some: {
                pincode: { contains: pincode },
              },
            },
          },
        ],
      }),
      ...(rating_min && {
        ratingAvg: { gte: new Decimal(rating_min) },
      }),
    };

    // Location-based filtering
    if (latitude && longitude && radius_km) {
      // This would require a more complex query with distance calculation
      // For now, we'll filter after fetching
    }

    let orderBy: Prisma.NurseryOrderByWithRelationInput = {};
    switch (sort_by) {
      case "rating":
        orderBy = { ratingAvg: "desc" };
        break;
      case "distance":
        orderBy = { createdAt: "desc" }; // Will sort after fetching
        break;
      case "name":
        orderBy = { name: "asc" };
        break;
      default:
        orderBy = { ratingAvg: "desc" };
    }

    const skip = (page - 1) * limit;

    const [nurseries, total] = await Promise.all([
      this.prisma.nursery.findMany({
        where: {
          ...where,
          isVerified: is_verified !== false, // Only verified by default
        },
        orderBy,
        skip,
        take: limit,
        include: {
          workingHours: true,
          images: {
            orderBy: { displayOrder: "asc" },
            take: 3,
          },
          _count: {
            select: {
              plants: true,
              orders: true,
            },
          },
        },
      }),
      this.prisma.nursery.count({
        where: {
          ...where,
          isVerified: is_verified !== false,
        },
      }),
    ]);

    // Calculate distance and filter by radius if provided
    let nurseriesWithDistance = nurseries.map((nursery) => {
      const data: any = { ...nursery };

      if (latitude && longitude && nursery.latitude && nursery.longitude) {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          Number(nursery.latitude),
          Number(nursery.longitude)
        );
        data.distance = distance;

        // Filter by radius if provided
        if (radius_km && distance > radius_km) {
          return null;
        }
      }

      return data;
    }).filter(Boolean);

    // Sort by distance if requested
    if (sort_by === "distance" && latitude && longitude) {
      nurseriesWithDistance.sort((a, b) => {
        if (!a.distance) return 1;
        if (!b.distance) return -1;
        return a.distance - b.distance;
      });
    }

    return {
      items: nurseriesWithDistance,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get by slug
  async findBySlug(slug: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { slug },
      include: {
        workingHours: {
          orderBy: { dayOfWeek: "asc" },
        },
        images: {
          orderBy: { displayOrder: "asc" },
        },
        serviceAreas: true,
        _count: {
          select: {
            plants: true,
            orders: true,
            gardeners: true,
          },
        },
      },
    });

    if (!nursery || !nursery.isActive) {
      throw new NotFoundException("Nursery not found");
    }

    return nursery;
  }

  // Get vendor's own nursery
  async getMyNursery(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
      include: {
        workingHours: {
          orderBy: { dayOfWeek: "asc" },
        },
        images: {
          orderBy: { displayOrder: "asc" },
        },
        serviceAreas: true,
        plants: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        gardeners: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
        _count: {
          select: {
            plants: true,
            orders: true,
            gardeners: true,
          },
        },
      },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    // Get analytics
    const analytics = await this.getNurseryAnalytics(nursery.id);

    return {
      ...nursery,
      analytics,
    };
  }

  // Update nursery
  async updateMyNursery(vendorId: string, updateDto: Partial<CreateNurseryDto>) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const updateData: Prisma.NurseryUpdateInput = {};

    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
      // Regenerate slug if name changed
      const baseSlug = this.generateSlug(updateDto.name);
      updateData.slug = await this.ensureUniqueSlug(baseSlug, nursery.id);
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

    const updated = await this.prisma.nursery.update({
      where: { id: nursery.id },
      data: updateData,
      include: {
        workingHours: true,
        images: true,
        serviceAreas: true,
      },
    });

    return updated;
  }

  // Add images
  async addImages(vendorId: string, addImagesDto: AddNurseryImagesDto) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const images = await Promise.all(
      addImagesDto.images.map((img) =>
        this.prisma.nurseryImage.create({
          data: {
            nurseryId: nursery.id,
            imageUrl: img.image_url,
            displayOrder: img.display_order,
          },
        })
      )
    );

    return images;
  }

  // Delete image
  async deleteImage(vendorId: string, imageId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const image = await this.prisma.nurseryImage.findFirst({
      where: {
        id: imageId,
        nurseryId: nursery.id,
      },
    });

    if (!image) {
      throw new NotFoundException("Image not found");
    }

    await this.prisma.nurseryImage.delete({
      where: { id: imageId },
    });

    return { message: "Image deleted successfully" };
  }

  // Update working hours
  async updateWorkingHours(vendorId: string, updateDto: UpdateWorkingHoursDto) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    // Delete existing working hours
    await this.prisma.nurseryWorkingHours.deleteMany({
      where: { nurseryId: nursery.id },
    });

    // Create new working hours
    const workingHours = await Promise.all(
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

    return workingHours;
  }

  // Get working hours
  async getWorkingHours(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const workingHours = await this.prisma.nurseryWorkingHours.findMany({
      where: { nurseryId: nursery.id },
      orderBy: { dayOfWeek: "asc" },
    });

    return workingHours;
  }

  // Update service areas
  async updateServiceAreas(vendorId: string, updateDto: UpdateServiceAreasDto) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    // Delete existing service areas
    await this.prisma.nurseryServiceArea.deleteMany({
      where: { nurseryId: nursery.id },
    });

    // Create new service areas
    const serviceAreas = [];

    if (updateDto.pincodes && updateDto.pincodes.length > 0) {
      for (const pincode of updateDto.pincodes) {
        serviceAreas.push(
          this.prisma.nurseryServiceArea.create({
            data: {
              nurseryId: nursery.id,
              pincode,
            },
          })
        );
      }
    }

    if (updateDto.cities && updateDto.cities.length > 0) {
      for (const city of updateDto.cities) {
        // For cities, we might need to get pincodes for that city
        // For now, we'll just store the city name
        serviceAreas.push(
          this.prisma.nurseryServiceArea.create({
            data: {
              nurseryId: nursery.id,
              pincode: "", // Empty pincode for city-based service
              city,
            },
          })
        );
      }
    }

    const created = await Promise.all(serviceAreas);

    return created;
  }

  // Get service areas
  async getServiceAreas(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const serviceAreas = await this.prisma.nurseryServiceArea.findMany({
      where: { nurseryId: nursery.id },
    });

    return serviceAreas;
  }

  // Get nursery plants (updated to match specifications)
  async getNurseryPlants(nurseryId: string, filterDto: any) {
    const {
      page = 1,
      limit = 20,
      category_id,
      maintenance_level,
      price_min,
      price_max,
      is_indoor,
      available_for,
      sort_by = "rating",
    } = filterDto;

    const where: Prisma.PlantWhereInput = {
      nurseryId,
      isActive: true,
      ...(category_id && { categoryId: category_id }),
      ...(maintenance_level && { maintenanceLevel: maintenance_level }),
      ...(is_indoor !== undefined && { isIndoor: is_indoor === true || is_indoor === "true" }),
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
    };

    let orderBy: Prisma.PlantOrderByWithRelationInput = {};
    switch (sort_by) {
      case "price":
        orderBy = { buyPrice: "asc" };
        break;
      case "rating":
        orderBy = { ratingAvg: "desc" };
        break;
      case "popularity":
        orderBy = { totalRentals: "desc" };
        break;
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
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          category: true,
        },
      }),
      this.prisma.plant.count({ where }),
    ]);

    return {
      items: plants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get nursery reviews
  async getNurseryReviews(nurseryId: string, filterDto: any) {
    const { page = 1, limit = 20, rating } = filterDto;

    const where: Prisma.ReviewWhereInput = {
      reviewableType: "NURSERY",
      reviewableId: nurseryId,
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

  // Get assigned gardeners
  async getAssignedGardeners(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const gardeners = await this.prisma.gardener.findMany({
      where: { nurseryId: nursery.id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            serviceBookings: true,
            maintenanceTasks: true,
          },
        },
      },
    });

    return gardeners;
  }

  // Assign gardener
  async assignGardener(vendorId: string, gardenerId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const gardener = await this.prisma.gardener.findUnique({
      where: { id: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener not found");
    }

    // Check if already assigned
    if (gardener.nurseryId === nursery.id) {
      throw new ConflictException("Gardener already assigned to this nursery");
    }

    // Update gardener's nursery assignment
    await this.prisma.gardener.update({
      where: { id: gardenerId },
      data: { nurseryId: nursery.id },
    });

    // TODO: Send invitation notification to gardener

    return { message: "Gardener assigned successfully" };
  }

  // Remove gardener
  async removeGardener(vendorId: string, gardenerId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const gardener = await this.prisma.gardener.findFirst({
      where: {
        id: gardenerId,
        nurseryId: nursery.id,
      },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener not assigned to this nursery");
    }

    await this.prisma.gardener.update({
      where: { id: gardenerId },
      data: { nurseryId: null },
    });

    return { message: "Gardener removed successfully" };
  }

  // Check serviceability
  async checkServiceability(nurseryId: string, pincode: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { id: nurseryId },
      include: {
        serviceAreas: true,
      },
    });

    if (!nursery || !nursery.isActive) {
      return { serviceable: false };
    }

    // Check if pincode matches nursery pincode
    if (nursery.pincode === pincode) {
      return { serviceable: true };
    }

    // Check if pincode is in service areas
    const serviceable = nursery.serviceAreas.some(
      (area) => area.pincode === pincode
    );

    return { serviceable };
  }

  // Helper: Get nursery analytics
  private async getNurseryAnalytics(nurseryId: string) {
    const [totalOrders, totalRevenue, totalPlants, activeRentals] =
      await Promise.all([
        this.prisma.order.count({
          where: { nurseryId },
        }),
        this.prisma.order.aggregate({
          where: { nurseryId },
          _sum: { totalAmount: true },
        }),
        this.prisma.plant.count({
          where: { nurseryId, isActive: true },
        }),
        this.prisma.orderItem.count({
          where: {
            order: { nurseryId },
            rentalStatus: "ACTIVE",
          },
        }),
      ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalPlants,
      activeRentals,
    };
  }
}
