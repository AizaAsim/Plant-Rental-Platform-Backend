import { Injectable, Logger } from "@nestjs/common";
import {
  NotificationType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  RentalStatus,
} from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk } from "src/common/contract/response";
import { DomainNotificationsService } from "../notifications/domain-notifications.service";
import { PlantInventoryService } from "../inventory/plant-inventory.service";

export type ExpireReason = "PAYMENT_TIMEOUT" | "SLOT_SELECTION_EXPIRED" | "PAYMENT_WINDOW_EXPIRED";

@Injectable()
export class InternalJobsService {
  private readonly log = new Logger(InternalJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainNotifications: DomainNotificationsService,
    private readonly plantInventory: PlantInventoryService
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
   * Terminal EXPIRED + release stock when inventory was reserved at checkout
   * (or legacy approve-time decrement). Idempotent under concurrent runs.
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

      if (order.inventoryDeliveredAt) return;

      const lines = this.plantInventory.linesFromOrderItems(order.items);
      if (order.inventoryReservedAt) {
        await this.plantInventory.releaseReserved(tx, lines);
      } else if (order.vendorApprovalSelections != null) {
        await this.plantInventory.legacyRestoreAvailable(tx, lines);
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
    const dryRun = body.dry_run === true;
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
