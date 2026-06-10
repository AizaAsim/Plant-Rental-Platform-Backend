import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  Prisma,
  PaymentType,
  TransactionStatus,
  OrderStatus,
  PaymentStatus,
  BookingStatus,
  FreelanceJobStatus,
  PayoutStatus,
  RecipientType,
  EarningStatus,
  EarningType,
  NotificationType,
} from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { IdempotencyService } from "src/common/contract/idempotency.service";
import { PenaltyService } from "../orders/penalty.service";
import { DomainNotificationsService } from "../notifications/domain-notifications.service";
import { OrderPenaltyPayStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";

/** Mock gateway: all operations succeed. */
const MOCK_GATEWAY = "MOCK";
const MIN_PAYOUT_AMOUNT = new Decimal(100);

type PaymentFor =
  | "ORDER"
  | "BOOKING"
  | "RENTAL_EXTENSION"
  | "FREELANCE_JOB"
  | "PENALTY";

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly penaltyService: PenaltyService,
    private readonly domainNotifications: DomainNotificationsService
  ) {}

  private mapPaymentForToType(paymentFor: PaymentFor): PaymentType {
    if (paymentFor === "ORDER") return PaymentType.ORDER;
    if (paymentFor === "BOOKING") return PaymentType.SERVICE_BOOKING;
    if (paymentFor === "FREELANCE_JOB") return PaymentType.FREELANCE_JOB;
    if (paymentFor === "PENALTY") return PaymentType.PENALTY;
    return PaymentType.RENTAL_EXTENSION;
  }

  private generateGatewayOrderId() {
    return `mock_go_${randomUUID()}`;
  }

  private generatePayoutNumber() {
    return `PO-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  /** Mock: IFSC is always considered valid. */
  private assertIfscMock(_ifsc: string) {
    return true;
  }

  private orderWorkflowMeta(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
    return {};
  }

  /** Slot-confirm path sets `paymentWindowExpiresAt`; initiate may extend only if missing or expired. */
  private assertOpenPaymentWindow(order: { workflowMeta: unknown }): void {
    const wm = this.orderWorkflowMeta(order.workflowMeta);
    const expRaw = wm.paymentWindowExpiresAt;
    if (typeof expRaw !== "string") {
      throw new BadRequestException(
        "Payment is not available yet: confirm a delivery slot first (missing payment_window_expires_at)"
      );
    }
    const exp = new Date(expRaw);
    if (Number.isNaN(exp.getTime()) || exp.getTime() <= Date.now()) {
      throw new BadRequestException(
        "Payment window has expired; ask the vendor to propose new delivery slots"
      );
    }
  }

  private resolvePaymentWindowIso(wm: Record<string, unknown>): string {
    const hours = Number(process.env.ORDER_PAYMENT_WINDOW_TTL_HOURS ?? 6);
    const existingExp = wm.paymentWindowExpiresAt;
    if (typeof existingExp === "string") {
      const d = new Date(existingExp);
      if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) {
        return existingExp;
      }
    }
    return new Date(Date.now() + hours * 3600000).toISOString();
  }

  async initiate(
    userId: string,
    body: {
      payment_for: PaymentFor;
      reference_id: string;
      payment_method: string;
      return_url?: string;
    },
    idempotencyKey?: string
  ) {
    const { payment_for, reference_id, payment_method, return_url } = body;
    if (!payment_for || !reference_id || !payment_method) {
      throw new BadRequestException("payment_for, reference_id and payment_method are required");
    }

    const route = "POST /api/v1/payments/initiate";
    if (idempotencyKey) {
      const replay = await this.idempotency.getReplay(idempotencyKey, route, userId, body);
      if (replay) {
        if (replay.statusCode >= 400) {
          throw new HttpException(replay.body, replay.statusCode);
        }
        return replay.body;
      }
    }

    const paymentType = this.mapPaymentForToType(payment_for);
    let amount = new Decimal(0);
    let orderId: string | null = null;
    let bookingId: string | null = null;
    let freelanceJobId: string | null = null;
    let metadata: Prisma.InputJsonValue | undefined;

    if (payment_for === "ORDER") {
      const order = await this.prisma.order.findFirst({
        where: { id: reference_id, userId },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          paymentStatus: true,
          workflowMeta: true,
        },
      });
      if (!order) throw new NotFoundException("Order not found");
      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException("This order is already paid");
      }
    const payEligible = new Set<OrderStatus>([
      OrderStatus.CONFIRMED,
      OrderStatus.SLOT_CONFIRMED,
      OrderStatus.AWAITING_PAYMENT,
    ]);
    if (!payEligible.has(order.status)) {
      throw new BadRequestException(
        `Order payment requires vendor approval (status must be CONFIRMED, SLOT_CONFIRMED, or AWAITING_PAYMENT; current: ${order.status})`
      );
    }
      this.assertOpenPaymentWindow(order);
      amount = order.totalAmount;
      orderId = order.id;
    } else if (payment_for === "BOOKING") {
      const booking = await this.prisma.serviceBooking.findFirst({
        where: { id: reference_id, userId },
      });
      if (!booking) throw new NotFoundException("Booking not found");
      amount = booking.totalAmount;
      bookingId = booking.id;
    } else if (payment_for === "FREELANCE_JOB") {
      const job = await this.prisma.freelanceJob.findFirst({
        where: { OR: [{ id: reference_id }, { publicId: reference_id }], userId },
      });
      if (!job) {
        throw new NotFoundException("Freelance job not found");
      }
      if (job.status !== FreelanceJobStatus.ACCEPTED) {
        throw new BadRequestException("Job must be in ACCEPTED status before payment");
      }
      if (job.budgetAmount == null) {
        throw new BadRequestException("Job has no budget_amount; payments require an agreed budget on the posting");
      }
      if (job.paidAt) {
        throw new BadRequestException("This job has already been paid");
      }
      const pendingPay = await this.prisma.payment.findFirst({
        where: { freelanceJobId: job.id, status: TransactionStatus.PENDING },
      });
      if (pendingPay) {
        throw new ConflictException("A payment is already pending for this job");
      }
      amount = job.budgetAmount;
      freelanceJobId = job.id;
    } else if (payment_for === "PENALTY") {
      const order = await this.prisma.order.findFirst({
        where: { id: reference_id, userId },
        select: { id: true, orderNumber: true },
      });
      if (!order) throw new NotFoundException("Order not found");
      await this.penaltyService.syncPenaltyForOrder(order.id, false);
      const penalty = await this.prisma.orderPenalty.findUnique({
        where: { orderId: order.id },
      });
      if (!penalty || penalty.payStatus === OrderPenaltyPayStatus.PAID) {
        throw new BadRequestException("No pending penalty for this order");
      }
      if (penalty.runningTotal.lte(0)) {
        throw new BadRequestException("Penalty amount is zero");
      }
      amount = penalty.runningTotal;
      orderId = order.id;
      metadata = {
        payment_for: "PENALTY",
        order_penalty_id: penalty.id,
      };
    } else {
      const ext = await this.prisma.rentalExtension.findFirst({
        where: { id: reference_id },
        include: { orderItem: { include: { order: true } } },
      });
      if (!ext || ext.orderItem.order.userId !== userId) {
        throw new NotFoundException("Rental extension not found");
      }
      if (ext.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException("This extension is already paid");
      }
      amount = ext.extensionPrice;
      orderId = ext.orderItem.orderId;
      metadata = {
        rental_extension_id: reference_id,
        parent_order_id: ext.orderItem.orderId,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (payment_for === "RENTAL_EXTENSION") {
        const dup = await tx.payment.findFirst({
          where: {
            userId,
            paymentType: PaymentType.RENTAL_EXTENSION,
            status: TransactionStatus.PENDING,
            metadata: { path: ["rental_extension_id"], equals: reference_id },
          },
          orderBy: { createdAt: "desc" },
        });
        if (dup) {
          let gid = dup.gatewayOrderId;
          if (!gid) {
            gid = this.generateGatewayOrderId();
            await tx.payment.update({
              where: { id: dup.id },
              data: { gatewayOrderId: gid },
            });
          }
          return { payment: dup, gatewayOrderId: gid, reused: true as const };
        }
      }

      if (payment_for === "PENALTY" && orderId) {
        const dup = await tx.payment.findFirst({
          where: {
            orderId,
            userId,
            paymentType: PaymentType.PENALTY,
            status: TransactionStatus.PENDING,
          },
          orderBy: { createdAt: "desc" },
        });
        if (dup) {
          let gid = dup.gatewayOrderId;
          if (!gid) {
            gid = this.generateGatewayOrderId();
            await tx.payment.update({
              where: { id: dup.id },
              data: { gatewayOrderId: gid },
            });
          }
          return { payment: dup, gatewayOrderId: gid, reused: true as const };
        }
      }

      if (payment_for === "ORDER" && orderId) {
        const dup = await tx.payment.findFirst({
          where: {
            orderId,
            paymentType: PaymentType.ORDER,
            status: TransactionStatus.PENDING,
          },
          orderBy: { createdAt: "desc" },
        });
        if (dup) {
          let gid = dup.gatewayOrderId;
          if (!gid) {
            gid = this.generateGatewayOrderId();
            await tx.payment.update({
              where: { id: dup.id },
              data: { gatewayOrderId: gid },
            });
          }
          const curDup = await tx.order.findUnique({
            where: { id: orderId },
            select: { status: true, workflowMeta: true },
          });
          if (curDup?.status === OrderStatus.SLOT_CONFIRMED || curDup?.status === OrderStatus.CONFIRMED) {
            const wm = this.orderWorkflowMeta(curDup.workflowMeta);
            const payExp = this.resolvePaymentWindowIso(wm);
            await tx.order.update({
              where: { id: orderId },
              data: {
                status: OrderStatus.AWAITING_PAYMENT,
                workflowMeta: {
                  ...wm,
                  paymentWindowExpiresAt: payExp,
                } as Prisma.InputJsonValue,
              },
            });
          }
          return {
            payment: dup,
            gatewayOrderId: gid,
            reused: true as const,
          };
        }
      }

      const gatewayOrderId = this.generateGatewayOrderId();
      const p = await tx.payment.create({
        data: {
          userId,
          orderId,
          bookingId,
          ...(freelanceJobId != null ? { freelanceJobId } : {}),
          amount,
          paymentType,
          paymentMethod: payment_method,
          paymentGateway: MOCK_GATEWAY,
          gatewayOrderId,
          status: TransactionStatus.PENDING,
          ...(metadata != null ? { metadata } : {}),
        },
      });

      if (payment_for === "ORDER" && orderId) {
        const cur = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true, workflowMeta: true },
        });
        if (cur?.status === OrderStatus.SLOT_CONFIRMED || cur?.status === OrderStatus.CONFIRMED) {
          const wm = this.orderWorkflowMeta(cur.workflowMeta);
          const payExp = this.resolvePaymentWindowIso(wm);
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: OrderStatus.AWAITING_PAYMENT,
              workflowMeta: {
                ...wm,
                paymentWindowExpiresAt: payExp,
              } as Prisma.InputJsonValue,
            },
          });
        }
      }

      return { payment: p, gatewayOrderId, reused: false as const };
    });

    const { payment, gatewayOrderId, reused } = result;

    const out = {
      success: true,
      mock: true,
      payment_id: payment.id,
      gateway_order_id: gatewayOrderId,
      gateway_payment_id: `mock_gp_${randomUUID()}`,
      amount: amount.toString(),
      redirect_url: return_url || `https://mock-gateway.example/pay/${gatewayOrderId}`,
      message: reused
        ? "Existing pending payment — continue with the same gateway_order_id"
        : "Mock payment initialized — any verify payload will succeed",
      reused,
    };
    if (idempotencyKey) {
      await this.idempotency.save(idempotencyKey, route, userId, body, 201, out);
    }
    return out;
  }

  async verify(
    userId: string,
    body: {
      gateway_order_id: string;
      gateway_payment_id: string;
      gateway_signature: string;
    },
    idempotencyKey?: string
  ) {
    const { gateway_order_id } = body;
    if (!gateway_order_id) {
      throw new BadRequestException("gateway_order_id is required");
    }

    const route = "POST /api/v1/payments/verify";
    if (idempotencyKey) {
      const replay = await this.idempotency.getReplay(idempotencyKey, route, userId, body);
      if (replay) {
        if (replay.statusCode === 409) {
          throw new HttpException(replay.body, 409);
        }
        return replay.body;
      }
    }

    const payment = await this.prisma.payment.findFirst({
      where: { gatewayOrderId: gateway_order_id, userId },
      include: {
        order: { include: { items: true, nursery: true } },
        booking: true,
        freelanceJob: true,
      },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found for this gateway order");
    }

    if (payment.status === TransactionStatus.SUCCESS) {
      const out = {
        success: true,
        verified: true,
        mock: true,
        payment_id: payment.id,
        status: TransactionStatus.SUCCESS,
        message: "Payment was already verified",
        idempotent: true,
      };
      if (idempotencyKey) {
        await this.idempotency.save(idempotencyKey, route, userId, body, 200, out);
      }
      return out;
    }

    const orderPayment = payment.order;
    if (payment.paymentType === PaymentType.ORDER && orderPayment) {
      if (orderPayment.paymentStatus !== PaymentStatus.PAID) {
        if (
          orderPayment.status !== OrderStatus.AWAITING_PAYMENT &&
          orderPayment.status !== OrderStatus.CONFIRMED
        ) {
          throw new BadRequestException(
            `Order payment can only be verified after payment is initiated (order status AWAITING_PAYMENT or CONFIRMED; current: ${orderPayment.status})`
          );
        }
        this.assertOpenPaymentWindow(orderPayment);
      }
    }

    // Mock: signature always valid
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: TransactionStatus.SUCCESS,
        gatewayTransactionId: body.gateway_payment_id || `mock_tx_${randomUUID()}`,
      },
    });

    if (payment.orderId && payment.order && payment.order.paymentStatus !== PaymentStatus.PAID) {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.CONFIRMED,
        },
      });

      const existingEarn = await this.prisma.vendorEarning.findFirst({
        where: { orderId: payment.orderId },
      });
      if (!existingEarn && payment.order.nurseryId) {
        const orderAmount = payment.order.totalAmount;
        const commissionRate = new Decimal(0.1);
        const commissionAmount = orderAmount.times(commissionRate);
        const netEarnings = orderAmount.minus(commissionAmount);
        await this.prisma.vendorEarning.create({
          data: {
            nurseryId: payment.order.nurseryId,
            orderId: payment.orderId,
            orderAmount,
            commissionRate,
            commissionAmount,
            netEarnings,
            status: EarningStatus.PENDING,
          },
        });
      }

      if (payment.order.nurseryId) {
        await this.domainNotifications.notifyVendorByNurseryId(
          payment.order.nurseryId,
          "Payment received",
          `Payment for order ${payment.order.orderNumber ?? payment.orderId} was successful.`,
          NotificationType.PAYMENT,
          "ORDER",
          payment.orderId
        );
      }
    }

    if (payment.freelanceJobId && payment.freelanceJob) {
      await this.prisma.freelanceJob.update({
        where: { id: payment.freelanceJobId },
        data: { paidAt: new Date() },
      });
      const fj = payment.freelanceJob;
      const gid = fj.acceptedGardenerId;
      if (gid) {
        const existingGe = await this.prisma.gardenerEarning.findFirst({
          where: { freelanceJobId: fj.id },
        });
        if (!existingGe) {
          const gross = payment.amount;
          const commissionRate = new Decimal(0.1);
          const commissionAmount = gross.times(commissionRate);
          const net = gross.minus(commissionAmount);
          await this.prisma.gardenerEarning.create({
            data: {
              gardenerId: gid,
              freelanceJobId: fj.id,
              earningType: EarningType.FREELANCE_MARKET_JOB,
              grossAmount: gross,
              commissionRate,
              commissionAmount,
              netEarnings: net,
              status: EarningStatus.PENDING,
            },
          });
        }
      }
    }

    if (payment.bookingId && payment.booking) {
      await this.prisma.serviceBooking.update({
        where: { id: payment.bookingId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: BookingStatus.CONFIRMED,
        },
      });

      const existingGe = await this.prisma.gardenerEarning.findFirst({
        where: { bookingId: payment.bookingId },
      });
      if (!existingGe) {
        const gross = payment.booking.totalAmount;
        const commissionRate = new Decimal(0.1);
        const commissionAmount = gross.times(commissionRate);
        const net = gross.minus(commissionAmount);
        await this.prisma.gardenerEarning.create({
          data: {
            gardenerId: payment.booking.gardenerId,
            bookingId: payment.bookingId,
            earningType: EarningType.FREELANCE_BOOKING,
            grossAmount: gross,
            commissionRate,
            commissionAmount,
            netEarnings: net,
            status: EarningStatus.PENDING,
          },
        });
      }
    }

    const meta = payment.metadata as {
      rental_extension_id?: string;
      payment_for?: string;
      order_penalty_id?: string;
      parent_order_id?: string;
    } | null;

    if (meta?.rental_extension_id) {
      await this.prisma.rentalExtension.update({
        where: { id: meta.rental_extension_id },
        data: { paymentStatus: PaymentStatus.PAID },
      });
      const parentOrderId = meta.parent_order_id ?? payment.orderId;
      if (parentOrderId) {
        const ord = await this.prisma.order.findUnique({
          where: { id: parentOrderId },
          select: { id: true, orderNumber: true, userId: true },
        });
        if (ord) {
          await this.domainNotifications.notifyExtensionPaymentPaid({
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            customerUserId: ord.userId,
            amount: Number(payment.amount),
          });
        }
      }
    }

    if (
      payment.paymentType === PaymentType.PENALTY &&
      payment.orderId
    ) {
      await this.penaltyService.applyPenaltyPaymentSuccess(
        payment.orderId,
        payment.amount
      );
    }

    const out: Record<string, unknown> = {
      success: true,
      verified: true,
      mock: true,
      payment_id: payment.id,
      status: TransactionStatus.SUCCESS,
      message: "Mock verify succeeded for all inputs",
    };
    if (payment.paymentType === PaymentType.ORDER && payment.orderId) {
      out.order = {
        status: OrderStatus.CONFIRMED,
        payment_status: PaymentStatus.PAID,
      };
    }
    if (idempotencyKey) {
      await this.idempotency.save(idempotencyKey, route, userId, body, 200, out);
    }
    return out;
  }

  async webhook(_payload: Record<string, unknown>) {
    return {
      success: true,
      received: true,
      mock: true,
      message: "Mock webhook acknowledged",
    };
  }

  async getHistory(
    userId: string,
    query: {
      page?: number;
      limit?: number;
      status?: TransactionStatus;
      payment_type?: PaymentType;
      date_from?: string;
      date_to?: string;
    }
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const where: Prisma.PaymentWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
      ...(query.payment_type && { paymentType: query.payment_type }),
      ...(query.date_from || query.date_to
        ? {
            createdAt: {
              ...(query.date_from ? { gte: new Date(query.date_from) } : {}),
              ...(query.date_to ? { lte: new Date(query.date_to) } : {}),
            },
          }
        : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { id: true, orderNumber: true, status: true } },
          booking: { select: { id: true, bookingNumber: true, status: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPaymentById(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      include: {
        order: true,
        booking: true,
      },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    return payment;
  }

  async requestRefund(
    userId: string,
    paymentId: string,
    body: { reason: string; amount?: number }
  ) {
    if (!body?.reason) {
      throw new BadRequestException("reason is required");
    }
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException("Payment not found");
    const refundAmt =
      body.amount != null ? new Decimal(body.amount) : payment.amount;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: TransactionStatus.REFUNDED,
        refundAmount: refundAmt,
        refundedAt: new Date(),
        failureReason: body.reason,
      },
    });
    return {
      success: true,
      mock: true,
      payment_id: payment.id,
      refund_amount: refundAmt.toString(),
      status: "REFUNDED",
      message: "Mock refund processed successfully",
    };
  }

  /**
   * Mock refund when an admin resolves a dispute. Uses the latest SUCCESS payment
   * for the dispute's order or booking. If refund_amount is omitted (and an order
   * or booking exists), refunds the full payment amount; if 0, skips refund.
   */
  async applyDisputeRefund(args: {
    orderId?: string | null;
    bookingId?: string | null;
    refund_amount?: number | null;
    resolution: string;
  }) {
    const orderId = args.orderId ?? undefined;
    const bookingId = args.bookingId ?? undefined;
    if (!orderId && !bookingId) {
      return { refund_applied: false, message: "No order or booking on dispute" };
    }

    if (args.refund_amount === 0) {
      return { refund_applied: false, message: "Refund amount is zero; skipped" };
    }

    const where: Prisma.PaymentWhereInput = {
      status: TransactionStatus.SUCCESS,
      ...(orderId ? { orderId } : { bookingId: bookingId! }),
    };

    const payment = await this.prisma.payment.findFirst({
      where,
      orderBy: { createdAt: "desc" },
    });

    if (!payment) {
      return {
        refund_applied: false,
        message: "No successful payment found to refund (mock gateway)",
      };
    }

    const max = payment.amount;
    let refundAmt: Decimal;
    if (args.refund_amount == null) {
      refundAmt = max;
    } else {
      refundAmt = new Decimal(args.refund_amount);
      if (refundAmt.lte(0)) {
        return { refund_applied: false, message: "Invalid refund amount" };
      }
      if (refundAmt.gt(max)) {
        throw new BadRequestException("Refund amount exceeds captured payment");
      }
    }

    const isFull = refundAmt.equals(max);
    const reason = `Dispute resolution (mock refund): ${args.resolution}`;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: TransactionStatus.REFUNDED,
        refundAmount: refundAmt,
        refundedAt: new Date(),
        failureReason: reason,
        metadata: {
          ...((payment.metadata as object) || {}),
          dispute_refund: true,
          mock_refund: true,
        } as Prisma.InputJsonValue,
      },
    });

    if (orderId) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: isFull ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        },
      });
    }

    if (bookingId) {
      await this.prisma.serviceBooking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: isFull ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
        },
      });
    }

    return {
      refund_applied: true,
      mock: true,
      payment_id: payment.id,
      refund_amount: refundAmt.toString(),
      full_refund: isFull,
      message: "Mock refund applied via dispute resolution",
    };
  }

  // --- Vendor ---

  private async requireVendorNursery(vendorUserId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId: vendorUserId },
    });
    if (!nursery) throw new NotFoundException("Nursery not found for vendor");
    return nursery;
  }

  async vendorEarnings(
    vendorUserId: string,
    q: {
      page?: number;
      limit?: number;
      status?: EarningStatus;
      date_from?: string;
      date_to?: string;
    }
  ) {
    const nursery = await this.requireVendorNursery(vendorUserId);
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.VendorEarningWhereInput = {
      nurseryId: nursery.id,
      ...(q.status && { status: q.status }),
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
      this.prisma.vendorEarning.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { order: { select: { orderNumber: true, totalAmount: true } } },
      }),
      this.prisma.vendorEarning.count({ where }),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async vendorEarningsSummary(vendorUserId: string, period?: string) {
    const nursery = await this.requireVendorNursery(vendorUserId);
    const now = new Date();
    let from = new Date(now);
    if (period === "week") from.setDate(from.getDate() - 7);
    else if (period === "year") from.setFullYear(from.getFullYear() - 1);
    else from.setMonth(from.getMonth() - 1);

    const earnings = await this.prisma.vendorEarning.findMany({
      where: { nurseryId: nursery.id, createdAt: { gte: from } },
    });

    let totalEarnings = new Decimal(0);
    let totalCommission = new Decimal(0);
    let netEarnings = new Decimal(0);
    for (const e of earnings) {
      totalEarnings = totalEarnings.plus(e.orderAmount);
      totalCommission = totalCommission.plus(e.commissionAmount);
      netEarnings = netEarnings.plus(e.netEarnings);
    }

    const pendingPayout = await this.prisma.payout.aggregate({
      where: {
        recipientType: RecipientType.VENDOR,
        recipientId: vendorUserId,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] },
      },
      _sum: { amount: true },
    });

    const completedPayouts = await this.prisma.payout.aggregate({
      where: {
        recipientType: RecipientType.VENDOR,
        recipientId: vendorUserId,
        status: PayoutStatus.COMPLETED,
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      total_earnings: totalEarnings.toNumber(),
      total_commission: totalCommission.toNumber(),
      net_earnings: netEarnings.toNumber(),
      pending_payout: pendingPayout._sum.amount?.toNumber() ?? 0,
      completed_payouts: completedPayouts._sum.amount?.toNumber() ?? 0,
      breakdown_by_period: [],
      period: period || "month",
      mock: true,
    };
  }

  async vendorPayouts(
    vendorUserId: string,
    q: { page?: number; limit?: number; status?: PayoutStatus }
  ) {
    await this.requireVendorNursery(vendorUserId);
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.PayoutWhereInput = {
      recipientType: RecipientType.VENDOR,
      recipientId: vendorUserId,
      ...(q.status && { status: q.status }),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.payout.count({ where }),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async vendorPayoutRequest(
    vendorUserId: string,
    body: { amount: number; bank_detail_id: string }
  ) {
    if (body?.amount == null || !body?.bank_detail_id) {
      throw new BadRequestException("amount and bank_detail_id are required");
    }
    await this.requireVendorNursery(vendorUserId);
    const amount = new Decimal(body.amount);
    if (amount.lt(MIN_PAYOUT_AMOUNT)) {
      throw new BadRequestException(`Minimum payout is ${MIN_PAYOUT_AMOUNT.toString()}`);
    }
    const bank = await this.prisma.bankDetail.findFirst({
      where: { id: body.bank_detail_id, userId: vendorUserId },
    });
    if (!bank) throw new NotFoundException("Bank detail not found");

    const payout = await this.prisma.payout.create({
      data: {
        payoutNumber: this.generatePayoutNumber(),
        recipientType: RecipientType.VENDOR,
        recipientId: vendorUserId,
        amount,
        status: PayoutStatus.PENDING,
        notes: JSON.stringify({ bank_detail_id: body.bank_detail_id }),
      },
    });

    return { success: true, mock: true, payout };
  }

  // --- Gardener ---

  private async requireGardener(userId: string) {
    const gardener = await this.prisma.gardener.findUnique({ where: { userId } });
    if (!gardener) throw new NotFoundException("Gardener profile not found");
    return gardener;
  }

  async gardenerEarnings(
    gardenerUserId: string,
    q: {
      page?: number;
      limit?: number;
      status?: EarningStatus;
      earning_type?: string;
      date_from?: string;
      date_to?: string;
    }
  ) {
    const gardener = await this.requireGardener(gardenerUserId);
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.GardenerEarningWhereInput = {
      gardenerId: gardener.id,
      ...(q.status && { status: q.status }),
      ...(q.earning_type && { earningType: q.earning_type as EarningType }),
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
      this.prisma.gardenerEarning.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          task: { select: { taskNumber: true } },
          booking: { select: { bookingNumber: true } },
        },
      }),
      this.prisma.gardenerEarning.count({ where }),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async gardenerEarningsSummary(gardenerUserId: string, period?: string) {
    const gardener = await this.requireGardener(gardenerUserId);
    const now = new Date();
    let from = new Date(now);
    if (period === "week") from.setDate(from.getDate() - 7);
    else if (period === "year") from.setFullYear(from.getFullYear() - 1);
    else from.setMonth(from.getMonth() - 1);

    const earnings = await this.prisma.gardenerEarning.findMany({
      where: { gardenerId: gardener.id, createdAt: { gte: from } },
    });

    let gross = new Decimal(0);
    let commission = new Decimal(0);
    let net = new Decimal(0);
    for (const e of earnings) {
      gross = gross.plus(e.grossAmount);
      commission = commission.plus(e.commissionAmount);
      net = net.plus(e.netEarnings);
    }

    const pendingPayout = await this.prisma.payout.aggregate({
      where: {
        recipientType: RecipientType.GARDENER,
        recipientId: gardenerUserId,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] },
      },
      _sum: { amount: true },
    });

    const completedPayouts = await this.prisma.payout.aggregate({
      where: {
        recipientType: RecipientType.GARDENER,
        recipientId: gardenerUserId,
        status: PayoutStatus.COMPLETED,
      },
      _sum: { amount: true },
    });

    return {
      total_earnings: gross.toNumber(),
      total_commission: commission.toNumber(),
      net_earnings: net.toNumber(),
      pending_payout: pendingPayout._sum.amount?.toNumber() ?? 0,
      completed_payouts: completedPayouts._sum.amount?.toNumber() ?? 0,
      breakdown_by_period: [],
      period: period || "month",
      mock: true,
    };
  }

  async gardenerPayouts(
    gardenerUserId: string,
    q: { page?: number; limit?: number; status?: PayoutStatus }
  ) {
    await this.requireGardener(gardenerUserId);
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.PayoutWhereInput = {
      recipientType: RecipientType.GARDENER,
      recipientId: gardenerUserId,
      ...(q.status && { status: q.status }),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.payout.count({ where }),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async gardenerPayoutRequest(
    gardenerUserId: string,
    body: { amount: number; bank_detail_id: string }
  ) {
    if (body?.amount == null || !body?.bank_detail_id) {
      throw new BadRequestException("amount and bank_detail_id are required");
    }
    await this.requireGardener(gardenerUserId);
    const amount = new Decimal(body.amount);
    if (amount.lt(MIN_PAYOUT_AMOUNT)) {
      throw new BadRequestException(`Minimum payout is ${MIN_PAYOUT_AMOUNT.toString()}`);
    }
    const bank = await this.prisma.bankDetail.findFirst({
      where: { id: body.bank_detail_id, userId: gardenerUserId },
    });
    if (!bank) throw new NotFoundException("Bank detail not found");

    const payout = await this.prisma.payout.create({
      data: {
        payoutNumber: this.generatePayoutNumber(),
        recipientType: RecipientType.GARDENER,
        recipientId: gardenerUserId,
        amount,
        status: PayoutStatus.PENDING,
        notes: JSON.stringify({ bank_detail_id: body.bank_detail_id }),
      },
    });

    return { success: true, mock: true, payout };
  }

  // --- Bank details ---

  async listBankDetails(userId: string) {
    const rows = await this.prisma.bankDetail.findMany({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((b) => ({
      ...b,
      account_number_masked: `****${b.accountNumber.slice(-4)}`,
    }));
  }

  async createBankDetail(
    userId: string,
    body: {
      account_holder_name: string;
      account_number: string;
      bank_name: string;
      ifsc_code: string;
      account_type: "SAVINGS" | "CURRENT";
      is_primary?: boolean;
    }
  ) {
    if (
      !body?.account_holder_name ||
      !body?.account_number ||
      !body?.bank_name ||
      !body?.ifsc_code ||
      !body?.account_type
    ) {
      throw new BadRequestException(
        "account_holder_name, account_number, bank_name, ifsc_code, and account_type are required"
      );
    }
    this.assertIfscMock(body.ifsc_code);
    if (body.is_primary) {
      await this.prisma.bankDetail.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }
    const created = await this.prisma.bankDetail.create({
      data: {
        userId,
        accountHolderName: body.account_holder_name,
        accountNumber: body.account_number,
        bankName: body.bank_name,
        ifscCode: body.ifsc_code,
        accountType: body.account_type,
        isPrimary: !!body.is_primary,
        isVerified: true,
      },
    });
    return {
      ...created,
      account_number_masked: `****${created.accountNumber.slice(-4)}`,
      encrypted: false,
      mock_ifsc_valid: true,
    };
  }

  async updateBankDetail(
    userId: string,
    id: string,
    body: Partial<{
      account_holder_name: string;
      account_number: string;
      bank_name: string;
      ifsc_code: string;
      account_type: "SAVINGS" | "CURRENT";
      is_primary: boolean;
    }>
  ) {
    const existing = await this.prisma.bankDetail.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException("Bank detail not found");
    if (body.ifsc_code) this.assertIfscMock(body.ifsc_code);
    if (body.is_primary) {
      await this.prisma.bankDetail.updateMany({
        where: { userId, NOT: { id } },
        data: { isPrimary: false },
      });
    }
    const updated = await this.prisma.bankDetail.update({
      where: { id },
      data: {
        ...(body.account_holder_name != null && {
          accountHolderName: body.account_holder_name,
        }),
        ...(body.account_number != null && { accountNumber: body.account_number }),
        ...(body.bank_name != null && { bankName: body.bank_name }),
        ...(body.ifsc_code != null && { ifscCode: body.ifsc_code }),
        ...(body.account_type != null && { accountType: body.account_type }),
        ...(body.is_primary != null && { isPrimary: body.is_primary }),
      },
    });
    return {
      ...updated,
      account_number_masked: `****${updated.accountNumber.slice(-4)}`,
    };
  }

  async deleteBankDetail(userId: string, id: string) {
    const existing = await this.prisma.bankDetail.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException("Bank detail not found");

    const pending = await this.prisma.payout.findFirst({
      where: {
        recipientId: userId,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] },
      },
    });
    if (pending) {
      throw new BadRequestException("Cannot delete bank detail while a payout is pending");
    }

    await this.prisma.bankDetail.delete({ where: { id } });
    return { success: true, deleted: true };
  }
}
