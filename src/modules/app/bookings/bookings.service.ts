// src/modules/app/bookings/bookings.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma, BookingStatus, ServiceType, RecurrencePattern, PaymentStatus, ReviewableType } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  private generateBookingNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `BK-${timestamp}-${random}`;
  }

  /** Normalize stored service time (Decimal hours or "HH:MM") to a float hour-of-day. */
  private asHourFloat(t: unknown): number {
    if (t == null || t === "") return NaN;
    if (typeof t === "number" && Number.isFinite(t)) return t;
    const s = String(t);
    if (s.includes(":")) {
      const [h, m] = s.split(":").map((x) => Number(x));
      if (Number.isFinite(h)) return h + (Number.isFinite(m) ? m / 60 : 0);
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }

  /** Persist `serviceTime` as Prisma `String` (DB column is string). */
  private formatHourString(h: number): string {
    if (!Number.isFinite(h)) return "0:00";
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60) % 60;
    return `${hh}:${String(mm).padStart(2, "0")}`;
  }

  // POST /api/v1/bookings
  async createBooking(userId: string, createDto: any) {
    const {
      gardener_id,
      service_address_id,
      service_type,
      service_date,
      service_time,
      duration_hours,
      recurrence_pattern,
      recurrence_end_date,
      notes,
    } = createDto ?? {};

    if (
      !gardener_id ||
      !service_address_id ||
      !service_type ||
      !service_date ||
      service_time == null ||
      service_time === "" ||
      duration_hours == null
    ) {
      throw new BadRequestException(
        "gardener_id, service_address_id, service_type, service_date, service_time, and duration_hours are required"
      );
    }

    // Validate gardener
    const gardener = await this.prisma.gardener.findUnique({
      where: { id: gardener_id },
      include: {
        serviceAreas: true,
        availability: true,
      },
    });

    if (!gardener || !gardener.isFreelancer || !gardener.isAvailable) {
      throw new NotFoundException("Gardener not available for freelance work");
    }

    if (!gardener.hourlyRate) {
      throw new BadRequestException("Gardener hourly rate not set");
    }

    // Validate service address
    const serviceAddress = await this.prisma.userAddress.findFirst({
      where: {
        id: service_address_id,
        userId,
      },
    });

    if (!serviceAddress) {
      throw new NotFoundException("Service address not found");
    }

    // Validate service area
    const isInServiceArea = gardener.serviceAreas.some(
      (area) => area.pincode === serviceAddress.pincode
    );

    if (!isInServiceArea) {
      throw new BadRequestException("Gardener does not service this area");
    }

    // Check availability
    const serviceDate = new Date(service_date);
    const dayOfWeek = serviceDate.getDay();
    const dayAvailability = gardener.availability.find(
      (avail) => avail.dayOfWeek === dayOfWeek && avail.isAvailable
    );

    if (!dayAvailability) {
      throw new BadRequestException("Gardener not available on this day");
    }

    const reqHour = this.asHourFloat(service_time);
    if (
      reqHour < this.asHourFloat(dayAvailability.startTime) ||
      reqHour > this.asHourFloat(dayAvailability.endTime)
    ) {
      throw new BadRequestException("Service time outside gardener availability");
    }

    // Check for conflicting bookings
    const conflictingBookings = await this.prisma.serviceBooking.findMany({
      where: {
        gardenerId: gardener_id,
        serviceDate: serviceDate,
        status: {
          in: ["CONFIRMED", "IN_PROGRESS"],
        },
      },
    });

    for (const booking of conflictingBookings) {
      const bookingStart = this.asHourFloat(booking.serviceTime);
      const bookingEnd = bookingStart + Number(booking.durationHours);
      const reqStart = reqHour;
      const reqEnd = reqStart + Number(duration_hours);
      if (reqStart < bookingEnd && reqEnd > bookingStart) {
        throw new BadRequestException("Time slot already booked");
      }
    }

    // Calculate total amount
    const totalAmount = gardener.hourlyRate.times(duration_hours);

    // Create booking
    const booking = await this.prisma.serviceBooking.create({
      data: {
        bookingNumber: this.generateBookingNumber(),
        userId,
        gardenerId: gardener_id,
        serviceAddressId: service_address_id,
        serviceType: service_type,
        serviceDate: serviceDate,
        serviceTime: this.formatHourString(reqHour),
        durationHours: new Decimal(duration_hours),
        recurrencePattern: recurrence_pattern,
        recurrenceEndDate: recurrence_end_date ? new Date(recurrence_end_date) : null,
        status: BookingStatus.PENDING,
        hourlyRate: gardener.hourlyRate,
        totalAmount,
        notes,
      },
      include: {
        gardener: {
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
        serviceAddress: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Create payment record
    await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        userId,
        amount: totalAmount,
        paymentType: "SERVICE_BOOKING",
        paymentMethod: "ONLINE", // Default, can be updated
        status: "PENDING",
      },
    });

    return {
      ...booking,
      payment_required: true,
    };
  }

  // GET /api/v1/bookings
  async getUserBookings(userId: string, filterDto: any) {
    const {
      page = 1,
      limit = 20,
      status,
      date_from,
      date_to,
    } = filterDto;

    const where: Prisma.ServiceBookingWhereInput = {
      userId,
      ...(status && { status }),
      ...(date_from && { serviceDate: { gte: new Date(date_from) } }),
      ...(date_to && { serviceDate: { lte: new Date(date_to) } }),
    };

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.prisma.serviceBooking.findMany({
        where,
        skip,
        take: limit,
        include: {
          gardener: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          serviceAddress: true,
        },
        orderBy: { serviceDate: "desc" },
      }),
      this.prisma.serviceBooking.count({ where }),
    ]);

    return {
      items: bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /api/v1/bookings/{booking_id}
  async getBookingById(userId: string, bookingId: string, userRole: string) {
    const booking = await this.prisma.serviceBooking.findUnique({
      where: { id: bookingId },
      include: {
        gardener: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        serviceAddress: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
        maintenanceTasks: true,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    // Check access
    if (userRole === "USER" && booking.userId !== userId) {
      throw new ForbiddenException("Access denied");
    }

    if (userRole === "GARDENER") {
      // Check if gardener is the assigned one
      const gardener = await this.prisma.gardener.findUnique({
        where: { userId },
      });
      if (!gardener || gardener.id !== booking.gardenerId) {
        throw new ForbiddenException("Access denied");
      }
    }

    return booking;
  }

  // POST /api/v1/bookings/{booking_id}/cancel
  async cancelBooking(userId: string, bookingId: string, cancelDto: any) {
    const { reason } = cancelDto;

    const booking = await this.prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      throw new BadRequestException("Booking cannot be cancelled at this stage");
    }

    // Check cancellation policy (24hr notice)
    const now = new Date();
    const bookingDate = new Date(booking.serviceDate);
    const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking < 24) {
      throw new BadRequestException("Cancellation requires 24 hours notice");
    }

    // Update booking
    const updated = await this.prisma.serviceBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledBy: userId,
        cancellationReason: reason,
        cancelledAt: new Date(),
      },
    });

    // Process refund if paid
    if (booking.paymentStatus === PaymentStatus.PAID) {
      await this.prisma.payment.create({
        data: {
          bookingId: booking.id,
          userId,
          amount: booking.totalAmount,
          paymentType: "REFUND",
          paymentMethod: "REFUND",
          status: "PENDING",
        },
      });
    }

    // TODO: Notify gardener

    return updated;
  }

  // POST /api/v1/bookings/{booking_id}/reschedule
  async rescheduleBooking(userId: string, bookingId: string, rescheduleDto: any) {
    const { new_date, new_time } = rescheduleDto;

    const booking = await this.prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
      include: {
        gardener: {
          include: {
            availability: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      throw new BadRequestException("Booking cannot be rescheduled at this stage");
    }

    // Check reschedule count (one free reschedule)
    // This would need to be tracked - for now, we'll allow one free reschedule

    const newDate = new Date(new_date);
    const dayOfWeek = newDate.getDay();
    const dayAvailability = booking.gardener.availability.find(
      (avail) => avail.dayOfWeek === dayOfWeek && avail.isAvailable
    );

    if (!dayAvailability) {
      throw new BadRequestException("Gardener not available on this day");
    }

    if (new_time < dayAvailability.startTime || new_time > dayAvailability.endTime) {
      throw new BadRequestException("Service time outside gardener availability");
    }

    // Check for conflicting bookings
    const conflictingBookings = await this.prisma.serviceBooking.findMany({
      where: {
        gardenerId: booking.gardenerId,
        serviceDate: newDate,
        status: {
          in: ["CONFIRMED", "IN_PROGRESS"],
        },
        id: { not: bookingId },
      },
    });

    for (const conflictBooking of conflictingBookings) {
      const bookingStart = this.asHourFloat(conflictBooking.serviceTime);
      const bookingEnd = bookingStart + Number(conflictBooking.durationHours);
      const reqStart = this.asHourFloat(new_time);
      const reqEnd = reqStart + Number(booking.durationHours);
      if (reqStart < bookingEnd && reqEnd > bookingStart) {
        throw new BadRequestException("Time slot already booked");
      }
    }

    // Update booking
    const updated = await this.prisma.serviceBooking.update({
      where: { id: bookingId },
      data: {
        serviceDate: newDate,
        serviceTime: new_time,
      },
    });

    return updated;
  }

  // POST /api/v1/bookings/{booking_id}/review
  async reviewBooking(userId: string, bookingId: string, reviewDto: any) {
    const { rating, comment } = reviewDto;

    const booking = await this.prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        userId,
        status: BookingStatus.COMPLETED,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found or not completed");
    }

    // Check if already reviewed
    const existingReview = await this.prisma.review.findFirst({
      where: {
        userId,
        reviewableType: ReviewableType.GARDENER,
        reviewableId: booking.gardenerId,
        bookingId: bookingId,
      },
    });

    if (existingReview) {
      throw new BadRequestException("You have already reviewed this booking");
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        userId,
        reviewableType: ReviewableType.GARDENER,
        reviewableId: booking.gardenerId,
        bookingId: booking.id,
        rating,
        comment,
        isVerifiedPurchase: true,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Update gardener rating
    await this.updateGardenerRating(booking.gardenerId);

    return review;
  }

  // ========== GARDENER BOOKING MANAGEMENT ==========

  // GET /api/v1/gardener/bookings
  async getGardenerBookings(gardenerId: string, filterDto: any) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const {
      page = 1,
      limit = 20,
      status,
      date_from,
      date_to,
    } = filterDto;

    const where: Prisma.ServiceBookingWhereInput = {
      gardenerId: gardener.id,
      ...(status && { status }),
      ...(date_from && { serviceDate: { gte: new Date(date_from) } }),
      ...(date_to && { serviceDate: { lte: new Date(date_to) } }),
    };

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.prisma.serviceBooking.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatarUrl: true,
            },
          },
          serviceAddress: true,
        },
        orderBy: { serviceDate: "asc" },
      }),
      this.prisma.serviceBooking.count({ where }),
    ]);

    return {
      items: bookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /api/v1/gardener/bookings/{booking_id}
  async getGardenerBooking(gardenerId: string, bookingId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const booking = await this.prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        gardenerId: gardener.id,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        serviceAddress: true,
        payments: true,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    return booking;
  }

  // POST /api/v1/gardener/bookings/{booking_id}/accept
  async acceptBooking(gardenerId: string, bookingId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const booking = await this.prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        gardenerId: gardener.id,
        status: BookingStatus.PENDING,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found or already processed");
    }

    // Update booking
    const updated = await this.prisma.serviceBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
      },
    });

    // TODO: Block calendar slot

    return updated;
  }

  // POST /api/v1/gardener/bookings/{booking_id}/reject
  async rejectBooking(gardenerId: string, bookingId: string, rejectDto: any) {
    const { reason } = rejectDto;

    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const booking = await this.prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        gardenerId: gardener.id,
        status: BookingStatus.PENDING,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found or already processed");
    }

    // Update booking
    const updated = await this.prisma.serviceBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledBy: gardenerId,
        cancellationReason: reason,
        cancelledAt: new Date(),
      },
    });

    // Initiate refund
    if (booking.paymentStatus === PaymentStatus.PAID) {
      await this.prisma.payment.create({
        data: {
          bookingId: booking.id,
          userId: booking.userId,
          amount: booking.totalAmount,
          paymentType: "REFUND",
          paymentMethod: "REFUND",
          status: "PENDING",
        },
      });
    }

    // TODO: Notify user

    return updated;
  }

  // POST /api/v1/gardener/bookings/{booking_id}/start
  async startBooking(gardenerId: string, bookingId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const booking = await this.prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        gardenerId: gardener.id,
        status: BookingStatus.CONFIRMED,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found or cannot be started");
    }

    const updated = await this.prisma.serviceBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.IN_PROGRESS,
      },
    });

    return updated;
  }

  // POST /api/v1/gardener/bookings/{booking_id}/complete
  async completeBooking(gardenerId: string, bookingId: string, completeDto: any) {
    const { completion_notes } = completeDto;

    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const booking = await this.prisma.serviceBooking.findFirst({
      where: {
        id: bookingId,
        gardenerId: gardener.id,
        status: BookingStatus.IN_PROGRESS,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found or cannot be completed");
    }

    // Update booking
    const updated = await this.prisma.serviceBooking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Create maintenance task record
    await this.prisma.maintenanceTask.create({
      data: {
        taskNumber: `TASK-${Date.now()}`,
        bookingId: booking.id,
        gardenerId: gardener.id,
        userId: booking.userId,
        addressId: booking.serviceAddressId,
        taskType: "FREELANCE_SERVICE",
        description: completion_notes || `Service completed - ${booking.bookingNumber}`,
        scheduledDate: booking.serviceDate,
        scheduledTime: booking.serviceTime,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Create gardener earnings record
    const commissionRate = new Decimal(0.1); // 10% commission
    const grossAmount = booking.totalAmount;
    const commissionAmount = grossAmount.times(commissionRate);
    const netEarnings = grossAmount.minus(commissionAmount);

    await this.prisma.gardenerEarning.create({
      data: {
        gardenerId: gardener.id,
        bookingId: booking.id,
        earningType: "FREELANCE_BOOKING",
        grossAmount: grossAmount,
        commissionRate: commissionRate,
        commissionAmount: commissionAmount,
        netEarnings: netEarnings,
        status: "PENDING",
      },
    });

    // Update gardener stats
    await this.prisma.gardener.update({
      where: { id: gardener.id },
      data: {
        totalTasksCompleted: {
          increment: 1,
        },
      },
    });

    // TODO: Notify user

    return updated;
  }

  // GET /api/v1/gardener/bookings/calendar
  async getGardenerCalendar(gardenerId: string, filterDto: any) {
    const { month, year } = filterDto;

    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const startDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth()) - 1, 1);
    const endDate = new Date(year || new Date().getFullYear(), month || new Date().getMonth(), 0);

    const bookings = await this.prisma.serviceBooking.findMany({
      where: {
        gardenerId: gardener.id,
        serviceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
        serviceAddress: {
          select: {
            addressLine1: true,
            city: true,
          },
        },
      },
      orderBy: { serviceDate: "asc" },
    });

    // Group by date
    const calendar: Record<string, any[]> = {};
    bookings.forEach((booking) => {
      const dateKey = booking.serviceDate.toISOString().split("T")[0];
      if (!calendar[dateKey]) {
        calendar[dateKey] = [];
      }
      calendar[dateKey].push(booking);
    });

    return {
      month: month || new Date().getMonth(),
      year: year || new Date().getFullYear(),
      calendar,
    };
  }

  // Helper: Update gardener rating
  private async updateGardenerRating(gardenerId: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        reviewableType: ReviewableType.GARDENER,
        reviewableId: gardenerId,
        isActive: true,
      },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return;
    }

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await this.prisma.gardener.update({
      where: { id: gardenerId },
      data: {
        ratingAvg: new Decimal(Math.round(avgRating * 10) / 10),
        totalReviews: reviews.length,
      },
    });
  }

  // Helper: Add hours to time string
}
