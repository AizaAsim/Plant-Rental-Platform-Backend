import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  Prisma,
  UserRole,
  NotificationType,
  PayoutStatus,
  DisputeStatus,
  FeatureType,
  DiscountType,
  ApplicableFor,
} from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import { PaymentsService } from "../payments/payments.service";

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService
  ) {}

  private slugify(name: string) {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") + `-${randomUUID().slice(0, 8)}`
    );
  }

  private async notify(userId: string, title: string, message: string, type: NotificationType) {
    await this.prisma.notification.create({
      data: { userId, title, message, type },
    });
  }

  // --- Users ---
  async listUsers(q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.UserWhereInput = {
      ...(q.role && { role: q.role }),
      ...(q.is_active != null && { isActive: String(q.is_active) === "true" }),
      ...(q.is_verified != null && { isVerified: String(q.is_verified) === "true" }),
      ...(q.search && {
        OR: [
          { email: { contains: q.search, mode: "insensitive" } },
          { fullName: { contains: q.search, mode: "insensitive" } },
          { phone: { contains: q.search, mode: "insensitive" } },
        ],
      }),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: { take: 5, orderBy: { createdAt: "desc" } },
        serviceBookings: { take: 5, orderBy: { createdAt: "desc" } },
        nursery: true,
        gardener: true,
        _count: { select: { orders: true, reviews: true, notifications: true } },
      },
    });
    if (!user) throw new NotFoundException("User not found");
    const { passwordHash, ...rest } = user as any;
    return rest;
  }

  async updateUserStatus(userId: string, body: { is_active?: boolean; reason?: string }) {
    if (typeof body?.is_active !== "boolean") {
      throw new BadRequestException("is_active must be a boolean");
    }
    const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new NotFoundException("User not found");
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: body.is_active },
      select: { id: true, email: true, isActive: true },
    });
    await this.notify(
      userId,
      "Account status updated",
      `Your account is now ${body.is_active ? "active" : "inactive"}.${body.reason ? ` Note: ${body.reason}` : ""}`,
      NotificationType.SYSTEM
    );
    return u;
  }

  async verifyUser(userId: string) {
    const exists = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new NotFoundException("User not found");
    return this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
      select: { id: true, email: true, isVerified: true },
    });
  }

  // --- Nurseries ---
  async listNurseries(q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.NurseryWhereInput = {
      ...(q.is_verified != null && { isVerified: String(q.is_verified) === "true" }),
      ...(q.is_active != null && { isActive: String(q.is_active) === "true" }),
      ...(q.city && { city: { contains: q.city, mode: "insensitive" } }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: "insensitive" } },
          { email: { contains: q.search, mode: "insensitive" } },
        ],
      }),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.nursery.findMany({
        where,
        skip,
        take: limit,
        include: { vendor: { select: { id: true, email: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.nursery.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getNursery(nurseryId: string) {
    const n = await this.prisma.nursery.findUnique({
      where: { id: nurseryId },
      include: {
        vendor: { select: { id: true, email: true, fullName: true, phone: true } },
        _count: { select: { plants: true, orders: true, gardeners: true } },
      },
    });
    if (!n) throw new NotFoundException("Nursery not found");
    return n;
  }

  async verifyNursery(
    nurseryId: string,
    body: { is_verified: boolean; rejection_reason?: string }
  ) {
    const n = await this.prisma.nursery.update({
      where: { id: nurseryId },
      data: { isVerified: body.is_verified },
      include: { vendor: { select: { id: true } } },
    });
    await this.notify(
      n.vendorId,
      body.is_verified ? "Nursery verified" : "Nursery verification update",
      body.is_verified
        ? "Your nursery has been verified on the platform."
        : `Verification was not granted.${body.rejection_reason ? ` ${body.rejection_reason}` : ""}`,
      NotificationType.SYSTEM
    );
    return n;
  }

  async nurseryStatus(nurseryId: string, body: { is_active: boolean; reason?: string }) {
    const n = await this.prisma.nursery.update({
      where: { id: nurseryId },
      data: { isActive: body.is_active },
      include: { vendor: { select: { id: true } } },
    });
    await this.notify(
      n.vendorId,
      "Nursery status",
      `Your nursery is now ${body.is_active ? "active" : "inactive"}.${body.reason ? ` Reason: ${body.reason}` : ""}`,
      NotificationType.SYSTEM
    );
    return n;
  }

  // --- Gardeners ---
  async listGardeners(q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.GardenerWhereInput = {
      ...(q.is_freelancer != null && { isFreelancer: String(q.is_freelancer) === "true" }),
      ...(q.is_verified != null && { isVerified: String(q.is_verified) === "true" }),
      ...(q.is_available != null && { isAvailable: String(q.is_available) === "true" }),
      ...(q.search && {
        user: {
          OR: [
            { fullName: { contains: q.search, mode: "insensitive" } },
            { email: { contains: q.search, mode: "insensitive" } },
          ],
        },
      }),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.gardener.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { id: true, email: true, fullName: true, phone: true } }, nursery: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.gardener.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getGardener(gardenerId: string) {
    const g = await this.prisma.gardener.findUnique({
      where: { id: gardenerId },
      include: {
        user: { select: { id: true, email: true, fullName: true, phone: true, avatarUrl: true } },
        nursery: true,
        _count: { select: { maintenanceTasks: true, serviceBookings: true } },
      },
    });
    if (!g) throw new NotFoundException("Gardener not found");
    return g;
  }

  async verifyGardener(gardenerId: string, body: { is_verified?: boolean }) {
    if (typeof body?.is_verified !== "boolean") {
      throw new BadRequestException("is_verified must be a boolean");
    }
    const exists = await this.prisma.gardener.findUnique({ where: { id: gardenerId }, select: { id: true } });
    if (!exists) throw new NotFoundException("Gardener not found");
    const g = await this.prisma.gardener.update({
      where: { id: gardenerId },
      data: { isVerified: body.is_verified },
      include: { user: { select: { id: true } } },
    });
    await this.notify(
      g.userId,
      "Gardener verification",
      body.is_verified ? "Your gardener profile is verified." : "Your gardener verification was updated.",
      NotificationType.SYSTEM
    );
    return g;
  }

  // --- Orders ---
  async listOrders(q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.OrderWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.order_type && { orderType: q.order_type }),
      ...(q.nursery_id && { nurseryId: q.nursery_id }),
      ...(q.user_id && { userId: q.user_id }),
      ...(q.date_from || q.date_to
        ? {
            createdAt: {
              ...(q.date_from ? { gte: new Date(q.date_from) } : {}),
              ...(q.date_to ? { lte: new Date(q.date_to) } : {}),
            },
          }
        : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          nursery: { select: { id: true, name: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getOrder(orderId: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        nursery: true,
        deliveryAddress: true,
        items: { include: { plant: { include: { images: { take: 3 } } } } },
        payments: true,
        disputes: true,
      },
    });
    if (!o) throw new NotFoundException("Order not found");
    return o;
  }

  // --- Bookings ---
  async listBookings(q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.ServiceBookingWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.gardener_id && { gardenerId: q.gardener_id }),
      ...(q.user_id && { userId: q.user_id }),
      ...(q.date_from || q.date_to
        ? {
            serviceDate: {
              ...(q.date_from ? { gte: new Date(q.date_from) } : {}),
              ...(q.date_to ? { lte: new Date(q.date_to) } : {}),
            },
          }
        : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.serviceBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, fullName: true } },
          gardener: { include: { user: { select: { fullName: true } } } },
        },
      }),
      this.prisma.serviceBooking.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getBooking(bookingId: string) {
    const b = await this.prisma.serviceBooking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        gardener: { include: { user: true } },
        serviceAddress: true,
        payments: true,
        disputes: true,
      },
    });
    if (!b) throw new NotFoundException("Booking not found");
    return b;
  }

  // --- Payouts ---
  async listPayouts(q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.PayoutWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.recipient_type && { recipientType: q.recipient_type }),
      ...(q.date_from || q.date_to
        ? {
            createdAt: {
              ...(q.date_from ? { gte: new Date(q.date_from) } : {}),
              ...(q.date_to ? { lte: new Date(q.date_to) } : {}),
            },
          }
        : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.payout.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async processPayout(
    payoutId: string,
    body: { status?: string; bank_reference?: string; notes?: string }
  ) {
    if (!body?.status || typeof body.status !== "string") {
      throw new BadRequestException("status is required");
    }
    if (!Object.values(PayoutStatus).includes(body.status as PayoutStatus)) {
      throw new BadRequestException("Invalid payout status");
    }
    const exists = await this.prisma.payout.findUnique({ where: { id: payoutId }, select: { id: true } });
    if (!exists) throw new NotFoundException("Payout not found");
    const status = body.status as PayoutStatus;
    const p = await this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status,
        bankReference: body.bank_reference,
        notes: body.notes,
        processedAt: status === PayoutStatus.COMPLETED ? new Date() : undefined,
      },
    });
    await this.notify(
      p.recipientId,
      "Payout update",
      `Your payout ${p.payoutNumber} is now ${status}.`,
      NotificationType.PAYMENT
    );
    return p;
  }

  // --- Disputes (admin) ---
  async listDisputes(q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.DisputeWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.dispute_type && { disputeType: q.dispute_type }),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { raiser: { select: { id: true, fullName: true, email: true } } },
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getDispute(disputeId: string) {
    const d = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { fullName: true } } } },
        raiser: true,
        order: true,
        booking: true,
      },
    });
    if (!d) throw new NotFoundException("Dispute not found");
    return d;
  }

  async addDisputeMessageAdmin(disputeId: string, adminUserId: string, body: { message?: string; attachments?: string[] }) {
    if (!body?.message || typeof body.message !== "string" || !body.message.trim()) {
      throw new BadRequestException("message is required");
    }
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId }, select: { id: true } });
    if (!dispute) throw new NotFoundException("Dispute not found");
    return this.prisma.disputeMessage.create({
      data: {
        disputeId,
        senderId: adminUserId,
        message: body.message,
        attachments: body.attachments || [],
      },
    });
  }

  async resolveDispute(disputeId: string, adminUserId: string, body: { resolution: string; refund_amount?: number }) {
    const before = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, orderId: true, bookingId: true },
    });
    if (!before) throw new NotFoundException("Dispute not found");

    const d = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution: body.resolution,
        resolvedBy: adminUserId,
        resolvedAt: new Date(),
      },
      include: {
        raiser: { select: { id: true } },
        order: { select: { userId: true } },
        booking: { select: { userId: true } },
      },
    });

    const refund = await this.paymentsService.applyDisputeRefund({
      orderId: before.orderId,
      bookingId: before.bookingId,
      refund_amount: body.refund_amount,
      resolution: body.resolution,
    });

    await this.notify(d.raisedBy, "Dispute resolved", body.resolution, NotificationType.SYSTEM);
    if (d.order?.userId && d.order.userId !== d.raisedBy) {
      await this.notify(d.order.userId, "Dispute resolved", body.resolution, NotificationType.SYSTEM);
    }
    if (d.booking?.userId && d.booking.userId !== d.raisedBy) {
      await this.notify(d.booking.userId, "Dispute resolved", body.resolution, NotificationType.SYSTEM);
    }

    if (refund.refund_applied && d.raisedBy) {
      await this.notify(
        d.raisedBy,
        "Refund processed",
        `A refund of ${refund.refund_amount} was applied to the original payment (mock).`,
        NotificationType.PAYMENT
      );
    }

    return { ...d, refund };
  }

  // --- Featured plants ---
  async listFeatured(q: any) {
    const where: Prisma.FeaturedPlantWhereInput = {
      ...(q.feature_type && { featureType: q.feature_type }),
      ...(q.is_active != null && { isActive: String(q.is_active) === "true" }),
    };
    return this.prisma.featuredPlant.findMany({
      where,
      include: {
        plant: {
          include: {
            nursery: { select: { name: true } },
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      orderBy: [{ featureType: "asc" }, { displayOrder: "asc" }],
    });
  }

  async createFeatured(body: {
    plant_id?: string;
    feature_type?: FeatureType;
    display_order?: number;
    start_date?: string;
    end_date?: string;
  }) {
    if (!body?.plant_id || !body?.feature_type) {
      throw new BadRequestException("plant_id and feature_type are required");
    }
    return this.prisma.featuredPlant.create({
      data: {
        plantId: body.plant_id,
        featureType: body.feature_type,
        displayOrder: body.display_order ?? 0,
        startDate: body.start_date ? new Date(body.start_date) : null,
        endDate: body.end_date ? new Date(body.end_date) : null,
      },
    });
  }

  async updateFeatured(id: string, body: any) {
    const exists = await this.prisma.featuredPlant.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException("Featured plant not found");
    const data: Prisma.FeaturedPlantUpdateInput = {};
    if (body.display_order != null) data.displayOrder = body.display_order;
    if (body.is_active != null) data.isActive = body.is_active;
    if (body.start_date !== undefined) data.startDate = body.start_date ? new Date(body.start_date) : null;
    if (body.end_date !== undefined) data.endDate = body.end_date ? new Date(body.end_date) : null;
    if (body.feature_type) data.featureType = body.feature_type;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("No fields to update");
    }
    return this.prisma.featuredPlant.update({ where: { id }, data });
  }

  async deleteFeatured(id: string) {
    const exists = await this.prisma.featuredPlant.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException("Featured plant not found");
    await this.prisma.featuredPlant.delete({ where: { id } });
    return { success: true };
  }

  // --- Coupons ---
  async listCoupons(q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.CouponWhereInput = {
      ...(q.is_active != null && { isActive: String(q.is_active) === "true" }),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.coupon.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createCoupon(body: any) {
    if (
      !body?.code ||
      body.discount_value == null ||
      !body?.valid_from ||
      !body?.valid_until ||
      !body?.discount_type
    ) {
      throw new BadRequestException(
        "code, discount_type, discount_value, valid_from, and valid_until are required"
      );
    }
    return this.prisma.coupon.create({
      data: {
        code: body.code,
        description: body.description,
        discountType: body.discount_type as DiscountType,
        discountValue: new Decimal(body.discount_value),
        minOrderAmount: new Decimal(body.min_order_amount ?? 0),
        maxDiscountAmount: body.max_discount_amount != null ? new Decimal(body.max_discount_amount) : null,
        applicableFor: (body.applicable_for as ApplicableFor) || ApplicableFor.ALL,
        usageLimit: body.usage_limit ?? null,
        perUserLimit: body.per_user_limit ?? 1,
        validFrom: new Date(body.valid_from),
        validUntil: new Date(body.valid_until),
        isActive: true,
      },
    });
  }

  async updateCoupon(couponId: string, body: any) {
    const exists = await this.prisma.coupon.findUnique({ where: { id: couponId }, select: { id: true } });
    if (!exists) throw new NotFoundException("Coupon not found");
    const data: Prisma.CouponUpdateInput = {};
    if (body.description != null) data.description = body.description;
    if (body.discount_value != null) data.discountValue = new Decimal(body.discount_value);
    if (body.min_order_amount != null) data.minOrderAmount = new Decimal(body.min_order_amount);
    if (body.max_discount_amount !== undefined)
      data.maxDiscountAmount = body.max_discount_amount != null ? new Decimal(body.max_discount_amount) : null;
    if (body.usage_limit !== undefined) data.usageLimit = body.usage_limit;
    if (body.per_user_limit != null) data.perUserLimit = body.per_user_limit;
    if (body.valid_from) data.validFrom = new Date(body.valid_from);
    if (body.valid_until) data.validUntil = new Date(body.valid_until);
    if (body.is_active != null) data.isActive = body.is_active;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("No fields to update");
    }
    return this.prisma.coupon.update({ where: { id: couponId }, data });
  }

  async deactivateCoupon(couponId: string) {
    const exists = await this.prisma.coupon.findUnique({ where: { id: couponId }, select: { id: true } });
    if (!exists) throw new NotFoundException("Coupon not found");
    await this.prisma.coupon.update({ where: { id: couponId }, data: { isActive: false } });
    return { success: true };
  }

  // --- Platform settings ---
  async listSettings() {
    return this.prisma.platformSetting.findMany({ orderBy: { key: "asc" } });
  }

  async upsertSetting(key: string, body: { value?: string }, adminId?: string) {
    if (body?.value === undefined || body?.value === null) {
      throw new BadRequestException("value is required");
    }
    if (typeof body.value !== "string") {
      throw new BadRequestException("value must be a string");
    }
    return this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: body.value, updatedBy: adminId },
      update: { value: body.value, updatedBy: adminId },
    });
  }

  async getCommission() {
    const v = await this.prisma.platformSetting.findUnique({ where: { key: "commission.vendor_rate" } });
    const g = await this.prisma.platformSetting.findUnique({ where: { key: "commission.gardener_rate" } });
    return {
      vendor_commission_rate: v ? Number(v.value) : 0.1,
      gardener_commission_rate: g ? Number(g.value) : 0.1,
    };
  }

  async setCommission(body: { vendor_commission_rate: number; gardener_commission_rate: number }) {
    await this.prisma.platformSetting.upsert({
      where: { key: "commission.vendor_rate" },
      create: { key: "commission.vendor_rate", value: String(body.vendor_commission_rate) },
      update: { value: String(body.vendor_commission_rate) },
    });
    await this.prisma.platformSetting.upsert({
      where: { key: "commission.gardener_rate" },
      create: { key: "commission.gardener_rate", value: String(body.gardener_commission_rate) },
      update: { value: String(body.gardener_commission_rate) },
    });
    return this.getCommission();
  }

  // --- Categories ---
  async listCategoriesTree() {
    const all = await this.prisma.plantCategory.findMany({
      orderBy: { name: "asc" },
    });
    const byParent = new Map<string | null, typeof all>();
    for (const c of all) {
      const pid = c.parentId;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(c);
    }
    const build = (parentId: string | null): any[] =>
      (byParent.get(parentId) || []).map((c) => ({
        ...c,
        children: build(c.id),
      }));
    return build(null);
  }

  async createCategory(body: { name?: string; description?: string; image_url?: string; parent_id?: string }) {
    if (!body?.name || typeof body.name !== "string") {
      throw new BadRequestException("name is required");
    }
    return this.prisma.plantCategory.create({
      data: {
        name: body.name,
        slug: this.slugify(body.name),
        description: body.description,
        imageUrl: body.image_url,
        parentId: body.parent_id,
      },
    });
  }

  async updateCategory(categoryId: string, body: any) {
    const exists = await this.prisma.plantCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!exists) throw new NotFoundException("Category not found");
    const data: Prisma.PlantCategoryUpdateInput = {};
    if (body.name != null) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.image_url !== undefined) data.imageUrl = body.image_url;
    if (body.parent_id !== undefined) {
      data.parent = body.parent_id
        ? { connect: { id: body.parent_id } }
        : { disconnect: true };
    }
    if (body.is_active != null) data.isActive = body.is_active;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("No fields to update");
    }
    return this.prisma.plantCategory.update({ where: { id: categoryId }, data });
  }

  async deleteCategory(categoryId: string) {
    const cat = await this.prisma.plantCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!cat) throw new NotFoundException("Category not found");
    const count = await this.prisma.plant.count({ where: { categoryId } });
    if (count > 0) {
      throw new BadRequestException("Cannot delete category with assigned plants");
    }
    const children = await this.prisma.plantCategory.count({ where: { parentId: categoryId } });
    if (children > 0) {
      throw new BadRequestException("Cannot delete category with child categories");
    }
    await this.prisma.plantCategory.delete({ where: { id: categoryId } });
    return { success: true };
  }

  // --- Skills ---
  async listSkills() {
    return this.prisma.gardenerSkill.findMany({ orderBy: { name: "asc" } });
  }

  async createSkill(body: { name?: string }) {
    if (!body?.name || typeof body.name !== "string") {
      throw new BadRequestException("name is required");
    }
    return this.prisma.gardenerSkill.create({ data: { name: body.name } });
  }

  async deleteSkill(skillId: string) {
    const skill = await this.prisma.gardenerSkill.findUnique({ where: { id: skillId }, select: { id: true } });
    if (!skill) throw new NotFoundException("Skill not found");
    const maps = await this.prisma.gardenerSkillMapping.count({ where: { skillId } });
    if (maps > 0) throw new BadRequestException("Skill is assigned to gardeners");
    await this.prisma.gardenerSkill.delete({ where: { id: skillId } });
    return { success: true };
  }

  /** Admin dashboard: list order complaints (also exposed on AdminController). */
  async listOrderComplaints(q: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(Number(q.limit) || 50, 100);
    const skip = (page - 1) * limit;
    const where = q.status ? { status: q.status as any } : {};

    const [items, total] = await Promise.all([
      this.prisma.orderComplaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { orderNumber: true, nurseryId: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.orderComplaint.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async searchPlants(q: { search?: string; limit?: string }) {
    const limit = Math.min(Number(q.limit) || 20, 50);
    const search = q.search?.trim();
    const where: Prisma.PlantWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { id: search },
          ],
        }
      : {};
    return this.prisma.plant.findMany({
      where,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nursery: { select: { name: true } },
      },
    });
  }

  // --- Contract v3.1: manual intervention (MISS-19 / MISS-20) ---

  async listManualOrders(q: { status?: string; priority?: string; page?: string; limit?: string }) {
    const page = Math.max(1, parseInt(q.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10) || 20));
    const where: Prisma.ManualInterventionOrderWhereInput = {};
    if (q.status) where.status = q.status as "OPEN" | "RESOLVED";
    if (q.priority) where.priority = q.priority;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.manualInterventionOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { order: { select: { orderNumber: true, status: true } } },
      }),
      this.prisma.manualInterventionOrder.count({ where }),
    ]);
    return {
      success: true,
      data: {
        items: rows.map((r) => ({
          id: r.id,
          order_id: r.orderId,
          order_number: r.order.orderNumber,
          status: r.status,
          priority: r.priority,
          reason: r.reason,
        })),
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
      },
    };
  }

  async resolveManualOrder(orderId: string, body: { action: string; note?: string }) {
    const row = await this.prisma.manualInterventionOrder.findUnique({ where: { orderId } });
    if (!row) throw new NotFoundException("No manual case for this order");
    if (!["REASSIGN", "CANCEL", "FORCE_APPROVE"].includes(body.action)) {
      throw new BadRequestException("Invalid action");
    }
    await this.prisma.manualInterventionOrder.update({
      where: { id: row.id },
      data: {
        status: "RESOLVED",
        resolutionNote: body.note,
        resolvedAt: new Date(),
      },
    });
    return { success: true, data: { order_id: orderId, action: body.action } };
  }

  async getFreelanceMatchConfig() {
    const c = await this.prisma.freelanceMatchConfig.findUnique({ where: { id: "singleton" } });
    if (!c) throw new NotFoundException("config");
    return {
      success: true,
      data: {
        auto_match_enabled: c.autoMatchEnabled,
        auto_match_score_threshold: Number(c.autoMatchScoreThreshold),
        gardener_accept_window_minutes: c.gardenerAcceptWindowMinutes,
      },
    };
  }

  async setFreelanceMatchConfig(body: {
    auto_match_enabled?: boolean;
    auto_match_score_threshold?: number;
    gardener_accept_window_minutes?: number;
  }) {
    const c = await this.prisma.freelanceMatchConfig.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        autoMatchEnabled: body.auto_match_enabled ?? false,
        autoMatchScoreThreshold: body.auto_match_score_threshold ?? 0.8,
        gardenerAcceptWindowMinutes: body.gardener_accept_window_minutes ?? 30,
      },
      update: {
        ...(body.auto_match_enabled !== undefined && { autoMatchEnabled: body.auto_match_enabled }),
        ...(body.auto_match_score_threshold !== undefined && {
          autoMatchScoreThreshold: body.auto_match_score_threshold,
        }),
        ...(body.gardener_accept_window_minutes !== undefined && {
          gardenerAcceptWindowMinutes: body.gardener_accept_window_minutes,
        }),
      },
    });
    return {
      success: true,
      data: {
        auto_match_enabled: c.autoMatchEnabled,
        auto_match_score_threshold: Number(c.autoMatchScoreThreshold),
        gardener_accept_window_minutes: c.gardenerAcceptWindowMinutes,
      },
    };
  }
}
