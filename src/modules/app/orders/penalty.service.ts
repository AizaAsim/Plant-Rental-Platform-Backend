import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  OrderPenaltyPayStatus,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentType,
  RentalStatus,
  TransactionStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";
import { resolveOrderId } from "src/common/contract/resolve-entity";
import { DomainNotificationsService } from "../notifications/domain-notifications.service";

@Injectable()
export class PenaltyService {
  private readonly log = new Logger(PenaltyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainNotifications: DomainNotificationsService
  ) {}

  private penaltyMultiplier(): Decimal {
    const n = Number(process.env.PENALTY_DAILY_MULTIPLIER ?? 1);
    return new Decimal(Number.isFinite(n) && n > 0 ? n : 1);
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  computeOverdueDays(rentEndDate: Date, asOf: Date = this.startOfToday()): number {
    const end = new Date(rentEndDate);
    end.setUTCHours(0, 0, 0, 0);
    const diff = asOf.getTime() - end.getTime();
    if (diff <= 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  computePenaltyForRentLines(
    rentLines: { rentEndDate: Date | null; plant: { rentPriceMonthly: Decimal | null }; quantity: number }[],
    asOf: Date = this.startOfToday()
  ): { overdueDays: number; avgDailyRate: Decimal; runningTotal: Decimal } {
    let maxOverdue = 0;
    let dailySum = new Decimal(0);

    for (const line of rentLines) {
      if (!line.rentEndDate) continue;
      const days = this.computeOverdueDays(line.rentEndDate, asOf);
      maxOverdue = Math.max(maxOverdue, days);
      const monthly = line.plant.rentPriceMonthly || new Decimal(0);
      dailySum = dailySum.plus(monthly.div(30).times(line.quantity));
    }

    const mult = this.penaltyMultiplier();
    const runningTotal =
      maxOverdue > 0 ? dailySum.times(maxOverdue).times(mult) : new Decimal(0);

    return {
      overdueDays: maxOverdue,
      avgDailyRate: dailySum,
      runningTotal,
    };
  }

  async syncPenaltyForOrder(orderId: string, notify = false) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: {
            orderType: OrderType.RENT,
            rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED, RentalStatus.OVERDUE] },
          },
          include: { plant: true },
        },
        user: { select: { id: true } },
      },
    });
    if (!order || order.items.length === 0) return null;

    const asOf = this.startOfToday();
    const calc = this.computePenaltyForRentLines(order.items, asOf);
    const mult = this.penaltyMultiplier();

    const row = await this.prisma.orderPenalty.upsert({
      where: { orderId },
      create: {
        orderId,
        overdueDays: calc.overdueDays,
        avgDailyRate: calc.avgDailyRate,
        penaltyMultiplier: mult,
        runningTotal: calc.runningTotal,
        payStatus:
          calc.overdueDays > 0 && calc.runningTotal.gt(0)
            ? OrderPenaltyPayStatus.PENDING
            : OrderPenaltyPayStatus.PENDING,
      },
      update: {
        overdueDays: calc.overdueDays,
        avgDailyRate: calc.avgDailyRate,
        penaltyMultiplier: mult,
        runningTotal: calc.runningTotal,
      },
    });

    if (notify && calc.overdueDays > 0 && calc.runningTotal.gt(0)) {
      await this.domainNotifications.notifyRentalOverdue({
        orderId: order.id,
        orderNumber: order.orderNumber,
        nurseryId: order.nurseryId,
        customerUserId: order.userId,
        overdueDays: calc.overdueDays,
        penaltyTotal: Number(calc.runningTotal),
      });
    }

    return row;
  }

  /** Daily cron: mark overdue rentals and accrue penalties. */
  async runDailyPenaltySweep(notifyNewOverdue = true) {
    const asOf = this.startOfToday();
    const candidates = await this.prisma.orderItem.findMany({
      where: {
        orderType: OrderType.RENT,
        rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
        rentEndDate: { lt: asOf },
        order: {
          status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        },
      },
      select: { id: true, orderId: true },
    });

    const orderIds = [...new Set(candidates.map((c) => c.orderId))];
    let marked = 0;

    for (const orderId of orderIds) {
      await this.prisma.orderItem.updateMany({
        where: {
          orderId,
          orderType: OrderType.RENT,
          rentalStatus: { in: [RentalStatus.ACTIVE, RentalStatus.EXTENDED] },
          rentEndDate: { lt: asOf },
        },
        data: { rentalStatus: RentalStatus.OVERDUE },
      });
      marked += 1;
      await this.syncPenaltyForOrder(orderId, notifyNewOverdue);
    }

    const allOverdueOrders = await this.prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
        items: {
          some: {
            orderType: OrderType.RENT,
            rentalStatus: RentalStatus.OVERDUE,
          },
        },
      },
      select: { id: true },
    });

    for (const o of allOverdueOrders) {
      if (!orderIds.includes(o.id)) {
        await this.syncPenaltyForOrder(o.id, false);
      }
    }

    this.log.log(
      `penalty sweep: ${orderIds.length} newly overdue order(s), ${allOverdueOrders.length} total overdue tracked`
    );

    return {
      newly_overdue_orders: orderIds.length,
      tracked_overdue_orders: allOverdueOrders.length,
      at: new Date().toISOString(),
    };
  }

  async getPenaltyForUser(userId: string, orderIdOrNum: string) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw new NotFoundException("Order not found");
    const order = await this.prisma.order.findFirst({ where: { id: oid, userId } });
    if (!order) throw new NotFoundException("Order not found");

    await this.syncPenaltyForOrder(oid, false);
    const row = await this.prisma.orderPenalty.findUnique({ where: { orderId: oid } });
    if (!row) {
      return {
        order_id: order.orderNumber,
        overdue_days: 0,
        avg_daily_rate: null,
        penalty_multiplier: null,
        running_penalty_total: 0,
        penalty_payment_status: OrderPenaltyPayStatus.PENDING,
        payment_for: "PENALTY",
      };
    }

    return {
      order_id: order.orderNumber,
      order_uuid: oid,
      overdue_days: row.overdueDays,
      avg_daily_rate: row.avgDailyRate != null ? Number(row.avgDailyRate) : null,
      penalty_multiplier: row.penaltyMultiplier != null ? Number(row.penaltyMultiplier) : null,
      running_penalty_total: Number(row.runningTotal),
      penalty_payment_status: row.payStatus,
      payment_for: "PENALTY",
      reference_id: oid,
    };
  }

  async applyPenaltyPaymentSuccess(orderId: string, amount: Decimal) {
    await this.prisma.orderPenalty.update({
      where: { orderId },
      data: {
        payStatus: OrderPenaltyPayStatus.PAID,
        meta: { paid_at: new Date().toISOString(), amount: amount.toString() },
      },
    });

    await this.prisma.orderItem.updateMany({
      where: {
        orderId,
        orderType: OrderType.RENT,
        rentalStatus: RentalStatus.OVERDUE,
      },
      data: { rentalStatus: RentalStatus.ACTIVE },
    });

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        nurseryId: true,
        userId: true,
      },
    });
    if (order) {
      await this.domainNotifications.notifyPenaltyPaid({
        orderId: order.id,
        orderNumber: order.orderNumber,
        nurseryId: order.nurseryId,
        customerUserId: order.userId,
        amount: Number(amount),
      });
    }
  }
}
