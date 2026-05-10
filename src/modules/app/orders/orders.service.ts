// src/modules/app/orders/orders.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import {
  OrderItem,
  Prisma,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentType,
  RentalStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
  TransactionStatus,
  NotificationType,
} from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";
import { CartService } from "../cart/cart.service";
import {
  VendorRentalBucket,
  VENDOR_RENTAL_BUCKETS,
} from "./vendor-rental-buckets";
import { resolveOrderId } from "src/common/contract/resolve-entity";
import {
  tryFulfillmentLineCondition,
  FULFILLMENT_LINE_CONDITIONS,
} from "./fulfillment-line.constants";

const VENDOR_REJECT_REASON_MIN_LEN = 3;
const VENDOR_REJECT_REASON_MAX_LEN = 2000;
const ASSIGN_MAINTENANCE_SCHEDULES = ["WEEKLY", "BIWEEKLY", "MONTHLY"] as const;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService
  ) {}

  /** reason or rejection_reason; trimmed non-empty bounded length */
  private parseVendorRejectReason(body: Record<string, unknown> | undefined | null): string {
    const raw = body?.reason ?? body?.rejection_reason ?? body?.cancellation_reason;
    const s =
      typeof raw === "string" ? raw.trim() : raw != null ? String(raw).trim() : "";
    if (s.length < VENDOR_REJECT_REASON_MIN_LEN) {
      throw new BadRequestException(
        `Rejection requires a clear reason (${VENDOR_REJECT_REASON_MIN_LEN}-${VENDOR_REJECT_REASON_MAX_LEN} characters)`
      );
    }
    if (s.length > VENDOR_REJECT_REASON_MAX_LEN) {
      throw new BadRequestException(`Rejection reason must be at most ${VENDOR_REJECT_REASON_MAX_LEN} characters`);
    }
    return s;
  }

  /** Stock is decremented at vendor approve (v4 flow), not at checkout. `vendor_approval_selections` is set atomically with that reservation. */
  private inventoryReservedAtApproval(order: { vendorApprovalSelections: Prisma.JsonValue | null }): boolean {
    return order.vendorApprovalSelections != null;
  }

  /** Assign-gardener / processing path: nursery work after money captured */
  private assertOrderPaid(order: { paymentStatus: PaymentStatus }, action: string) {
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        `${action}: order payment_status must be PAID before this action`
      );
    }
  }

  private parseAssignMaintenanceSchedule(raw: unknown): (typeof ASSIGN_MAINTENANCE_SCHEDULES)[number] {
    const s = String(raw ?? "")
      .trim()
      .toUpperCase()
      .replace(/-/g, "_");
    if ((ASSIGN_MAINTENANCE_SCHEDULES as readonly string[]).includes(s)) {
      return s as (typeof ASSIGN_MAINTENANCE_SCHEDULES)[number];
    }
    throw new BadRequestException(
      `maintenance_schedule must be one of: ${ASSIGN_MAINTENANCE_SCHEDULES.join(", ")}`
    );
  }

  /** When delivery_slots is sent from vendor, mirror propose-delivery-slots slot shape */
  private assertDeliverySlotsArrayShape(slots: unknown): void {
    if (slots == null) return;
    if (!Array.isArray(slots)) {
      throw new BadRequestException("delivery_slots must be an array when provided");
    }
    slots.forEach((s, idx) => {
      if (!s || typeof s !== "object") {
        throw new BadRequestException(`delivery_slots[${idx}] must be an object`);
      }
      const row = s as Record<string, unknown>;
      const date = row.date != null ? String(row.date).trim() : "";
      const from = row.time_from != null ? String(row.time_from).trim() : "";
      const to = row.time_to != null ? String(row.time_to).trim() : "";
      if (!date || !from || !to) {
        throw new BadRequestException(
          `delivery_slots[${idx}]: date, time_from, and time_to are required strings`
        );
      }
    });
  }

  private assertCustomerOrderAllowsRentalMutation(order: { status: OrderStatus }, actionLabel: string) {
    const blocked = new Set<OrderStatus>([
      OrderStatus.CANCELLED,
      OrderStatus.EXPIRED,
    ]);
    if (blocked.has(order.status)) {
      throw new BadRequestException(`${actionLabel} is not allowed when order status is ${order.status}`);
    }
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ORD-${timestamp}-${random}`;
  }

  /** Query params arrive as strings — Prisma requires numeric skip/take. */
  private normalizePaging(filterDto: { page?: unknown; limit?: unknown }, defaultLimit = 20) {
    const pageNum = Math.max(1, Number.parseInt(String(filterDto.page ?? 1), 10) || 1);
    let limitNum = Number.parseInt(String(filterDto.limit ?? defaultLimit), 10);
    if (!Number.isFinite(limitNum) || limitNum < 1) limitNum = defaultLimit;
    limitNum = Math.min(limitNum, 100);
    const skip = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, skip };
  }

  private coerceProofUrlsJson(raw: unknown): Prisma.InputJsonValue | undefined {
    if (raw == null) return undefined;
    if (!Array.isArray(raw)) {
      throw new BadRequestException("proof_image_urls must be an array when provided");
    }
    return raw as Prisma.InputJsonValue;
  }

  private parseOptionalIsoInstant(raw: unknown, fieldLabel: string): Date | undefined {
    if (raw == null || String(raw).trim() === "") return undefined;
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${fieldLabel} must be a valid ISO date-time`);
    }
    return d;
  }

  private mapFulfillmentLine(oi: OrderItem) {
    return {
      order_item_id: oi.id,
      plant_id: oi.plantId,
      order_type: oi.orderType,
      quantity: oi.quantity,
      rental_status: oi.rentalStatus,
      delivery: {
        proof_at: oi.deliveryProofAt?.toISOString() ?? null,
        condition: oi.deliveryCondition,
        proof_urls: oi.deliveryProofUrls ?? null,
        notes: oi.deliveryLineNotes,
      },
      return: {
        proof_at: oi.returnProofAt?.toISOString() ?? null,
        condition: oi.returnCondition,
        proof_urls: oi.returnProofUrls ?? null,
        notes: oi.returnLineNotes,
        restocked: oi.restocked,
        restocked_at: oi.restockedAt?.toISOString() ?? null,
        actual_return_date: oi.actualReturnDate?.toISOString().slice(0, 10) ?? null,
      },
    };
  }

  private proofImageCountFromJson(urls: unknown): number {
    return Array.isArray(urls) ? urls.length : 0;
  }

  /** Recursively replace proof URL arrays under common keys for customer responses. */
  private redactWorkflowMetaForCustomer(raw: unknown): unknown {
    if (raw == null) return null;
    if (Array.isArray(raw)) return raw.map((x) => this.redactWorkflowMetaForCustomer(x));
    if (typeof raw !== "object") return raw;
    const o = raw as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const redactKeys = new Set([
      "proof_image_urls",
      "proof_urls",
      "delivery_proof_urls",
      "return_proof_urls",
    ]);
    for (const [k, v] of Object.entries(o)) {
      if (redactKeys.has(k) && Array.isArray(v)) {
        out[k] = { redacted: true, count: v.length };
      } else {
        out[k] = this.redactWorkflowMetaForCustomer(v) as unknown;
      }
    }
    return out;
  }

  private mapFulfillmentLineCustomer(oi: OrderItem) {
    return {
      order_item_id: oi.id,
      plant_id: oi.plantId,
      order_type: oi.orderType,
      quantity: oi.quantity,
      rental_status: oi.rentalStatus,
      delivery: {
        proof_at: oi.deliveryProofAt?.toISOString() ?? null,
        condition: oi.deliveryCondition,
        proof_urls_redacted: true,
        proof_image_count: this.proofImageCountFromJson(oi.deliveryProofUrls),
        notes: oi.deliveryLineNotes,
      },
      return: {
        proof_at: oi.returnProofAt?.toISOString() ?? null,
        condition: oi.returnCondition,
        proof_urls_redacted: true,
        proof_image_count: this.proofImageCountFromJson(oi.returnProofUrls),
        notes: oi.returnLineNotes,
        restocked: oi.restocked,
        restocked_at: oi.restockedAt?.toISOString() ?? null,
        actual_return_date: oi.actualReturnDate?.toISOString().slice(0, 10) ?? null,
      },
    };
  }

  /** Midnight-based calendar-day bounds in the server's local timezone. */
  private rentalCalendarBounds() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { today, tomorrow };
  }

  private vendorRentalsDefaultInclude(): Prisma.OrderItemInclude {
    return {
      plant: true,
      order: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          deliveryAddress: true,
        },
      },
    };
  }

  private vendorRentalWhereClause(
    nurseryId: string,
    bucket: VendorRentalBucket,
    bounds: { today: Date; tomorrow: Date }
  ): Prisma.OrderItemWhereInput {
    const baseOrder: Prisma.OrderWhereInput = { nurseryId };
    if (bucket === "COMPLETED") {
      return {
        order: baseOrder,
        orderType: OrderType.RENT,
        rentalStatus: RentalStatus.RETURNED,
      };
    }
    if (bucket === "ONGOING") {
      return {
        order: baseOrder,
        orderType: OrderType.RENT,
        rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
        OR: [{ rentEndDate: null }, { rentEndDate: { gte: bounds.tomorrow } }],
      };
    }
    if (bucket === "DUE_TODAY") {
      return {
        order: baseOrder,
        orderType: OrderType.RENT,
        rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
        rentEndDate: { gte: bounds.today, lt: bounds.tomorrow },
      };
    }
    return {
      order: baseOrder,
      orderType: OrderType.RENT,
      OR: [
        { rentalStatus: RentalStatus.OVERDUE },
        {
          rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
          rentEndDate: { not: null, lt: bounds.today },
        },
      ],
    };
  }

  private normalizeVendorRentalBucket(raw?: unknown): VendorRentalBucket {
    const s = String(raw ?? "ONGOING")
      .trim()
      .toUpperCase();
    if ((VENDOR_RENTAL_BUCKETS as readonly string[]).includes(s)) {
      return s as VendorRentalBucket;
    }
    throw new BadRequestException(
      `Invalid bucket; use one of: ${VENDOR_RENTAL_BUCKETS.join(", ")}`
    );
  }

  async getVendorRentalsByBucket(
    vendorId: string,
    q: { bucket?: string; page?: string; limit?: string }
  ) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const bounds = this.rentalCalendarBounds();
    const bucket = this.normalizeVendorRentalBucket(q.bucket);
    const { pageNum, limitNum, skip } = this.normalizePaging(q, 20);
    const where = this.vendorRentalWhereClause(nursery.id, bucket, bounds);

    const [ongoing, dueToday, overdue, completed, items, total] =
      await this.prisma.$transaction([
        this.prisma.orderItem.count({
          where: this.vendorRentalWhereClause(nursery.id, "ONGOING", bounds),
        }),
        this.prisma.orderItem.count({
          where: this.vendorRentalWhereClause(nursery.id, "DUE_TODAY", bounds),
        }),
        this.prisma.orderItem.count({
          where: this.vendorRentalWhereClause(nursery.id, "OVERDUE", bounds),
        }),
        this.prisma.orderItem.count({
          where: this.vendorRentalWhereClause(nursery.id, "COMPLETED", bounds),
        }),
        this.prisma.orderItem.findMany({
          where,
          skip,
          take: limitNum,
          include: this.vendorRentalsDefaultInclude(),
          orderBy: { rentEndDate: "asc" },
        }),
        this.prisma.orderItem.count({ where }),
      ]);

    return {
      bucket,
      counts: {
        ongoing,
        due_today: dueToday,
        overdue,
        completed,
      },
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 0,
      },
    };
  }

  // POST /api/v1/orders/checkout
  async checkout(userId: string, checkoutDto: any) {
    const { delivery_address_id, payment_method, notes, coupon_code } = checkoutDto;

    // Get user's cart
    const cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            plant: {
              include: {
                nursery: true,
              },
            },
          },
        },
        packageItems: {
          include: {
            package: {
              include: {
                items: {
                  include: {
                    plant: {
                      include: {
                        nursery: true,
                      },
                    },
                  },
                },
              },
            },
            customPackage: {
              include: {
                items: {
                  include: {
                    plant: {
                      include: {
                        nursery: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || (cart.items.length === 0 && cart.packageItems.length === 0)) {
      throw new BadRequestException("Cart is empty");
    }

    // Validate delivery address
    const deliveryAddress = await this.prisma.userAddress.findFirst({
      where: {
        id: delivery_address_id,
        userId,
      },
    });

    if (!deliveryAddress) {
      throw new NotFoundException("Delivery address not found");
    }

    // Validate cart
    const validation = await this.cartService.validateCart(userId);
    if (!validation.valid) {
      throw new BadRequestException("Cart validation failed", {
        cause: validation.issues,
      });
    }

    // Group items by nursery
    const nurseryGroups = new Map<string, any[]>();

    // Add plant items
    for (const item of cart.items) {
      const nurseryId = item.plant.nurseryId;
      if (!nurseryGroups.has(nurseryId)) {
        nurseryGroups.set(nurseryId, []);
      }
      nurseryGroups.get(nurseryId)!.push({
        type: "plant",
        item,
      });
    }

    // Add package items
    for (const pkgItem of cart.packageItems) {
      if (pkgItem.package) {
        // Fixed package - get nursery from first plant
        const firstPlant = pkgItem.package.items[0]?.plant;
        if (firstPlant) {
          const nurseryId = firstPlant.nurseryId;
          if (!nurseryGroups.has(nurseryId)) {
            nurseryGroups.set(nurseryId, []);
          }
          nurseryGroups.get(nurseryId)!.push({
            type: "package",
            item: pkgItem,
          });
        }
      } else if (pkgItem.customPackage) {
        // Custom package - get nursery from first plant
        const firstPlant = pkgItem.customPackage.items[0]?.plant;
        if (firstPlant) {
          const nurseryId = firstPlant.nurseryId;
          if (!nurseryGroups.has(nurseryId)) {
            nurseryGroups.set(nurseryId, []);
          }
          nurseryGroups.get(nurseryId)!.push({
            type: "custom_package",
            item: pkgItem,
          });
        }
      }
    }

    // Process coupon if provided
    let coupon = null;
    let totalCartSubtotal = new Decimal(0);
    
    // Calculate total cart subtotal for coupon validation
    for (const item of cart.items) {
      const plant = item.plant;
      let unitPrice = new Decimal(0);
      if (item.orderType === OrderType.RENT && plant.rentPriceMonthly) {
        const startDate = new Date(item.rentStartDate);
        const endDate = new Date(item.rentEndDate);
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const months = days / 30;
        unitPrice = plant.rentPriceMonthly.times(months);
      } else if (item.orderType === OrderType.BUY && plant.buyPrice) {
        unitPrice = plant.buyPrice;
      }
      totalCartSubtotal = totalCartSubtotal.plus(unitPrice.times(item.quantity));
    }

    for (const pkgItem of cart.packageItems) {
      const pkg = pkgItem.package || pkgItem.customPackage;
      if (pkg) {
        totalCartSubtotal = totalCartSubtotal.plus(pkg.price.times(pkgItem.quantity));
      }
    }

    if (coupon_code) {
      coupon = await this.prisma.coupon.findFirst({
        where: {
          code: coupon_code,
          isActive: true,
          validFrom: { lte: new Date() },
          validUntil: { gte: new Date() },
        },
      });

      if (coupon && totalCartSubtotal.lt(coupon.minOrderAmount)) {
        throw new BadRequestException(`Minimum order amount of ${coupon.minOrderAmount} required for this coupon`);
      }
    }

    // Create orders per nursery
    const createdOrders = [];

    for (const [nurseryId, items] of nurseryGroups.entries()) {
      const nursery = await this.prisma.nursery.findUnique({
        where: { id: nurseryId },
      });

      if (!nursery) {
        continue;
      }

      // Calculate totals for this nursery's order
      let subtotal = new Decimal(0);
      let totalDeposit = new Decimal(0);
      let deliveryFee = new Decimal(50); // Default delivery fee per nursery
      const orderItems: any[] = [];

      // Process plant items
      for (const { type, item } of items) {
        if (type === "plant") {
          const plant = item.plant;
          let unitPrice = new Decimal(0);

          if (item.orderType === OrderType.RENT && plant.rentPriceMonthly) {
            const startDate = new Date(item.rentStartDate);
            const endDate = new Date(item.rentEndDate);
            const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const months = days / 30;
            unitPrice = plant.rentPriceMonthly.times(months);
          } else if (item.orderType === OrderType.BUY && plant.buyPrice) {
            unitPrice = plant.buyPrice;
          }

          const itemTotal = unitPrice.times(item.quantity);
          subtotal = subtotal.plus(itemTotal);

          if (plant.depositAmount) {
            totalDeposit = totalDeposit.plus(plant.depositAmount.times(item.quantity));
          }

          orderItems.push({
            plantId: plant.id,
            quantity: item.quantity,
            orderType: item.orderType,
            unitPrice,
            depositPerUnit: plant.depositAmount || new Decimal(0),
            totalPrice: itemTotal,
            rentStartDate: item.rentStartDate ? new Date(item.rentStartDate) : null,
            rentEndDate: item.rentEndDate ? new Date(item.rentEndDate) : null,
            rentalStatus: item.orderType === OrderType.RENT ? RentalStatus.ACTIVE : null,
          });
        } else if (type === "package" || type === "custom_package") {
          const pkg = type === "package" ? item.package : item.customPackage;
          const packagePrice = pkg.price.times(item.quantity);
          subtotal = subtotal.plus(packagePrice);

          // Add package plants as order items
          for (const pkgPlantItem of pkg.items) {
            const plant = pkgPlantItem.plant;
            const unitPrice = plant.buyPrice || plant.rentPriceMonthly || new Decimal(0);
            const itemTotal = unitPrice.times(pkgPlantItem.quantity * item.quantity);

            orderItems.push({
              plantId: plant.id,
              quantity: pkgPlantItem.quantity * item.quantity,
              orderType: OrderType.BUY, // Packages are typically purchases
              unitPrice,
              depositPerUnit: plant.depositAmount || new Decimal(0),
              totalPrice: itemTotal,
            });
          }
        }
      }

      // Calculate tax (example: 5% GST)
      const taxAmount = subtotal.times(0.05);

      // Apply discount (proportional to this order)
      let orderDiscount = new Decimal(0);
      if (coupon && totalCartSubtotal.gt(0)) {
        const orderProportion = subtotal.dividedBy(totalCartSubtotal);
        let discount = new Decimal(0);
        
        if (coupon.discountType === "PERCENTAGE") {
          discount = totalCartSubtotal.times(coupon.discountValue).dividedBy(100);
          if (coupon.maxDiscountAmount) {
            discount = Decimal.min(discount, coupon.maxDiscountAmount);
          }
        } else {
          discount = coupon.discountValue;
        }
        
        orderDiscount = discount.times(orderProportion);
      }

      // Calculate total
      const totalAmount = subtotal.plus(deliveryFee).plus(taxAmount).minus(orderDiscount);

      // Determine order type
      const hasRent = orderItems.some((i) => i.orderType === OrderType.RENT);
      const hasBuy = orderItems.some((i) => i.orderType === OrderType.BUY);
      const orderType = hasRent && hasBuy ? OrderType.MIXED : hasRent ? OrderType.RENT : OrderType.BUY;

      // Create order
      const order = await this.prisma.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          userId,
          nurseryId,
          deliveryAddressId: delivery_address_id,
          orderType,
          status: OrderStatus.PENDING,
          subtotal,
          deliveryFee,
          taxAmount,
          discountAmount: orderDiscount,
          depositAmount: totalDeposit,
          totalAmount,
          paymentMethod: payment_method,
          paymentStatus: PaymentStatus.PENDING,
          notes,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              plant: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
          nursery: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
          deliveryAddress: true,
        },
      });

      // Inventory is reserved when the vendor approves (`vendorApproveOrder`), not at checkout.

      // Order payment rows are created only via POST /payments/initiate after the customer has
      // confirmed a delivery slot (SLOT_CONFIRMED → AWAITING_PAYMENT).

      // Create coupon usage if coupon applied
      if (coupon && orderDiscount.gt(0)) {
        await this.prisma.couponUsage.create({
          data: {
            couponId: coupon.id,
            userId,
            orderId: order.id,
            discountApplied: orderDiscount,
          },
        });
      }

      createdOrders.push(order);
    }

    // Clear cart
    await this.cartService.clearCart(userId);

    return {
      orders: createdOrders,
      payment_required: true,
    };
  }

  // GET /api/v1/orders
  async getUserOrders(userId: string, filterDto: any) {
    const { status, order_type, date_from, date_to } = filterDto;
    const { pageNum, limitNum, skip } = this.normalizePaging(filterDto, 20);

    const where: Prisma.OrderWhereInput = {
      userId,
      ...(status && { status }),
      ...(order_type && { orderType: order_type }),
      ...(date_from && { createdAt: { gte: new Date(date_from) } }),
      ...(date_to && { createdAt: { lte: new Date(date_to) } }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          items: {
            include: {
              plant: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
          nursery: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 0,
      },
    };
  }

  // GET /api/v1/orders/{order_id}
  async getOrderById(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        items: {
          include: {
            plant: {
              include: {
                images: true,
                nursery: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            rentalExtensions: true,
          },
        },
        nursery: true,
        deliveryAddress: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
        couponUsage: {
          include: {
            coupon: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  // GET /api/v1/orders/{order_id}/tracking
  async getOrderTracking(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        deliveredAt: true,
        items: {
          select: {
            id: true,
            plant: {
              select: {
                name: true,
              },
            },
            rentalStatus: true,
            rentStartDate: true,
            rentEndDate: true,
            actualReturnDate: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Build status history
    const statusHistory = [
      {
        status: "PENDING",
        timestamp: order.createdAt,
        description: "Order placed",
      },
    ];

    if (order.status !== "PENDING") {
      statusHistory.push({
        status: "CONFIRMED",
        timestamp: order.createdAt, // Would be actual confirmation time
        description: "Order confirmed by vendor",
      });
    }

    if (["PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
      statusHistory.push({
        status: "PROCESSING",
        timestamp: order.createdAt, // Would be actual processing time
        description: "Order being prepared",
      });
    }

    if (["OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
      statusHistory.push({
        status: "OUT_FOR_DELIVERY",
        timestamp: order.createdAt, // Would be actual delivery start time
        description: "Out for delivery",
      });
    }

    if (order.status === "DELIVERED" && order.deliveredAt) {
      statusHistory.push({
        status: "DELIVERED",
        timestamp: order.deliveredAt,
        description: "Order delivered",
      });
    }

    return {
      order_id: order.id,
      order_number: order.orderNumber,
      current_status: order.status,
      status_history: statusHistory,
      items: order.items,
    };
  }

  // POST /api/v1/orders/{order_id}/cancel
  async cancelOrder(userId: string, orderId: string, cancelDto: any) {
    const { reason } = cancelDto;

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        items: {
          include: {
            plant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const canCancelPending = order.status === OrderStatus.PENDING;
    const canCancelApprovedUnpaid =
      order.status === OrderStatus.CONFIRMED && order.paymentStatus === PaymentStatus.PENDING;
    if (!canCancelPending && !canCancelApprovedUnpaid) {
      throw new BadRequestException(
        "Order can only be cancelled while PENDING or CONFIRMED without payment (before delivery slots or payment). Cannot cancel after slots are proposed or payment has started."
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (this.inventoryReservedAtApproval(order)) {
        for (const item of order.items) {
          await tx.plant.update({
            where: { id: item.plantId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledBy: userId,
          cancellationReason: reason,
          cancelledAt: new Date(),
          paymentStatus:
            order.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : PaymentStatus.PENDING,
        },
      });
    });

    // Initiate refund if paid (should not happen for allowed cancel paths; kept for symmetry)
    if (order.paymentStatus === PaymentStatus.PAID) {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          userId,
          amount: order.totalAmount,
          paymentType: "REFUND",
          paymentMethod: order.paymentMethod || "REFUND",
          status: "PENDING",
        },
      });
    }

    return updated;
  }

  // POST /api/v1/orders/{order_id}/items/{item_id}/extend-rental
  async extendRental(userId: string, orderId: string, itemId: string, extendDto: any) {
    const { new_end_date } = extendDto ?? {};
    if (!new_end_date) {
      throw new BadRequestException("new_end_date is required");
    }

    const oid = await resolveOrderId(this.prisma, orderId);
    if (!oid) throw new NotFoundException("Order not found");

    const order = await this.prisma.order.findFirst({
      where: {
        id: oid,
        userId,
      },
      include: {
        items: {
          include: {
            plant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    this.assertCustomerOrderAllowsRentalMutation(order, "Rental extension");

    const extendOrderStatuses = new Set<OrderStatus>([
      OrderStatus.DELIVERED,
      OrderStatus.COMPLETED,
    ]);
    if (!extendOrderStatuses.has(order.status)) {
      throw new BadRequestException(
        `Rental extension is only allowed when order status is DELIVERED or COMPLETED (current: ${order.status})`
      );
    }

    const orderItem = order.items.find((i) => i.id === itemId);

    if (!orderItem) {
      throw new NotFoundException("Order item not found");
    }

    if (orderItem.orderType !== OrderType.RENT) {
      throw new BadRequestException("Item is not a rental");
    }

    const rentState = orderItem.rentalStatus;
    const extendableStatuses: RentalStatus[] = [
      RentalStatus.ACTIVE,
      RentalStatus.EXTENDED,
      RentalStatus.OVERDUE,
    ];
    if (!rentState || !extendableStatuses.includes(rentState)) {
      throw new BadRequestException(
        `Rental must be ACTIVE, EXTENDED, or OVERDUE to extend (current: ${rentState ?? "unset"})`
      );
    }

    const newEndDate = new Date(new_end_date);
    if (Number.isNaN(newEndDate.getTime())) {
      throw new BadRequestException("Invalid new_end_date");
    }
    const originalEndDate = orderItem.rentEndDate;

    if (!originalEndDate) {
      throw new BadRequestException("Original end date not found");
    }

    if (newEndDate <= originalEndDate) {
      throw new BadRequestException("New end date must be after original end date");
    }

    // Check availability for extension period
    const days = Math.ceil((newEndDate.getTime() - originalEndDate.getTime()) / (1000 * 60 * 60 * 24));
    const months = days / 30;
    const extensionPrice = (orderItem.plant.rentPriceMonthly || new Decimal(0)).times(months);

    // Create extension record
    const extension = await this.prisma.rentalExtension.create({
      data: {
        orderItemId: itemId,
        originalEndDate,
        newEndDate,
        extensionPrice,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    // Update order item
    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        rentEndDate: newEndDate,
        rentalStatus: RentalStatus.EXTENDED,
        extensionCount: {
          increment: 1,
        },
      },
    });

    // Create payment record
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        userId,
        amount: extensionPrice,
        paymentType: PaymentType.RENTAL_EXTENSION,
        paymentMethod: order.paymentMethod || "ONLINE",
        status: TransactionStatus.PENDING,
      },
    });

    return {
      extension,
      payment_required: true,
      amount: Number(extensionPrice),
    };
  }

  // POST /api/v1/orders/{order_id}/items/{item_id}/return
  async initiateReturn(userId: string, orderId: string, itemId: string, returnDto: any) {
    const { return_date, pickup_time_slot } = returnDto ?? {};

    const oid = await resolveOrderId(this.prisma, orderId);
    if (!oid) throw new NotFoundException("Order not found");

    const order = await this.prisma.order.findFirst({
      where: {
        id: oid,
        userId,
      },
      include: {
        items: {
          include: {
            plant: true,
          },
        },
        nursery: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    this.assertCustomerOrderAllowsRentalMutation(order, "Return initiation");

    if (
      order.status !== OrderStatus.DELIVERED &&
      order.status !== OrderStatus.COMPLETED &&
      order.status !== OrderStatus.OUT_FOR_DELIVERY
    ) {
      throw new BadRequestException(
        "Returns can only be initiated when the order is OUT_FOR_DELIVERY, DELIVERED, or COMPLETED"
      );
    }

    const orderItem = order.items.find((i) => i.id === itemId);

    if (!orderItem) {
      throw new NotFoundException("Order item not found");
    }

    if (orderItem.orderType !== OrderType.RENT) {
      throw new BadRequestException("Item is not a rental");
    }

    if (orderItem.rentalStatus === RentalStatus.RETURNED) {
      throw new BadRequestException("Rental item is already returned");
    }

    const returnEligible: RentalStatus[] = [
      RentalStatus.ACTIVE,
      RentalStatus.EXTENDED,
      RentalStatus.OVERDUE,
    ];
    const rs = orderItem.rentalStatus;
    if (!rs || !returnEligible.includes(rs)) {
      throw new BadRequestException(
        `Return requires rental status ACTIVE, EXTENDED, or OVERDUE (current: ${rs ?? "unset"})`
      );
    }

    let returnDate: Date;
    if (return_date != null && String(return_date).trim() !== "") {
      returnDate = new Date(String(return_date));
      if (Number.isNaN(returnDate.getTime())) {
        throw new BadRequestException("return_date must be a valid date");
      }
    } else {
      returnDate = new Date();
    }
    void pickup_time_slot;

    // Update order item
    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        rentalStatus: RentalStatus.RETURNED,
        actualReturnDate: returnDate,
      },
    });

    // Create maintenance task for pickup (requires gardener assignment)
    // For now, we'll just mark the return - gardener assignment happens separately
    // The task will be created when gardener is assigned

    // Release stock
    await this.prisma.plant.update({
      where: { id: orderItem.plantId },
      data: {
        stockQuantity: {
          increment: orderItem.quantity,
        },
      },
    });

    return {
      message: "Return initiated successfully",
      return_date: returnDate,
      pickup_scheduled: true,
    };
  }

  // ========== VENDOR ORDER MANAGEMENT ==========

  // GET /api/v1/vendor/orders
  async getVendorOrders(vendorId: string, filterDto: any) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const { status, order_type, date_from, date_to } = filterDto;
    const { pageNum, limitNum, skip } = this.normalizePaging(filterDto, 20);

    const where: Prisma.OrderWhereInput = {
      nurseryId: nursery.id,
      ...(status && { status }),
      ...(order_type && { orderType: order_type }),
      ...(date_from && { createdAt: { gte: new Date(date_from) } }),
      ...(date_to && { createdAt: { lte: new Date(date_to) } }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          items: {
            include: {
              plant: true,
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
          deliveryAddress: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 0,
      },
    };
  }

  // GET /api/v1/vendor/orders/{order_id}
  async getVendorOrder(vendorId: string, orderId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        nurseryId: nursery.id,
      },
      include: {
        items: {
          include: {
            plant: true,
            rentalExtensions: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            companyName: true,
          },
        },
        deliveryAddress: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  // PUT /api/v1/vendor/orders/{order_id}/status
  async updateOrderStatus(vendorId: string, orderId: string, statusDto: any) {
    const { status: rawStatus, notes } = statusDto ?? {};

    if (rawStatus == null || String(rawStatus).trim() === "") {
      throw new BadRequestException("status is required");
    }
    const statusStr = String(rawStatus).trim();
    if (!(Object.values(OrderStatus) as string[]).includes(statusStr)) {
      throw new BadRequestException(`Invalid order status: ${statusStr}`);
    }
    const status = statusStr as OrderStatus;

    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const oid = await resolveOrderId(this.prisma, orderId);
    if (!oid) throw new NotFoundException("Order not found");

    const order = await this.prisma.order.findFirst({
      where: {
        id: oid,
        nurseryId: nursery.id,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      SLOT_PROPOSED: [OrderStatus.CANCELLED],
      SLOT_CONFIRMED: [OrderStatus.CANCELLED],
      AWAITING_PAYMENT: [OrderStatus.CANCELLED],
      PROCESSING: [OrderStatus.OUT_FOR_DELIVERY],
      OUT_FOR_DELIVERY: [OrderStatus.DELIVERED],
      DELIVERED: [OrderStatus.COMPLETED],
      COMPLETED: [],
      CANCELLED: [],
      EXPIRED: [],
      RETURNED: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new BadRequestException(`Invalid status transition from ${order.status} to ${status}`);
    }

    if (
      status === OrderStatus.PROCESSING &&
      order.paymentStatus !== PaymentStatus.PAID
    ) {
      throw new BadRequestException(
        `Cannot set status to PROCESSING: order payment_status must be PAID (current: ${order.paymentStatus})`
      );
    }

    const updateData: Prisma.OrderUpdateInput = {
      status,
      ...(notes && { notes: `${order.notes || ""}\n${notes}`.trim() }),
      ...(status === OrderStatus.DELIVERED && { deliveredAt: new Date() }),
    };

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    // TODO: Send notification to customer

    return updated;
  }

  // POST /api/v1/vendor/orders/{order_id}/reject
  async rejectOrder(vendorId: string, orderId: string, rejectDto: Record<string, unknown>) {
    const reason = this.parseVendorRejectReason(rejectDto);

    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const oid = await resolveOrderId(this.prisma, orderId);
    if (!oid) throw new NotFoundException("Order not found");

    const rejectableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.SLOT_PROPOSED,
      OrderStatus.SLOT_CONFIRMED,
      OrderStatus.AWAITING_PAYMENT,
    ];

    const order = await this.prisma.order.findFirst({
      where: {
        id: oid,
        nurseryId: nursery.id,
        status: { in: rejectableStatuses },
      },
      include: {
        items: {
          include: {
            plant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        "Order not found or cannot be rejected at this status (only pre-fulfillment states)"
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (this.inventoryReservedAtApproval(order)) {
        for (const item of order.items) {
          await tx.plant.update({
            where: { id: item.plantId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledBy: vendorId,
          cancellationReason: reason,
          cancelledAt: new Date(),
          paymentStatus:
            order.paymentStatus === PaymentStatus.PAID ? PaymentStatus.REFUNDED : PaymentStatus.PENDING,
        },
      });
    });

    // Initiate refund if paid
    if (order.paymentStatus === PaymentStatus.PAID) {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount: order.totalAmount,
          paymentType: PaymentType.REFUND,
          paymentMethod: order.paymentMethod || "REFUND",
          status: TransactionStatus.PENDING,
        },
      });
    }

    // TODO: Notify customer

    return updated;
  }

  // POST /api/v1/vendor/orders/{order_id}/assign-gardener
  async assignGardener(vendorId: string, orderId: string, assignDto: Record<string, unknown>) {
    const gardenerId = String(assignDto.gardener_id ?? "").trim();
    const orderItemId = String(assignDto.order_item_id ?? "").trim();
    if (!gardenerId || !orderItemId) {
      throw new BadRequestException("gardener_id and order_item_id are required");
    }

    const maintenanceSchedule = this.parseAssignMaintenanceSchedule(assignDto.maintenance_schedule);
    this.assertDeliverySlotsArrayShape(assignDto.delivery_slots);

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
        deactivatedAt: null,
      },
    });
    if (!gardener) {
      throw new BadRequestException(
        "Gardener not found, not attached to this nursery, or deactivated"
      );
    }

    const oid = await resolveOrderId(this.prisma, orderId);
    if (!oid) throw new NotFoundException("Order not found");

    const order = await this.prisma.order.findFirst({
      where: {
        id: oid,
        nurseryId: nursery.id,
      },
      include: {
        items: {
          where: { id: orderItemId },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    this.assertOrderPaid(order, "assign-gardener");

    const assignableStatuses = new Set<OrderStatus>([
      OrderStatus.CONFIRMED,
      OrderStatus.SLOT_CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
    ]);
    if (!assignableStatuses.has(order.status)) {
      throw new BadRequestException(
        `Cannot assign gardener in order status ${order.status}; expected one of CONFIRMED, SLOT_CONFIRMED, PROCESSING, OUT_FOR_DELIVERY, DELIVERED`
      );
    }

    const orderItem = order.items[0];
    if (!orderItem) {
      throw new NotFoundException("Order item not found on this order");
    }

    if (orderItem.orderType !== OrderType.RENT) {
      throw new BadRequestException("Can only assign gardener to rental items");
    }

    const scheduleMap: Record<(typeof ASSIGN_MAINTENANCE_SCHEDULES)[number], number> = {
      WEEKLY: 7,
      BIWEEKLY: 14,
      MONTHLY: 30,
    };

    const daysInterval = scheduleMap[maintenanceSchedule];
    const startDate = orderItem.rentStartDate ? new Date(orderItem.rentStartDate) : new Date();
    const endDate = orderItem.rentEndDate ? new Date(orderItem.rentEndDate) : new Date();

    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        "Rental rent_end_date must be on or after rent_start_date on the order line to schedule maintenance"
      );
    }

    const orderWithUser = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        user: true,
        deliveryAddress: true,
      },
    });

    if (!orderWithUser) {
      throw new NotFoundException("Order not found");
    }

    const tasks: Prisma.MaintenanceTaskCreateManyInput[] = [];
    let currentDate = new Date(startDate);
    let taskCounter = 1;

    while (currentDate <= endDate) {
      const taskNumber = `TASK-${Date.now()}-${taskCounter++}`;
      tasks.push({
        taskNumber,
        orderItemId: orderItem.id,
        gardenerId,
        nurseryId: nursery.id,
        userId: orderWithUser.userId,
        addressId: orderWithUser.deliveryAddressId,
        taskType: TaskType.SCHEDULED_MAINTENANCE,
        description: `Recurring maintenance (${maintenanceSchedule}) for plant ${orderItem.plantId}`,
        scheduledDate: new Date(currentDate),
        scheduledTime: null,
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
      });

      currentDate.setDate(currentDate.getDate() + daysInterval);
    }

    if (tasks.length === 0) {
      throw new BadRequestException(
        "No maintenance visits fit in the rental window; extend rental dates before assigning"
      );
    }

    await this.prisma.maintenanceTask.createMany({
      data: tasks,
    });

    if (Array.isArray(assignDto.delivery_slots) && assignDto.delivery_slots.length) {
      const o = await this.prisma.order.findUnique({
        where: { id: order.id },
        select: { workflowMeta: true },
      });
      const meta = (o?.workflowMeta as Record<string, unknown>) ?? {};
      meta.assignGardener = {
        delivery_slots: assignDto.delivery_slots,
        gardener_id: gardenerId,
        order_item_id: orderItemId,
      };
      await this.prisma.order.update({
        where: { id: order.id },
        data: { workflowMeta: meta as object },
      });
    }

    return {
      message: "Gardener assigned and maintenance schedule created",
      tasks_created: tasks.length,
      maintenance_schedule: maintenanceSchedule,
    };
  }

  // GET /api/v1/vendor/orders/stats
  async getVendorOrderStats(vendorId: string, period: string = "month") {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [orders, revenue, popularItems] = await Promise.all([
      this.prisma.order.groupBy({
        by: ["status"],
        where: {
          nurseryId: nursery.id,
          createdAt: { gte: startDate },
        },
        _count: {
          status: true,
        },
      }),
      this.prisma.order.aggregate({
        where: {
          nurseryId: nursery.id,
          createdAt: { gte: startDate },
          paymentStatus: PaymentStatus.PAID,
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      }),
      this.prisma.orderItem.groupBy({
        by: ["plantId"],
        where: {
          order: {
            nurseryId: nursery.id,
            createdAt: { gte: startDate },
          },
        },
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 10,
      }),
    ]);

    return {
      period,
      orders_by_status: orders,
      total_revenue: Number(revenue._sum.totalAmount || 0),
      total_orders: revenue._count.id,
      popular_items: popularItems,
    };
  }

  /**
   * Legacy: GET /api/v1/orders/vendor/rentals/active
   * Prefer {@link getVendorRentalsByBucket}: GET /api/v1/vendor/rentals?bucket=ON…
   */
  async getActiveRentals(vendorId: string, filterDto: unknown) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });

    if (!nursery) {
      throw new NotFoundException("Nursery not found");
    }

    const f = filterDto as { status?: string; page?: string; limit?: string };
    const { status } = f;
    const { pageNum, limitNum, skip } = this.normalizePaging(f, 20);
    const bounds = this.rentalCalendarBounds();

    let where: Prisma.OrderItemWhereInput;
    if (status === "OVERDUE") {
      where = this.vendorRentalWhereClause(nursery.id, "OVERDUE", bounds);
    } else if (status === "DUE_TODAY") {
      where = this.vendorRentalWhereClause(nursery.id, "DUE_TODAY", bounds);
    } else {
      where = {
        order: { nurseryId: nursery.id },
        orderType: OrderType.RENT,
        rentalStatus: {
          in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED, RentalStatus.OVERDUE],
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.orderItem.findMany({
        where,
        skip,
        take: limitNum,
        include: this.vendorRentalsDefaultInclude(),
        orderBy: { rentEndDate: "asc" },
      }),
      this.prisma.orderItem.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 0,
      },
    };
  }

  /** GET /api/v1/orders/customer/active-rentals */
  async getCustomerActiveRentals(userId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { userId },
        orderType: OrderType.RENT,
        rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
      },
      include: {
        plant: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            nursery: { select: { id: true, name: true, slug: true } },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            deliveredAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { rentEndDate: "asc" },
    });
    return { items };
  }

  private async requireVendorOrder(vendorId: string, orderIdOrNumber: string) {
    const orderIdResolved = await resolveOrderId(this.prisma, orderIdOrNumber);
    if (!orderIdResolved) throw new NotFoundException("Order not found");
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId },
    });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const order = await this.prisma.order.findFirst({
      where: { id: orderIdResolved, nurseryId: nursery.id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return { nursery, order, orderIdResolved };
  }

  /** GET /api/v1/orders/vendor/orders/:order_id/payment-status */
  async getVendorOrderPaymentStatus(vendorId: string, orderId: string) {
    const { order } = await this.requireVendorOrder(vendorId, orderId);
    const payments = await this.prisma.payment.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
    });
    const hasSuccessfulCapture = payments.some((p) => p.status === TransactionStatus.SUCCESS);
    return {
      order_id: order.id,
      order_number: order.orderNumber,
      order_payment_status: order.paymentStatus,
      payments,
      has_successful_capture: hasSuccessfulCapture,
      can_send_to_process:
        order.status === OrderStatus.CONFIRMED && order.paymentStatus === PaymentStatus.PAID,
    };
  }

  /** PUT /api/v1/orders/vendor/orders/:order_id/approve */
  async vendorApproveOrder(
    vendorId: string,
    orderId: string,
    body: { plant_selections: { order_item_id: string; plant_id: string }[] }
  ) {
    const { order } = await this.requireVendorOrder(vendorId, orderId);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException("Only pending orders can be approved");
    }
    const selections = body.plant_selections;
    if (!Array.isArray(selections) || selections.length === 0) {
      throw new BadRequestException("plant_selections[] is required");
    }
    const items = order.items;
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const sel of selections) {
      const line = byId.get(sel.order_item_id);
      if (!line) {
        throw new BadRequestException(`Invalid order_item_id: ${sel.order_item_id}`);
      }
      if (line.plantId !== sel.plant_id) {
        throw new BadRequestException(
          `plant_id must match catalog plant for line ${sel.order_item_id}`
        );
      }
    }
    if (selections.length !== items.length) {
      throw new BadRequestException("plant_selections must include every order line");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const line of items) {
        const plant = await tx.plant.findUnique({
          where: { id: line.plantId },
          select: { stockQuantity: true },
        });
        if (!plant) {
          throw new BadRequestException(`Plant not found for order line ${line.id}`);
        }
        if (plant.stockQuantity < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for plant ${line.plantId} (need ${line.quantity}, have ${plant.stockQuantity})`
          );
        }
      }
      for (const line of items) {
        await tx.plant.update({
          where: { id: line.plantId },
          data: { stockQuantity: { decrement: line.quantity } },
        });
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CONFIRMED,
          vendorApprovalSelections: selections as unknown as Prisma.InputJsonValue,
        },
        include: {
          items: { include: { plant: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      });
    });

    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        title: "Order approved",
        message: `Your order ${order.orderNumber} was approved by the nursery.`,
        type: NotificationType.ORDER,
        referenceType: "ORDER",
        referenceId: order.id,
      },
    });

    return updated;
  }

  /** POST /api/v1/orders/vendor/orders/:order_id/process */
  async vendorProcessOrder(vendorId: string, orderId: string) {
    const { order } = await this.requireVendorOrder(vendorId, orderId);
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException("Order must be confirmed before processing");
    }
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        `Cannot process order: payment_status must be PAID (current: ${order.paymentStatus})`
      );
    }
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PROCESSING },
      include: { items: true, user: { select: { id: true, fullName: true } } },
    });
    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        title: "Order is being prepared",
        message: `Your order ${order.orderNumber} is now being processed for delivery.`,
        type: NotificationType.ORDER,
        referenceType: "ORDER",
        referenceId: order.id,
      },
    });
    return updated;
  }

  /** POST /api/v1/orders/vendor/orders/:order_id/complete-delivery */
  async vendorCompleteDelivery(vendorId: string, orderId: string, body?: Record<string, unknown>) {
    const { order } = await this.requireVendorOrder(vendorId, orderId);
    if (
      order.status !== OrderStatus.PROCESSING &&
      order.status !== OrderStatus.OUT_FOR_DELIVERY
    ) {
      throw new BadRequestException(
        "Order must be in PROCESSING or OUT_FOR_DELIVERY to complete delivery"
      );
    }
    const raw = body ?? {};
    const lineRows = Array.isArray(raw.line_items)
      ? (raw.line_items as Record<string, unknown>[])
      : null;
    const rentLines = order.items.filter((i) => i.orderType === OrderType.RENT);

    if (lineRows != null) {
      if (lineRows.length !== rentLines.length) {
        throw new BadRequestException(
          `line_items must include exactly ${rentLines.length} rental line(s) for this order`
        );
      }
      const expected = new Set(rentLines.map((r) => r.id));
      const seen = new Set<string>();
      for (const row of lineRows) {
        const lid = String(row.order_item_id ?? "");
        if (!expected.has(lid) || seen.has(lid)) {
          throw new BadRequestException(
            "line_items.order_item_id values must match rental lines one-to-one"
          );
        }
        seen.add(lid);
      }
    }

    const { line_items: _drop, ...orderLevelMeta } = raw;
    const hasOrderLevelMeta = Object.keys(orderLevelMeta).length > 0;

    const now = new Date();
    const prevMeta =
      order.workflowMeta && typeof order.workflowMeta === "object"
        ? (order.workflowMeta as Record<string, unknown>)
        : {};

    const deliveryCompletionMeta =
      hasOrderLevelMeta || lineRows != null
        ? {
            ...orderLevelMeta,
            ...(lineRows != null ? { proof_per_line_sealed_at: now.toISOString() } : {}),
          }
        : null;

    const lineById =
      lineRows != null ? new Map(lineRows.map((row) => [String(row.order_item_id ?? ""), row])) : null;

    await this.prisma.$transaction(async (tx) => {
      if (deliveryCompletionMeta != null) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            workflowMeta: {
              ...prevMeta,
              deliveryCompletion: deliveryCompletionMeta,
            } as object,
          },
        });
      }
      for (const item of order.items) {
        if (item.orderType !== OrderType.RENT) continue;
        let days = 30;
        if (item.rentStartDate && item.rentEndDate) {
          const ms = item.rentEndDate.getTime() - item.rentStartDate.getTime();
          days = Math.max(1, Math.ceil(ms / 86400000));
        }
        const start = new Date(now);
        const end = new Date(now);
        end.setUTCDate(end.getUTCDate() + days);

        const extras = lineById?.get(item.id);
        let deliveryPatch: Prisma.OrderItemUpdateInput = {};
        if (extras) {
          const cond = tryFulfillmentLineCondition(extras.condition);
          if (!cond) {
            throw new BadRequestException(
              `Invalid delivery condition for line ${item.id}; allowed: ${FULFILLMENT_LINE_CONDITIONS.join(", ")}`
            );
          }
          const proofAt =
            this.parseOptionalIsoInstant(extras.proof_at, "line_items[].proof_at") ?? now;
          deliveryPatch = {
            deliveryProofAt: proofAt,
            deliveryCondition: cond,
            deliveryProofUrls: this.coerceProofUrlsJson(extras.proof_image_urls),
            deliveryLineNotes: extras.notes != null ? String(extras.notes) : null,
          };
        }

        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            rentalStatus: RentalStatus.ACTIVE,
            rentStartDate: start,
            rentEndDate: end,
            ...deliveryPatch,
          },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: now,
        },
      });
    });

    const full = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: { include: { plant: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        title: "Delivery completed",
        message: `Your order ${order.orderNumber} has been delivered. Your rental period is now active.`,
        type: NotificationType.RENTAL,
        referenceType: "ORDER",
        referenceId: order.id,
      },
    });

    return full;
  }

  /** GET /api/v1/orders/vendor/orders/:order_id/fulfillment-audit */
  async getVendorFulfillmentAudit(vendorId: string, orderId: string) {
    const { order } = await this.requireVendorOrder(vendorId, orderId);
    const meta =
      order.workflowMeta && typeof order.workflowMeta === "object"
        ? (order.workflowMeta as Record<string, unknown>)
        : {};
    return {
      order_id: order.id,
      order_number: order.orderNumber,
      order_status: order.status,
      delivered_at: order.deliveredAt?.toISOString() ?? null,
      workflow_meta_snapshot: {
        delivery: meta.delivery ?? null,
        delivery_completion: meta.deliveryCompletion ?? null,
        return: meta.return ?? null,
      },
      items: order.items.map((oi) => this.mapFulfillmentLine(oi)),
    };
  }

  /** GET …/line-items/:order_item_id/fulfillment */
  async getVendorLineFulfillment(vendorId: string, orderId: string, orderItemId: string) {
    const { order } = await this.requireVendorOrder(vendorId, orderId);
    const oi = order.items.find((i) => i.id === orderItemId);
    if (!oi) {
      throw new NotFoundException("Order item not found on this order");
    }
    return {
      order_id: order.id,
      order_number: order.orderNumber,
      item: this.mapFulfillmentLine(oi),
    };
  }

  /** GET /api/v1/orders/:order_id/fulfillment-summary (customer — proof URLs redacted) */
  async getCustomerFulfillmentSummary(userId: string, orderIdOrNum: string) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw new NotFoundException("Order not found");
    const order = await this.prisma.order.findFirst({
      where: { id: oid, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    const meta =
      order.workflowMeta && typeof order.workflowMeta === "object"
        ? (order.workflowMeta as Record<string, unknown>)
        : {};
    return {
      audience: "customer",
      proof_media_policy:
        "Image URLs are not exposed; counts and timestamps reflect vendor-recorded proof-of-delivery and returns.",
      order_id: order.id,
      order_number: order.orderNumber,
      order_status: order.status,
      delivered_at: order.deliveredAt?.toISOString() ?? null,
      workflow_meta_snapshot: {
        delivery: this.redactWorkflowMetaForCustomer(meta.delivery),
        delivery_completion: this.redactWorkflowMetaForCustomer(meta.deliveryCompletion),
        return: this.redactWorkflowMetaForCustomer(meta.return),
      },
      items: order.items.map((oi) => this.mapFulfillmentLineCustomer(oi)),
    };
  }

  /** GET …/line-items/:order_item_id/fulfillment-summary (customer) */
  async getCustomerLineFulfillmentSummary(
    userId: string,
    orderIdOrNum: string,
    orderItemId: string
  ) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw new NotFoundException("Order not found");
    const order = await this.prisma.order.findFirst({
      where: { id: oid, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    const oi = order.items.find((i) => i.id === orderItemId);
    if (!oi) throw new NotFoundException("Order item not found on this order");
    return {
      audience: "customer",
      order_id: order.id,
      order_number: order.orderNumber,
      item: this.mapFulfillmentLineCustomer(oi),
    };
  }
}
