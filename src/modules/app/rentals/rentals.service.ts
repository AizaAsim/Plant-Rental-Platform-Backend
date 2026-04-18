// src/modules/app/rentals/rentals.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { CreateRentalDto } from "./dto/create-rental.dto";
import { UpdateRentalDto } from "./dto/update-rental.dto";
import { ExtendRentalDto } from "./dto/extend-rental.dto";
import { ConvertToPurchaseDto } from "./dto/convert-to-purchase.dto";
import { CheckAvailabilityDto } from "./dto/check-availability.dto";
import { RentalFilterDto } from "./dto/rental-filter.dto";
import { Prisma, RentalStatus, TransactionStatus } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class RentalsService {
  constructor(
    private prisma: PrismaService
    // private emailService: EmailService
  ) {}

  async create(userId: string, createRentalDto: CreateRentalDto) {
    const {
      plantId,
      nurseryId,
      duration,
      serviceType,
      startDate,
      deliveryAddressId,
      customDeliveryAddress,
      deliveryInstructions,
      includeMaintenance,
      maintenanceFrequency,
    } = createRentalDto;

    // Validate plant exists and is available
    const plant = await this.prisma.plant.findFirst({
      where: {
        id: plantId,
        nurseryId,
        isActive: true,
      },
      include: {
        nursery: true,
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found or not available");
    }

    if (plant.stockQuantity < 1) {
      throw new BadRequestException("Plant is out of stock");
    }

    // Check availability for the requested dates
    const endDate = this.calculateEndDate(startDate, duration);
    const isAvailable = await this.checkPlantAvailability(
      plantId,
      new Date(startDate),
      endDate,
      1
    );

    if (!isAvailable) {
      throw new ConflictException(
        "Plant is not available for the selected dates"
      );
    }

    // Get delivery address
    let deliveryAddress: any;
    if (deliveryAddressId) {
      const address = await this.prisma.userAddress.findFirst({
        where: {
          id: deliveryAddressId,
          userId,
        },
      });

      if (!address) {
        throw new NotFoundException("Delivery address not found");
      }

      deliveryAddress = {
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      };
    } else if (customDeliveryAddress) {
      deliveryAddress = customDeliveryAddress;
    } else {
      throw new BadRequestException("Delivery address is required");
    }

    // Rentals are now handled through Orders API
    throw new BadRequestException(
      "Rentals are now handled through the Orders API. Please use POST /api/v1/orders/checkout with order_type=RENT"
    );
  }

  async findAll(userId: string, filterDto: RentalFilterDto) {
    const {
      page = 1,
      limit = 20,
      status,
      nurseryId,
      plantId,
      startDateFrom,
      startDateTo,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filterDto;

    // Rentals are now handled through Orders with orderType=RENT
    // This method should query OrderItems instead
    const where: any = {
      userId,
      ...(status && { status }),
      ...(nurseryId && { nurseryId }),
      ...(plantId && { plantId }),
      ...(startDateFrom || startDateTo
        ? {
            startDate: {
              ...(startDateFrom && { gte: new Date(startDateFrom) }),
              ...(startDateTo && { lte: new Date(startDateTo) }),
            },
          }
        : {}),
    };

    // Build orderBy
    let orderBy: any = {};
    switch (sortBy) {
      case "startDate":
        orderBy = { rentStartDate: sortOrder };
        break;
      case "endDate":
        orderBy = { rentEndDate: sortOrder };
        break;
      case "totalAmount":
        orderBy = { totalPrice: sortOrder };
        break;
      default:
        orderBy = { createdAt: sortOrder };
    }

    const skip = (page - 1) * limit;

    const whereClause: any = {
      order: { userId },
      orderType: "RENT" as any,
      ...(status && { rentalStatus: status }),
      ...(nurseryId && { order: { nurseryId } }),
      ...(plantId && { plantId }),
    };

    const [rentals, total] = await this.prisma.$transaction([
      this.prisma.orderItem.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit,
        include: {
          plant: {
            include: {
              nursery: {
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                },
              },
            },
          },
          order: {
            include: {
              nursery: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  addressLine1: true,
                  city: true,
                },
              },
              payments: {
                where: {
                  status: TransactionStatus.SUCCESS,
                },
              },
            },
          },
        },
      }),
      this.prisma.orderItem.count({
        where: {
          order: { userId },
          orderType: "RENT",
          ...(status && { rentalStatus: status }),
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: rentals.map((rental) => this.mapOrderItemToRentalDto(rental)),
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async findById(id: string, userId: string) {
    // Rentals are now OrderItems with orderType=RENT
    const rental = await this.prisma.orderItem.findFirst({
      where: {
        id,
        order: { userId },
        orderType: "RENT",
      },
      include: {
        plant: {
          include: {
            nursery: true,
          },
        },
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
              },
            },
            nursery: true,
            payments: true,
            deliveryAddress: true,
          },
        },
      },
    });

    if (!rental) {
      throw new NotFoundException("Rental not found");
    }

    // Calculate days remaining
    const today = new Date();
    const endDate = rental.rentEndDate ? new Date(rental.rentEndDate) : null;
    const daysRemaining = endDate
      ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Calculate total paid
    const totalPaid = (rental.order.payments || [])
      .filter((p: any) => p.status === TransactionStatus.SUCCESS)
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    const orderTotal = Number(rental.order.totalAmount || 0);

    const rentalDto = this.mapOrderItemToRentalDto(rental);
    return {
      ...rentalDto,
      daysRemaining: Math.max(0, daysRemaining),
      totalPaid,
      remainingBalance: orderTotal - totalPaid,
      canExtend: rental.rentalStatus === "ACTIVE" && daysRemaining <= 7,
      canReturn: rental.rentalStatus === "ACTIVE",
      canConvertToPurchase: rental.rentalStatus === "ACTIVE" && daysRemaining > 0,
    };
  }

  async update(id: string, userId: string, updateRentalDto: UpdateRentalDto) {
    // Rentals are now OrderItems with orderType=RENT
    const rental = await this.prisma.orderItem.findFirst({
      where: {
        id,
        order: { userId },
        orderType: "RENT" as any,
      },
    });

    if (!rental) {
      throw new NotFoundException("Rental not found");
    }

    // Validate status transitions
    if (updateRentalDto.status) {
      if (updateRentalDto.status) {
        this.validateStatusTransition(rental.rentalStatus || "ACTIVE", updateRentalDto.status);
      }
    }

    const updatedRental = await this.prisma.orderItem.update({
      where: { id },
      data: {
        ...(updateRentalDto.status && { rentalStatus: updateRentalDto.status as any }),
      },
      include: {
        plant: true,
        order: {
          include: {
            nursery: true,
          },
        },
      },
    });

    // Handle status-specific actions
    if (updateRentalDto.status) {
      await this.handleStatusChange(updatedRental, updateRentalDto.status);
    }

    return this.mapOrderItemToRentalDto(updatedRental);
  }

  async extendRental(
    id: string,
    userId: string,
    extendRentalDto: ExtendRentalDto
  ) {
    const { additionalWeeks, reason } = extendRentalDto;

    // Rentals are now OrderItems with orderType=RENT
    const rental = await this.prisma.orderItem.findFirst({
      where: {
        id,
        order: { userId },
        orderType: "RENT" as any,
        rentalStatus: { in: ["ACTIVE", "EXTENDED"] as any },
      },
      include: {
        plant: true,
        order: {
          include: {
            payments: true,
          },
        },
      },
    });

    if (!rental) {
      throw new NotFoundException("Active rental not found");
    }

    // Check if extension is allowed (e.g., within 7 days of end date)
    const today = new Date();
    const endDate = rental.rentEndDate ? new Date(rental.rentEndDate) : null;
    if (!endDate) {
      throw new BadRequestException("Rental end date not found");
    }
    const daysUntilEnd = Math.ceil(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilEnd > 7) {
      throw new BadRequestException(
        "Extensions can only be requested within 7 days of rental end date"
      );
    }

    // Check availability for extended period
    const newEndDate = new Date(endDate);
    newEndDate.setDate(newEndDate.getDate() + additionalWeeks * 7);

    const isAvailable = await this.checkPlantAvailability(
      rental.plantId,
      endDate,
      newEndDate,
      1
    );

    if (!isAvailable) {
      throw new ConflictException(
        "Plant is not available for the extended period"
      );
    }

    // Calculate additional costs
    const weeklyRate = Number(rental.plant.rentPriceMonthly || 0) / 4;
    const additionalRentalCost = weeklyRate * additionalWeeks;
    let additionalMaintenanceCost = 0;
    // Maintenance costs would be calculated separately if maintenance is included

    const additionalTotalCost =
      additionalRentalCost + additionalMaintenanceCost;

    // Update rental in transaction
    const updatedRental = await this.prisma.$transaction(async (prisma) => {
      // Update rental end date
      const updated = await prisma.orderItem.update({
        where: { id },
        data: {
          rentEndDate: newEndDate,
          rentalStatus: "EXTENDED" as any,
          extensionCount: { increment: 1 },
        },
        include: {
          plant: true,
          order: {
            include: {
              nursery: true,
              user: true,
            },
          },
        },
      });

      // Create payment record for extension
      await prisma.payment.create({
        data: {
          userId,
          orderId: rental.orderId,
          paymentType: "ORDER" as any,
          paymentMethod: "CARD",
          amount: additionalTotalCost,
          status: "PENDING" as any,
          metadata: {
            type: "rental_extension",
            weeks: additionalWeeks,
            reason,
          },
        },
      });

      return updated;
    });

    // Send extension confirmation email
    // await this.emailService.sendRentalExtensionConfirmation(
    //   updatedRental.user.email,
    //   updatedRental,
    //   additionalWeeks
    // );

    const rentalDto = this.mapOrderItemToRentalDto(updatedRental);
    return {
      ...rentalDto,
      extensionDetails: {
        additionalWeeks,
        additionalCost: additionalTotalCost,
        newEndDate,
        reason,
      },
    };
  }

  async convertToPurchase(
    id: string,
    userId: string,
    convertDto: ConvertToPurchaseDto
  ) {
    const { applyRentalCredit, reason } = convertDto;

    // Rentals are now OrderItems with orderType=RENT
    const rental = await this.prisma.orderItem.findFirst({
      where: {
        id,
        order: { userId },
        orderType: "RENT" as any,
        rentalStatus: "ACTIVE" as any,
      },
      include: {
        plant: true,
        order: {
          include: {
            payments: {
              where: {
                status: TransactionStatus.SUCCESS,
              },
            },
          },
        },
      },
    });

    if (!rental) {
      throw new NotFoundException("Active rental not found");
    }

    // Calculate conversion details
    const purchasePrice = Number(rental.plant.buyPrice || 0);
    const paidRentalAmount = (rental.order.payments || []).reduce(
      (sum: number, p: any) => sum + Number(p.amount || 0),
      0
    );

    let creditAmount = 0;
    let finalPrice = purchasePrice;

    if (applyRentalCredit) {
      // Apply up to 50% of rental payments as credit
      creditAmount = Math.min(paidRentalAmount * 0.5, purchasePrice * 0.3);
      finalPrice = purchasePrice - creditAmount;
    }

    // Purchases are now handled through Orders API
    // This method should redirect to Orders service
    throw new BadRequestException("Purchases are now handled through the Orders API. Please use POST /api/v1/orders/checkout with order_type=BUY");
  }

  async checkAvailability(checkAvailabilityDto: CheckAvailabilityDto) {
    const { plantId, startDate, endDate, quantity = 1 } = checkAvailabilityDto;

    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
      include: {
        nursery: true,
        orderItems: {
          where: {
            orderType: "RENT" as any,
            rentalStatus: {
              in: ["ACTIVE", "EXTENDED"] as any,
            },
            OR: [
              {
                rentStartDate: {
                  lte: new Date(endDate),
                },
                rentEndDate: {
                  gte: new Date(startDate),
                },
              },
            ],
          },
        },
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    // Calculate rental duration in weeks
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const durationWeeks = Math.ceil(durationDays / 7);

    // Check availability
    const conflictingRentals = plant.orderItems || [];
    const rentedQuantity = conflictingRentals.length;
    const availableQuantity = Math.max(
      0,
      plant.stockQuantity - rentedQuantity
    );
    const isAvailable = availableQuantity >= quantity;

    // Find conflicting dates
    const conflictingDates: string[] = [];
    if (!isAvailable) {
      const dateRange = this.getDateRange(start, end);
      dateRange.forEach((date) => {
        const dateStr = date.toISOString().split("T")[0];
        const conflictsOnDate = conflictingRentals.filter(
          (rental: any) =>
            rental.rentStartDate &&
            rental.rentEndDate &&
            new Date(rental.rentStartDate) <= date &&
            new Date(rental.rentEndDate) >= date
        );
        if (conflictsOnDate.length >= plant.stockQuantity) {
          conflictingDates.push(dateStr);
        }
      });
    }

    // Find next available date if not available
    let nextAvailableDate: string | undefined;
    if (!isAvailable) {
      const futureDate = new Date(end);
      for (let i = 1; i <= 30; i++) {
        futureDate.setDate(futureDate.getDate() + 1);
        const futureConflicts = conflictingRentals.filter(
          (rental: any) =>
            rental.rentStartDate &&
            rental.rentEndDate &&
            new Date(rental.rentStartDate) <= futureDate &&
            new Date(rental.rentEndDate) >= futureDate
        );
        if (futureConflicts.length < plant.stockQuantity) {
          nextAvailableDate = futureDate.toISOString().split("T")[0];
          break;
        }
      }
    }

    // Calculate costs
    const rentalCost = Number(plant.rentPriceMonthly || 0) * (durationWeeks / 4);
    const maintenanceCost = 200 * durationWeeks * 2; // Assuming 2 visits per week
    const estimatedCost = rentalCost + maintenanceCost;

    return {
      isAvailable,
      plantId,
      plantName: plant.name,
      availableQuantity,
      requestedQuantity: quantity,
      startDate,
      endDate,
      conflictingDates:
        conflictingDates.length > 0 ? conflictingDates : undefined,
      nextAvailableDate,
      estimatedCost,
      securityDeposit: Number(plant.depositAmount || 0),
      nursery: {
        id: plant.nurseryId,
        name: plant.nursery?.name || "",
        deliveryFee: 0, // Would need to get from nursery
      },
    };
  }

  // Helper methods to transform OrderItem to RentalResponseDto
  private mapOrderItemToRentalDto(orderItem: any): any {
    if (!orderItem) return null;

    const startDate = orderItem.rentStartDate || new Date();
    const endDate = orderItem.rentEndDate || new Date();
    const durationDays = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const durationWeeks = Math.ceil(durationDays / 7);

    return {
      id: orderItem.id,
      userId: orderItem.order?.userId || "",
      nurseryId: orderItem.order?.nurseryId || orderItem.plant?.nurseryId || "",
      plantId: orderItem.plantId,
      duration: durationWeeks,
      serviceType: "BASIC", // Default, could be enhanced
      status: orderItem.rentalStatus || "ACTIVE",
      rentalPrice: Number(orderItem.unitPrice || 0) * durationWeeks,
      maintenancePrice: 0, // Would need to calculate from maintenance tasks
      securityDeposit: Number(orderItem.depositPerUnit || 0),
      totalAmount: Number(orderItem.totalPrice || 0),
      startDate: startDate,
      endDate: endDate,
      deliveredAt: null, // Not stored on OrderItem
      returnedAt: orderItem.actualReturnDate || null,
      deliveryAddress: orderItem.order?.deliveryAddress || null,
      pickupAddress: null,
      createdAt: orderItem.createdAt,
      updatedAt: orderItem.updatedAt,
      plant: orderItem.plant,
      nursery: orderItem.order?.nursery || orderItem.plant?.nursery,
      user: orderItem.order?.user,
      maintenanceSchedule: null, // Not available on OrderItem
      payments: orderItem.order?.payments || [],
      delivery: null, // Not available on OrderItem
    };
  }

  // Helper methods
  private calculateEndDate(startDate: string, durationInWeeks: number): Date {
    const end = new Date(startDate);
    end.setDate(end.getDate() + durationInWeeks * 7);
    return end;
  }

  private async checkPlantAvailability(
    plantId: string,
    startDate: Date,
    endDate: Date,
    quantity: number
  ): Promise<boolean> {
    const conflictingRentals = await this.prisma.orderItem.count({
      where: {
        plantId,
        orderType: "RENT",
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

    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
      select: { stockQuantity: true },
    });

    return plant
      ? plant.stockQuantity - conflictingRentals >= quantity
      : false;
  }

  private validateStatusTransition(
    currentStatus: RentalStatus,
    newStatus: RentalStatus
  ) {
    const validTransitions: Record<RentalStatus, RentalStatus[]> = {
      ACTIVE: ["EXTENDED", "RETURNED"],
      EXTENDED: ["RETURNED"],
      RETURNED: [],
      OVERDUE: ["RETURNED"],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private async handleStatusChange(rental: any, newStatus: RentalStatus) {
    switch (newStatus) {
      case "RETURNED":
        await this.prisma.orderItem.update({
          where: { id: rental.id },
          data: {
            rentalStatus: "RETURNED" as any,
            actualReturnDate: new Date(),
          },
        });

        // Restore plant stock
        await this.prisma.plant.update({
          where: { id: rental.plantId },
          data: {
            stockQuantity: {
              increment: rental.quantity,
            },
          },
        });
        break;

      case "EXTENDED":
        // Extension is handled in extendRental method
        break;

      default:
        // Update status only
        await this.prisma.orderItem.update({
          where: { id: rental.id },
          data: {
            rentalStatus: newStatus as any,
          },
        });
        break;
    }
  }

  private async scheduleMaintenanceVisits(
    rentalId: string,
    nurseryId: string,
    startDate: Date,
    endDate: Date,
    frequency: number
  ) {
    const visits = [];
    const currentDate = new Date(startDate);
    const daysInWeek = 7;
    const daysBetweenVisits = Math.floor(daysInWeek / frequency);

    while (currentDate <= endDate) {
      for (let i = 0; i < frequency; i++) {
        const visitDate = new Date(currentDate);
        visitDate.setDate(visitDate.getDate() + i * daysBetweenVisits);

        if (visitDate <= endDate) {
          visits.push({
            scheduleId: rentalId,
            nurseryId,
            scheduledDate: visitDate,
            status: "SCHEDULED",
          });
        }
      }
      currentDate.setDate(currentDate.getDate() + daysInWeek);
    }

    if (visits.length > 0) {
      // Maintenance visits are now MaintenanceTasks
      // This would be created when gardener is assigned
      // Maintenance tasks are created through the Tasks service
    }
  }

  private getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }
}
