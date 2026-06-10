import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  NotificationType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentType,
  TransactionStatus,
  RentalStatus,
  OrderPenaltyPayStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk } from "src/common/contract/response";
import { DomainNotificationsService } from "../notifications/domain-notifications.service";

const PENALTY_SEED_ORDER_NUMBER = "ORD-SEED-1005";

export type ExpireReason = "PAYMENT_TIMEOUT" | "SLOT_SELECTION_EXPIRED" | "PAYMENT_WINDOW_EXPIRED";

@Injectable()
export class InternalJobsService {
  private readonly log = new Logger(InternalJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainNotifications: DomainNotificationsService
  ) {}

  private getMeta(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
    return {};
  }

  private allowedSourceStatuses(reason: ExpireReason): OrderStatus[] {
    switch (reason) {
      case "PAYMENT_TIMEOUT":
        return [OrderStatus.PENDING];
      case "SLOT_SELECTION_EXPIRED":
        return [OrderStatus.SLOT_PROPOSED];
      case "PAYMENT_WINDOW_EXPIRED":
        return [OrderStatus.SLOT_CONFIRMED, OrderStatus.AWAITING_PAYMENT];
      default:
        return [];
    }
  }

  /**
   * Terminal EXPIRED + release stock when inventory was reserved at vendor approval.
   * Idempotent under concurrent runs.
   */
  async expireOrderWithStockRelease(
    orderId: string,
    reason: ExpireReason
  ): Promise<{ ok: boolean; skipped?: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return { ok: false, skipped: "not_found" };

    const allowed = this.allowedSourceStatuses(reason);
    if (!allowed.includes(order.status)) return { ok: false, skipped: `status_${order.status}` };

    let transitioned = false;
    await this.prisma.$transaction(async (tx) => {
      const u = await tx.order.updateMany({
        where: { id: orderId, status: { in: allowed } },
        data: {
          status: OrderStatus.EXPIRED,
          cancellationReason: reason,
          cancelledAt: new Date(),
        },
      });
      if (u.count === 0) return;
      transitioned = true;
      if (order.vendorApprovalSelections != null) {
        for (const item of order.items) {
          await tx.plant.update({
            where: { id: item.plantId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
      }
    });

    return transitioned ? { ok: true } : { ok: false, skipped: "race_or_duplicate" };
  }

  /** Unpaid checkout past window — default 6h from order creation. */
  async expireUnpaid(body: Record<string, unknown>) {
    const dryRun = body.dry_run === true;
    const hours = Number(body.window_hours ?? process.env.ORDER_UNPAID_EXPIRY_HOURS ?? 6);
    const cut = new Date(Date.now() - hours * 3600 * 1000);
    const candidates = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        createdAt: { lt: cut },
      },
      select: { id: true, orderNumber: true },
      take: 200,
    });
    if (dryRun) {
      return contractOk({
        would_expire: candidates.length,
        order_numbers: candidates.map((c) => c.orderNumber),
        window_hours: hours,
      });
    }
    let expired = 0;
    for (const c of candidates) {
      const r = await this.expireOrderWithStockRelease(c.id, "PAYMENT_TIMEOUT");
      if (r.ok) expired += 1;
    }
    return contractOk({ expired, candidates: candidates.length, window_hours: hours });
  }

  /** `workflowMeta.delivery.slotExpiresAt` passed (set when vendor proposes). */
  async expireStaleSlotProposals(body: Record<string, unknown>) {
    const dryRun = body.dry_run === true;
    const fallbackHours = Number(body.fallback_ttl_hours ?? process.env.ORDER_SLOT_TTL_HOURS ?? 6);
    const fallbackMs = fallbackHours * 3600 * 1000;
    const rows = await this.prisma.order.findMany({
      where: { status: OrderStatus.SLOT_PROPOSED },
      select: { id: true, orderNumber: true, workflowMeta: true, updatedAt: true },
      take: 400,
    });
    const now = Date.now();
    const due: { id: string; orderNumber: string }[] = [];
    for (const r of rows) {
      const m = this.getMeta(r.workflowMeta);
      const del = m.delivery as Record<string, unknown> | undefined;
      const slotExpiresAt = del?.slotExpiresAt;
      if (typeof slotExpiresAt === "string") {
        if (new Date(slotExpiresAt).getTime() > now) continue;
        due.push({ id: r.id, orderNumber: r.orderNumber });
        continue;
      }
      if (r.updatedAt.getTime() + fallbackMs <= now) {
        due.push({ id: r.id, orderNumber: r.orderNumber });
      }
    }
    if (dryRun) {
      return contractOk({ would_expire: due.length, order_numbers: due.map((d) => d.orderNumber) });
    }
    let expired = 0;
    for (const d of due) {
      const r = await this.expireOrderWithStockRelease(d.id, "SLOT_SELECTION_EXPIRED");
      if (r.ok) expired += 1;
    }
    return contractOk({ expired, scanned: rows.length, due: due.length });
  }

  /** `workflowMeta.paymentWindowExpiresAt` passed (set on slot confirm / payment initiate). */
  async expireStalePaymentWindows(body: Record<string, unknown>) {
    const dryRun = body.dry_run === true;
    const rows = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.SLOT_CONFIRMED, OrderStatus.AWAITING_PAYMENT] },
        paymentStatus: PaymentStatus.PENDING,
      },
      select: { id: true, orderNumber: true, workflowMeta: true },
      take: 400,
    });
    const now = Date.now();
    const due: { id: string; orderNumber: string }[] = [];
    for (const r of rows) {
      const m = this.getMeta(r.workflowMeta);
      const exp = m.paymentWindowExpiresAt;
      if (typeof exp !== "string") continue;
      if (new Date(exp).getTime() > now) continue;
      due.push({ id: r.id, orderNumber: r.orderNumber });
    }
    if (dryRun) {
      return contractOk({ would_expire: due.length, order_numbers: due.map((d) => d.orderNumber) });
    }
    let expired = 0;
    for (const d of due) {
      const r = await this.expireOrderWithStockRelease(d.id, "PAYMENT_WINDOW_EXPIRED");
      if (r.ok) expired += 1;
    }
    return contractOk({ expired, scanned: rows.length, due: due.length });
  }

  async dueReminders(body: Record<string, unknown>) {
    // Default preview unless caller explicitly opts in (safe for Swagger / manual runs).
    const dryRun = body.dry_run !== false;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const in3 = new Date(today);
    in3.setUTCDate(in3.getUTCDate() + 3);

    const lines = await this.prisma.orderItem.findMany({
      where: {
        orderType: OrderType.RENT,
        rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
        rentEndDate: { not: null },
        order: {
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        },
      },
      include: {
        order: { select: { id: true, orderNumber: true, userId: true, nurseryId: true } },
      },
    });

    const dueToday: string[] = [];
    const dueIn3: string[] = [];

    for (const line of lines) {
      if (!line.rentEndDate) continue;
      const end = new Date(line.rentEndDate);
      end.setUTCHours(0, 0, 0, 0);
      const orderId = line.order.id;
      if (end.getTime() === today.getTime()) {
        dueToday.push(orderId);
        if (!dryRun) {
          await this.domainNotifications.notifyOrderStatusUpdate({
            orderId,
            orderNumber: line.order.orderNumber,
            customerUserId: line.order.userId,
            status: "RENTAL_DUE_TODAY",
          });
          await this.domainNotifications.notifyVendorByNurseryId(
            line.order.nurseryId,
            "Rental due today",
            `Order ${line.order.orderNumber} rental ends today.`,
            NotificationType.RENTAL,
            "ORDER",
            orderId
          );
        }
      } else if (end.getTime() === in3.getTime()) {
        dueIn3.push(orderId);
        if (!dryRun) {
          await this.domainNotifications.notifyOrderStatusUpdate({
            orderId,
            orderNumber: line.order.orderNumber,
            customerUserId: line.order.userId,
            status: "RENTAL_DUE_IN_3_DAYS",
          });
        }
      }
    }

    return contractOk({
      dry_run: dryRun,
      due_today_orders: [...new Set(dueToday)],
      due_in_3_days_orders: [...new Set(dueIn3)],
      scanned_lines: lines.length,
    });
  }

  async autoMatch(body: Record<string, unknown>) {
    return contractOk({ job_id: body.job_id, message: "Auto-match engine not enabled in this build" });
  }

  /** Insert ORD-SEED-1005 overdue rental + penalty row — no full seed. */
  async bootstrapPenaltyTestOrder(body: { dry_run?: boolean }) {
    const dryRun = body.dry_run === true;
    const customer1 = await this.prisma.user.findUnique({
      where: { email: "customer1@example.com" },
      select: { id: true, email: true },
    });
    const nursery2 = await this.prisma.nursery.findUnique({
      where: { slug: "urban-jungle-pk" },
      select: { id: true, name: true },
    });
    const bird = await this.prisma.plant.findFirst({
      where: { slug: "bird-of-paradise" },
      select: { id: true, name: true, rentPriceMonthly: true },
    });
    const addr = customer1
      ? await this.prisma.userAddress.findFirst({
          where: { userId: customer1.id, label: "Home" },
          select: { id: true },
        })
      : null;

    const missing: string[] = [];
    if (!customer1) missing.push("user customer1@example.com");
    if (!nursery2) missing.push("nursery slug urban-jungle-pk");
    if (!bird) missing.push("plant slug bird-of-paradise");
    if (!addr) missing.push("customer1 Home address");

    const overdueDays = 5;
    const monthly = Number(bird?.rentPriceMonthly ?? 4000);
    const daily = (monthly / 30) * 1;
    const runningTotal = Math.round(daily * overdueDays * 100) / 100;

    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot insert penalty test order. Missing: ${missing.join(", ")}. ` +
          "Create base data once, or run scripts/insert-penalty-order.cjs after prerequisites exist."
      );
    }

    const existing = await this.prisma.order.findUnique({
      where: { orderNumber: PENALTY_SEED_ORDER_NUMBER },
      select: { id: true },
    });

    if (dryRun) {
      return contractOk({
        dry_run: true,
        would_replace_existing: !!existing,
        order_number: PENALTY_SEED_ORDER_NUMBER,
        customer_email: customer1!.email,
        nursery: nursery2!.name,
        plant: bird!.name,
        penalty_pkr: runningTotal,
        overdue_days: overdueDays,
      });
    }

    if (existing) {
      await this.prisma.payment.deleteMany({ where: { orderId: existing.id } });
      await this.prisma.orderPenalty.deleteMany({ where: { orderId: existing.id } });
      await this.prisma.order.delete({ where: { id: existing.id } });
    }

    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d;
    };
    const dateOnly = (d: Date) => new Date(d.toISOString().slice(0, 10));
    const money = (n: number) => new Decimal(n);

    const order = await this.prisma.order.create({
      data: {
        orderNumber: PENALTY_SEED_ORDER_NUMBER,
        userId: customer1!.id,
        nurseryId: nursery2!.id,
        deliveryAddressId: addr!.id,
        orderType: OrderType.RENT,
        status: OrderStatus.DELIVERED,
        subtotal: money(4000),
        deliveryFee: money(200),
        taxAmount: money(420),
        discountAmount: money(0),
        depositAmount: money(2500),
        totalAmount: money(7120),
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: "card",
        deliveredAt: daysAgo(45),
        items: {
          create: {
            plantId: bird!.id,
            quantity: 1,
            orderType: OrderType.RENT,
            unitPrice: money(4000),
            depositPerUnit: money(2500),
            totalPrice: money(4000),
            rentStartDate: dateOnly(daysAgo(40)),
            rentEndDate: dateOnly(daysAgo(overdueDays)),
            rentalStatus: RentalStatus.OVERDUE,
          },
        },
      },
    });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        userId: customer1!.id,
        amount: money(7120),
        paymentType: PaymentType.ORDER,
        paymentMethod: "card",
        paymentGateway: "stripe",
        gatewayTransactionId: "pi_seed_overdue_1005",
        gatewayOrderId: "ord_seed_1005",
        status: TransactionStatus.SUCCESS,
      },
    });

    await this.prisma.orderPenalty.create({
      data: {
        orderId: order.id,
        overdueDays,
        avgDailyRate: money(Math.round(daily * 100) / 100),
        penaltyMultiplier: money(1),
        runningTotal: money(runningTotal),
        payStatus: OrderPenaltyPayStatus.PENDING,
      },
    });

    return contractOk({
      dry_run: false,
      order_id: order.id,
      order_number: PENALTY_SEED_ORDER_NUMBER,
      penalty_pkr: runningTotal,
      overdue_days: overdueDays,
      customer_email: "customer1@example.com",
      penalty_endpoint: `/api/v1/orders/${PENALTY_SEED_ORDER_NUMBER}/penalty`,
    });
  }

  /** Cron + manual: run unpaid checkout, slot, and payment-window expirers. */
  async runOrderExpirySweep() {
    const unpaid = await this.expireUnpaid({ dry_run: false });
    const slots = await this.expireStaleSlotProposals({ dry_run: false });
    const pay = await this.expireStalePaymentWindows({ dry_run: false });
    const u = unpaid as { data?: { expired?: number; would_expire?: number } };
    const s = slots as { data?: { expired?: number; would_expire?: number } };
    const p = pay as { data?: { expired?: number; would_expire?: number } };
    this.log.log(
      `expiry sweep unpaid=${u.data?.expired ?? u.data?.would_expire} slot=${s.data?.expired ?? s.data?.would_expire} pay=${p.data?.expired ?? p.data?.would_expire}`
    );
    return contractOk({
      at: new Date().toISOString(),
      unpaid: u.data,
      slots: s.data,
      payment_windows: p.data,
    });
  }
}
