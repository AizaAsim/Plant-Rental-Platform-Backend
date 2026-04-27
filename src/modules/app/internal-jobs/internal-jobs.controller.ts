import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { InternalJobsService } from "./internal-jobs.service";

@ApiTags("Internal jobs (contract)")
@Controller("api/v1/internal/jobs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth("bearer")
export class InternalJobsController {
  constructor(private readonly svc: InternalJobsService) {}

  @Post("orders/expire-unpaid")
  @ApiOperation({ summary: "Expire unpaid orders (MISS-08) — admin stub" })
  async expireUnpaid(@Body() body: Record<string, unknown>) {
    return this.svc.expireUnpaid(body);
  }

  @Post("orders/due-reminders")
  @ApiOperation({ summary: "Due reminders (MISS-11) — admin stub" })
  async dueReminders(@Body() body: Record<string, unknown>) {
    return this.svc.dueReminders(body);
  }

  @Post("freelance-jobs/auto-match")
  @ApiOperation({ summary: "Auto-match (MISS-12) — admin stub" })
  async autoMatch(@Body() body: Record<string, unknown>) {
    return this.svc.autoMatch(body);
  }
}
