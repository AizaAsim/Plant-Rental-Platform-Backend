import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk } from "src/common/contract/response";
import { OrderStatus, PaymentStatus } from "@prisma/client";

@Injectable()
export class InternalJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async expireUnpaid(body: Record<string, unknown>) {
    const dryRun = body.dry_run === true;
    const hours = Number(body.window_hours ?? 6);
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
      return contractOk({ would_cancel: candidates.length, order_numbers: candidates.map((c) => c.orderNumber) });
    }
    for (const c of candidates) {
      await this.prisma.order.update({
        where: { id: c.id },
        data: { status: OrderStatus.CANCELLED, cancellationReason: "PAYMENT_TIMEOUT" },
      });
    }
    return contractOk({ cancelled: candidates.length });
  }

  async dueReminders(body: Record<string, unknown>) {
    const dryRun = body.dry_run === true;
    return contractOk({ dry_run: dryRun, message: "Hook for notifications / D-3 reminders" });
  }

  async autoMatch(body: Record<string, unknown>) {
    return contractOk({ job_id: body.job_id, message: "Auto-match engine not enabled in this build" });
  }
}
