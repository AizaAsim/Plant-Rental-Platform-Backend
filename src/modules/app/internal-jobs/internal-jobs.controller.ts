import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  bootstrapPenaltyOrderApiBody,
  dueRemindersApiBody,
  internalJobDryRunApiBody,
  penaltySweepApiBody,
} from "./internal-jobs.swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { InternalJobsService } from "./internal-jobs.service";
import { PenaltyService } from "../orders/penalty.service";

@ApiTags("Internal jobs (contract)")
@Controller("api/v1/internal/jobs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth("bearer")
export class InternalJobsController {
  constructor(
    private readonly svc: InternalJobsService,
    private readonly penaltyService: PenaltyService
  ) {}

  @Post("orders/expire-unpaid")
  @ApiBody(internalJobDryRunApiBody)
  @ApiOperation({ summary: "Expire old unpaid checkout orders (PENDING) + release stock" })
  async expireUnpaid(@Body() body?: Record<string, unknown>) {
    return this.svc.expireUnpaid(body ?? {});
  }

  @Post("orders/expire-stale-slot-proposals")
  @ApiBody(internalJobDryRunApiBody)
  @ApiOperation({
    summary:
      "Expire SLOT_PROPOSED when slot TTL passed (workflowMeta.delivery.slotExpiresAt), else fallback by updatedAt + ORDER_SLOT_TTL_HOURS",
  })
  async expireStaleSlotProposals(@Body() body?: Record<string, unknown>) {
    return this.svc.expireStaleSlotProposals(body ?? {});
  }

  @Post("orders/expire-stale-payment-windows")
  @ApiBody(internalJobDryRunApiBody)
  @ApiOperation({ summary: "Expire SLOT_CONFIRMED / AWAITING_PAYMENT unpaid after paymentWindowExpiresAt" })
  async expireStalePaymentWindows(@Body() body?: Record<string, unknown>) {
    return this.svc.expireStalePaymentWindows(body ?? {});
  }

  @Post("orders/expire-sweep")
  @ApiOperation({
    summary: "Run all order expiry jobs (same as cron)",
    description:
      "No body required. Wired to `ORDER_EXPIRY_CRON_CRON` (default every 10 min). Admin-only manual trigger.",
  })
  async expireSweep() {
    return this.svc.runOrderExpirySweep();
  }

  @Post("orders/due-reminders")
  @ApiBody(dueRemindersApiBody)
  @ApiOperation({
    summary: "Rental due-date reminders (today + 3 days out)",
    description:
      "Optional body `{ dry_run?: boolean }` (defaults to preview). **Do not call from customer/vendor apps.** " +
      "Use admin dashboard → Jobs, or daily cron. Not a user-facing API.",
  })
  async dueReminders(@Body() body?: Record<string, unknown>) {
    return this.svc.dueReminders(body ?? {});
  }

  @Post("orders/penalty-sweep")
  @ApiBody(penaltySweepApiBody)
  @ApiOperation({
    summary: "Mark overdue rentals and accrue penalties (same as daily cron)",
    description:
      "Optional body `{ notify?: boolean }` (default true). **Do not call from customer/vendor apps.** " +
      "Runs automatically at `PENALTY_CRON_CRON` (default 01:00). Admin manual trigger only.",
  })
  async penaltySweep(@Body() body?: { notify?: boolean }) {
    const result = await this.penaltyService.runDailyPenaltySweep(body?.notify !== false);
    return { ok: true, data: result };
  }

  @Post("freelance-jobs/auto-match")
  @ApiOperation({ summary: "Auto-match (MISS-12) — admin stub" })
  async autoMatch(@Body() body: Record<string, unknown>) {
    return this.svc.autoMatch(body);
  }

  @Post("seed/penalty-order")
  @ApiBody(bootstrapPenaltyOrderApiBody)
  @ApiOperation({
    summary: "Insert ORD-SEED-1005 penalty test order (no prisma seed)",
    description:
      "Admin-only. Writes one overdue rental + order_penalties row. Does not wipe the database.",
  })
  async bootstrapPenaltyOrder(@Body() body?: { dry_run?: boolean }) {
    return this.svc.bootstrapPenaltyTestOrder(body ?? {});
  }
}
