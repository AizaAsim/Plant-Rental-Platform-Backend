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
import { Prisma, RentalStatus } from "@prisma/client";
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

    if (plant.availableStock < 1) {
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
      const address = await this.prisma.address.findFirst({
        where: {
          id: deliveryAddressId,
          userId,
        },
      });

      if (!address) {
        throw new NotFoundException("Delivery address not found");
      }

      deliveryAddress = {
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country,
      };
    } else if (customDeliveryAddress) {
      deliveryAddress = customDeliveryAddress;
    } else {
      throw new BadRequestException("Delivery address is required");
    }

    // Calculate pricing
    const weeklyRentalPrice = plant.rentalPrice;
    const totalRentalPrice = weeklyRentalPrice * duration;

    let maintenancePrice = 0;
    if (includeMaintenance && serviceType === "PREMIUM") {
      // Premium service includes maintenance
      maintenancePrice = 200 * duration * (maintenanceFrequency || 2); // PKR 200 per visit
    }

    const securityDeposit = plant.securityDeposit;
    const totalAmount = totalRentalPrice + maintenancePrice + securityDeposit;

    // Create rental in a transaction
    const rental = await this.prisma.$transaction(async (prisma) => {
      // Create rental
      const newRental = await prisma.rental.create({
        data: {
          userId,
          nurseryId,
          plantId,
          duration,
          serviceType,
          status: "PENDING",
          rentalPrice: totalRentalPrice,
          maintenancePrice,
          securityDeposit,
          totalAmount,
          startDate: new Date(startDate),
          endDate,
          deliveryAddress,
          pickupAddress: deliveryAddress, // Same as delivery initially
        },
        include: {
          plant: true,
          nursery: true,
          user: true,
        },
      });

      // Reduce available stock
      await prisma.plant.update({
        where: { id: plantId },
        data: {
          availableStock: {
            decrement: 1,
          },
        },
      });

      // Create maintenance schedule if included
      if (includeMaintenance) {
        await prisma.maintenanceSchedule.create({
          data: {
            rentalId: newRental.id,
            frequency: maintenanceFrequency || 2,
            isActive: true,
          },
        });

        // Schedule initial maintenance visits
        await this.scheduleMaintenanceVisits(
          newRental.id,
          nurseryId,
          new Date(startDate),
          endDate,
          maintenanceFrequency || 2
        );
      }

      // Create delivery record
      await prisma.delivery.create({
        data: {
          type: "DELIVERY",
          status: "SCHEDULED",
          scheduledDate: new Date(startDate),
          address: deliveryAddress,
          instructions: deliveryInstructions,
          rentalId: newRental.id,
          addressId: deliveryAddressId || "",
        },
      });

      return newRental;
    });

    // Send confirmation email
    // await this.emailService.sendRentalConfirmation(rental.user.email, rental);

    return rental;
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

    const where: Prisma.RentalWhereInput = {
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
    let orderBy: Prisma.RentalOrderByWithRelationInput = {};
    switch (sortBy) {
      case "startDate":
        orderBy = { startDate: sortOrder };
        break;
      case "endDate":
        orderBy = { endDate: sortOrder };
        break;
      case "totalAmount":
        orderBy = { totalAmount: sortOrder };
        break;
      default:
        orderBy = { createdAt: sortOrder };
    }

    const skip = (page - 1) * limit;

    const [rentals, total] = await this.prisma.$transaction([
      this.prisma.rental.findMany({
        where,
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
                  logo: true,
                },
              },
            },
          },
          nursery: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
              city: true,
            },
          },
          maintenanceSchedule: {
            include: {
              visits: {
                where: {
                  scheduledDate: {
                    gte: new Date(),
                  },
                },
                orderBy: {
                  scheduledDate: "asc",
                },
                take: 3,
              },
            },
          },
          delivery: true,
          payments: {
            where: {
              status: "COMPLETED",
            },
          },
        },
      }),
      this.prisma.rental.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: rentals,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async findById(id: string, userId: string) {
    const rental = await this.prisma.rental.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        plant: {
          include: {
            nursery: true,
            reviews: {
              where: {
                userId,
              },
            },
          },
        },
        nursery: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        maintenanceSchedule: {
          include: {
            visits: {
              orderBy: {
                scheduledDate: "asc",
              },
            },
          },
        },
        delivery: true,
        payments: true,
        swapRequests: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!rental) {
      throw new NotFoundException("Rental not found");
    }

    // Calculate days remaining
    const today = new Date();
    const endDate = new Date(rental.endDate);
    const daysRemaining = Math.ceil(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate total paid
    const totalPaid = rental.payments
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      ...rental,
      daysRemaining: Math.max(0, daysRemaining),
      totalPaid,
      remainingBalance: rental.totalAmount - totalPaid,
      canExtend: rental.status === "ACTIVE" && daysRemaining <= 7,
      canReturn: rental.status === "ACTIVE" || rental.status === "DELIVERED",
      canConvertToPurchase: rental.status === "ACTIVE" && daysRemaining > 0,
    };
  }

  async update(id: string, userId: string, updateRentalDto: UpdateRentalDto) {
    const rental = await this.prisma.rental.findFirst({
      where: { id, userId },
    });

    if (!rental) {
      throw new NotFoundException("Rental not found");
    }

    // Validate status transitions
    if (updateRentalDto.status) {
      this.validateStatusTransition(rental.status, updateRentalDto.status);
    }

    const updatedRental = await this.prisma.rental.update({
      where: { id },
      data: updateRentalDto,
      include: {
        plant: true,
        nursery: true,
      },
    });

    // Handle status-specific actions
    if (updateRentalDto.status) {
      await this.handleStatusChange(updatedRental, updateRentalDto.status);
    }

    return updatedRental;
  }

  async extendRental(
    id: string,
    userId: string,
    extendRentalDto: ExtendRentalDto
  ) {
    const { additionalWeeks, reason } = extendRentalDto;

    const rental = await this.prisma.rental.findFirst({
      where: {
        id,
        userId,
        status: { in: ["ACTIVE", "DELIVERED"] },
      },
      include: {
        plant: true,
        maintenanceSchedule: true,
      },
    });

    if (!rental) {
      throw new NotFoundException("Active rental not found");
    }

    // Check if extension is allowed (e.g., within 7 days of end date)
    const today = new Date();
    const endDate = new Date(rental.endDate);
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
    const additionalRentalCost = rental.plant.rentalPrice * additionalWeeks;
    let additionalMaintenanceCost = 0;

    if (rental.maintenanceSchedule) {
      additionalMaintenanceCost =
        200 * additionalWeeks * rental.maintenanceSchedule.frequency;
    }

    const additionalTotalCost =
      additionalRentalCost + additionalMaintenanceCost;

    // Update rental in transaction
    const updatedRental = await this.prisma.$transaction(async (prisma) => {
      // Update rental
      const updated = await prisma.rental.update({
        where: { id },
        data: {
          duration: rental.duration + additionalWeeks,
          endDate: newEndDate,
          rentalPrice: rental.rentalPrice + additionalRentalCost,
          maintenancePrice: rental.maintenancePrice + additionalMaintenanceCost,
          totalAmount: rental.totalAmount + additionalTotalCost,
          status: "EXTENDED",
        },
        include: {
          plant: true,
          nursery: true,
          user: true,
        },
      });

      // Schedule additional maintenance visits if applicable
      if (rental.maintenanceSchedule) {
        await this.scheduleMaintenanceVisits(
          id,
          rental.nurseryId,
          endDate,
          newEndDate,
          rental.maintenanceSchedule.frequency
        );
      }

      // Create payment record for extension
      await prisma.payment.create({
        data: {
          userId,
          type: "RENTAL_PAYMENT",
          status: "PENDING",
          amount: additionalTotalCost,
          currency: "PKR",
          method: "CARD",
          rentalId: id,
          metadata: {
            type: "extension",
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

    return {
      ...updatedRental,
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

    const rental = await this.prisma.rental.findFirst({
      where: {
        id,
        userId,
        status: "ACTIVE",
      },
      include: {
        plant: true,
        nursery: true,
        payments: {
          where: {
            status: "COMPLETED",
            type: "RENTAL_PAYMENT",
          },
        },
        user: true,
      },
    });

    if (!rental) {
      throw new NotFoundException("Active rental not found");
    }

    // Calculate conversion details
    const purchasePrice = rental.plant.purchasePrice;
    const paidRentalAmount = rental.payments.reduce(
      (sum, p) => sum + p.amount,
      0
    );

    let creditAmount = 0;
    let finalPrice = purchasePrice;

    if (applyRentalCredit) {
      // Apply up to 50% of rental payments as credit
      creditAmount = Math.min(paidRentalAmount * 0.5, purchasePrice * 0.3);
      finalPrice = purchasePrice - creditAmount;
    }

    // Create purchase in transaction
    const result = await this.prisma.$transaction(async (prisma) => {
      // Create purchase
      const purchase = await prisma.purchase.create({
        data: {
          userId,
          nurseryId: rental.nurseryId,
          status: "PENDING",
          subtotal: purchasePrice,
          deliveryFee: 0, // No delivery fee for conversion
          tax: finalPrice * 0.1, // 10% tax
          totalAmount: finalPrice * 1.1,
          deliveryAddress: rental.deliveryAddress,
        },
      });

      // Create purchase item
      await prisma.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          plantId: rental.plantId,
          quantity: 1,
          unitPrice: purchasePrice,
          totalPrice: finalPrice,
        },
      });

      // Update rental status
      await prisma.rental.update({
        where: { id },
        data: {
          status: "COMPLETED",
          returnedAt: new Date(),
        },
      });

      // Cancel remaining maintenance visits
      if ((rental as any).maintenanceSchedule) {
        await prisma.maintenanceVisit.updateMany({
          where: {
            scheduleId: (rental as any).maintenanceSchedule.id,
            status: "SCHEDULED",
          },
          data: {
            status: "CANCELLED",
          },
        });
      }

      // Create payment record for purchase
      await prisma.payment.create({
        data: {
          userId,
          type: "PURCHASE_PAYMENT",
          status: "PENDING",
          amount: finalPrice * 1.1,
          currency: "PKR",
          method: "CARD",
          purchaseId: purchase.id,
          metadata: {
            type: "rental_conversion",
            originalRentalId: id,
            creditApplied: creditAmount,
            reason,
          },
        },
      });

      // Return security deposit
      if (rental.securityDeposit > 0) {
        await prisma.payment.create({
          data: {
            userId,
            type: "REFUND",
            status: "PENDING",
            amount: rental.securityDeposit,
            currency: "PKR",
            method: "BANK_TRANSFER",
            rentalId: id,
            metadata: {
              type: "security_deposit_refund",
            },
          },
        });
      }

      return { purchase, rental };
    });

    // Send conversion confirmation email
    // await this.emailService.sendPurchaseConversionConfirmation(
    //   rental.user.email,
    //   result.purchase,
    //   rental,
    //   creditAmount
    // );

    return {
      message: "Rental successfully converted to purchase",
      purchaseId: result.purchase.id,
      originalRentalId: id,
      purchaseDetails: {
        originalPrice: purchasePrice,
        creditApplied: creditAmount,
        finalPrice: finalPrice * 1.1,
        taxAmount: finalPrice * 0.1,
        securityDepositRefund: rental.securityDeposit,
      },
    };
  }

  async checkAvailability(checkAvailabilityDto: CheckAvailabilityDto) {
    const { plantId, startDate, endDate, quantity = 1 } = checkAvailabilityDto;

    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
      include: {
        nursery: true,
        rentals: {
          where: {
            status: {
              in: ["CONFIRMED", "DELIVERED", "ACTIVE", "EXTENDED"],
            },
            OR: [
              {
                startDate: {
                  lte: new Date(endDate),
                },
                endDate: {
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
    const conflictingRentals = plant.rentals;
    const rentedQuantity = conflictingRentals.length;
    const availableQuantity = Math.max(
      0,
      plant.availableStock - rentedQuantity
    );
    const isAvailable = availableQuantity >= quantity;

    // Find conflicting dates
    const conflictingDates: string[] = [];
    if (!isAvailable) {
      const dateRange = this.getDateRange(start, end);
      dateRange.forEach((date) => {
        const dateStr = date.toISOString().split("T")[0];
        const conflictsOnDate = conflictingRentals.filter(
          (rental) =>
            new Date(rental.startDate) <= date &&
            new Date(rental.endDate) >= date
        );
        if (conflictsOnDate.length >= plant.availableStock) {
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
          (rental) =>
            new Date(rental.startDate) <= futureDate &&
            new Date(rental.endDate) >= futureDate
        );
        if (futureConflicts.length < plant.availableStock) {
          nextAvailableDate = futureDate.toISOString().split("T")[0];
          break;
        }
      }
    }

    // Calculate costs
    const rentalCost = plant.rentalPrice * durationWeeks;
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
      securityDeposit: plant.securityDeposit,
      nursery: {
        id: plant.nursery.id,
        name: plant.nursery.name,
        deliveryFee: plant.nursery.deliveryFee,
      },
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
    const conflictingRentals = await this.prisma.rental.count({
      where: {
        plantId,
        status: {
          in: ["CONFIRMED", "DELIVERED", "ACTIVE", "EXTENDED"],
        },
        OR: [
          {
            startDate: {
              lte: endDate,
            },
            endDate: {
              gte: startDate,
            },
          },
        ],
      },
    });

    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
      select: { availableStock: true },
    });

    return plant
      ? plant.availableStock - conflictingRentals >= quantity
      : false;
  }

  private validateStatusTransition(
    currentStatus: RentalStatus,
    newStatus: RentalStatus
  ) {
    const validTransitions: Record<RentalStatus, RentalStatus[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["DELIVERED", "CANCELLED"],
      DELIVERED: ["ACTIVE", "CANCELLED"],
      ACTIVE: ["EXTENDED", "RETURNED", "COMPLETED"],
      EXTENDED: ["RETURNED", "COMPLETED"],
      RETURNED: ["COMPLETED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  private async handleStatusChange(rental: any, newStatus: RentalStatus) {
    switch (newStatus) {
      case "DELIVERED":
        await this.prisma.rental.update({
          where: { id: rental.id },
          data: { deliveredAt: new Date() },
        });
        break;

      case "RETURNED":
        await this.prisma.rental.update({
          where: { id: rental.id },
          data: { returnedAt: new Date() },
        });

        // Restore plant stock
        await this.prisma.plant.update({
          where: { id: rental.plantId },
          data: {
            availableStock: {
              increment: 1,
            },
          },
        });
        break;

      case "CANCELLED":
        // Restore plant stock if not yet delivered
        if (rental.status !== "DELIVERED" && rental.status !== "ACTIVE") {
          await this.prisma.plant.update({
            where: { id: rental.plantId },
            data: {
              availableStock: {
                increment: 1,
              },
            },
          });
        }
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
      await this.prisma.maintenanceVisit.createMany({
        data: visits,
      });
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
