// src/modules/app/nurseries/nurseries.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { NurseryFilterDto } from "./dto/nursery-filter.dto";
import {
  UpdateInventoryDto,
  BulkUpdateInventoryDto,
} from "./dto/inventory.dto";
import { Prisma, PrismaPromise, Rental, Purchase } from "@prisma/client";
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
      ...(minRating && { rating: { gte: minRating } }),
      ...(maxDeliveryRange && { maxDeliveryRange: { lte: maxDeliveryRange } }),
      ...(serviceAreas &&
        serviceAreas.length > 0 && {
          serviceAreas: {
            path: ["$"],
            array_contains: serviceAreas,
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
        orderBy = { rating: sortOrder };
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
              rentals: true,
              purchases: true,
            },
          },
        },
      }),
      this.prisma.nursery.count({ where }),
    ]);

    // Calculate distance if user coordinates provided
    let nurseriesWithDistance = nurseries.map((nursery) => {
      const nurseryData: any = {
        ...nursery,
        totalPlants: nursery._count.plants,
        totalOrders: nursery._count.rentals + nursery._count.purchases,
      };

      if (latitude && longitude && nursery.latitude && nursery.longitude) {
        nurseryData.distance = this.calculateDistance(
          latitude,
          longitude,
          nursery.latitude,
          nursery.longitude
        );
      }

      // Parse serviceAreas if it's a JSON field
      if (nursery.serviceAreas) {
        nurseryData.serviceAreas = nursery.serviceAreas as any;
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
        plants: {
          where: { isActive: true },
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: {
                reviews: true,
              },
            },
          },
        },
        reviews: {
          where: { type: "NURSERY" },
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            plants: true,
            rentals: true,
            purchases: true,
            staff: true,
          },
        },
      },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    // Get stats
    const stats = await this.prisma.$transaction([
      // [0] Total customers (unique users who made orders)
      this.prisma.rental.findMany({
        where: { nurseryId: id },
        select: { userId: true },
        distinct: ["userId"],
      }),
      // [1]
      this.prisma.purchase.findMany({
        where: { nurseryId: id },
        select: { userId: true },
        distinct: ["userId"],
      }),
      // [2] Completed orders for completion rate
      this.prisma.rental.count({
        where: {
          nurseryId: id,
          status: "COMPLETED",
        },
      }),
      // [3]
      this.prisma.purchase.count({
        where: {
          nurseryId: id,
          status: "COMPLETED",
        },
      }),

      // [4] Get completed rental deliveries for average delivery time
      this.prisma.rental.findMany({
        where: {
          nurseryId: id,
          status: "COMPLETED",
          delivery: {
            deliveredAt: {
              // FIX 1: Change `isNot` to `not`
              not: null,
            },
          },
        },
        select: {
          createdAt: true,
          delivery: {
            select: {
              deliveredAt: true,
            },
          },
        },
      }),

      // [5] Get completed purchase deliveries for average delivery time
      this.prisma.purchase.findMany({
        where: {
          nurseryId: id,
          status: "COMPLETED",
          delivery: {
            deliveredAt: {
              // FIX 2: Change `isNot` to `not`
              not: null,
            },
          },
        },
        select: {
          createdAt: true,
          delivery: {
            select: {
              deliveredAt: true,
            },
          },
        },
      }),
    ]);

    const uniqueCustomers = new Set([
      ...(stats[0] as { userId: string }[]).map((r) => r.userId),
      ...(stats[1] as { userId: string }[]).map((p) => p.userId),
    ]);

    const totalOrders = nursery._count.rentals + nursery._count.purchases;
    const completedOrders = stats[2] + stats[3];
    const completionRate =
      totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Calculate Average Delivery Time
    type DeliveryInfo = {
      createdAt: Date;
      delivery: { deliveredAt: Date | null } | null;
    };

    // FIX 3: Cast to `unknown` first to bypass incorrect type inference
    const completedRentalDeliveries = stats[4] as unknown as DeliveryInfo[];
    // FIX 4: Cast to `unknown` first to bypass incorrect type inference
    const completedPurchaseDeliveries = stats[5] as unknown as DeliveryInfo[];

    const allDeliveries = [
      ...completedRentalDeliveries
        .filter((r) => r.delivery?.deliveredAt)
        .map((r) => ({
          createdAt: r.createdAt,
          deliveredAt: r.delivery!.deliveredAt!,
        })),
      ...completedPurchaseDeliveries
        .filter((p) => p.delivery?.deliveredAt)
        .map((p) => ({
          createdAt: p.createdAt,
          deliveredAt: p.delivery!.deliveredAt!,
        })),
    ];

    let totalDeliveryTime = 0; // in minutes
    allDeliveries.forEach((d) => {
      const deliveryTime = d.deliveredAt.getTime() - d.createdAt.getTime();
      totalDeliveryTime += deliveryTime / (1000 * 60); // convert ms to minutes
    });

    const averageDeliveryTime =
      allDeliveries.length > 0 ? totalDeliveryTime / allDeliveries.length : 0; // in minutes

    // Get top rated plants
    const topRatedPlants = await this.prisma.plant.findMany({
      where: {
        nurseryId: id,
        isActive: true,
      },
      include: {
        reviews: {
          select: { rating: true },
        },
      },
      take: 5,
    });

    const topRatedWithAverage = topRatedPlants
      .map((plant) => {
        const avgRating =
          plant.reviews.length > 0
            ? plant.reviews.reduce((sum, r) => sum + r.rating, 0) /
              plant.reviews.length
            : 0;
        return { ...plant, averageRating: avgRating };
      })
      .sort((a, b) => b.averageRating - a.averageRating);

    // Parse serviceAreas
    const serviceAreas = nursery.serviceAreas as any;

    return {
      ...nursery,
      serviceAreas,
      recentPlants: nursery.plants,
      topRatedPlants: topRatedWithAverage,
      stats: {
        totalPlants: nursery._count.plants,
        totalOrders,
        totalCustomers: uniqueCustomers.size,
        totalStaff: nursery._count.staff,
        completionRate: Math.round(completionRate * 10) / 10,
        averageDeliveryTime: Math.round(averageDeliveryTime * 10) / 10,
      },
      workingHours: {
        monday: "9:00 AM - 8:00 PM",
        tuesday: "9:00 AM - 8:00 PM",
        wednesday: "9:00 AM - 8:00 PM",
        thursday: "9:00 AM - 8:00 PM",
        friday: "9:00 AM - 8:00 PM",
        saturday: "10:00 AM - 6:00 PM",
        sunday: "Closed",
      },
      recentReviews: nursery.reviews,
    };
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
        orderBy = { purchasePrice: sortOrder };
        break;
      case "rentalPrice":
        orderBy = { rentalPrice: sortOrder };
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
              reviews: true,
              rentals: true,
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
        logo: nursery.logo,
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
            rentals: {
              where: {
                status: {
                  in: ["DELIVERED", "ACTIVE"],
                },
              },
            },
            cartItems: {
              where: {
                type: "RENTAL",
              },
            },
          },
        },
      },
      orderBy: {
        availableStock: "asc", // Show low stock items first
      },
    });

    const inventory = plants.map((plant) => {
      const reservedStock = plant._count.cartItems;
      const inRental = plant._count.rentals;
      const actualAvailable = Math.max(0, plant.availableStock - reservedStock);

      const lowStockThreshold = Math.ceil(plant.totalStock * 0.2); // 20% threshold
      const isLowStock =
        actualAvailable <= lowStockThreshold && actualAvailable > 0;

      return {
        plantId: plant.id,
        plantName: plant.name,
        category: plant.category,
        totalStock: plant.totalStock,
        availableStock: plant.availableStock,
        reservedStock,
        inRental,
        actualAvailable,
        purchasePrice: plant.purchasePrice,
        rentalPrice: plant.rentalPrice,
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
            rentals: {
              where: {
                status: {
                  in: ["CONFIRMED", "DELIVERED", "ACTIVE"],
                },
                ...(date && {
                  AND: [
                    { startDate: { lte: new Date(date) } },
                    { endDate: { gte: new Date(date) } },
                  ],
                }),
              },
              select: {
                id: true,
                startDate: true,
                endDate: true,
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
      const reservedInRentals = plant.rentals.length;
      const reservedInCarts = plant.cartItems.length;
      const totalReserved = reservedInRentals + reservedInCarts;
      const availableQuantity = Math.max(
        0,
        plant.availableStock - totalReserved
      );

      // Determine status
      let status: string;
      if (availableQuantity === 0) {
        status = "OUT_OF_STOCK";
      } else if (availableQuantity <= Math.ceil(plant.totalStock * 0.2)) {
        status = "LOW_STOCK";
      } else {
        status = "IN_STOCK";
      }

      // Calculate next available dates (simplified)
      const availableDates: string[] = [];
      const checkDate = new Date();
      for (let i = 0; i < 7; i++) {
        const dateStr = checkDate.toISOString().split("T")[0];
        const conflictingRentals = plant.rentals.filter((rental) => {
          return (
            new Date(rental.startDate) <= checkDate &&
            new Date(rental.endDate) >= checkDate
          );
        });

        if (plant.availableStock - conflictingRentals.length > 0) {
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
}
