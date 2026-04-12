import { Body, Controller, Get, Post, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Gardener finances")
@Controller("api/v1/gardener")
export class GardenerFinancesController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("earnings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Gardener earnings list" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "earning_type", required: false })
  @ApiQuery({ name: "date_from", required: false })
  @ApiQuery({ name: "date_to", required: false })
  async earnings(@Request() req, @Query() q: any) {
    return this.paymentsService.gardenerEarnings(req.user.id, q);
  }

  @Get("earnings/summary")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Gardener earnings summary" })
  @ApiQuery({ name: "period", required: false, enum: ["week", "month", "year"] })
  async summary(@Request() req, @Query("period") period?: string) {
    return this.paymentsService.gardenerEarningsSummary(req.user.id, period);
  }

  @Get("payouts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Gardener payout history" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "status", required: false })
  async payouts(@Request() req, @Query() q: any) {
    return this.paymentsService.gardenerPayouts(req.user.id, q);
  }

  @Post("payouts/request")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Request gardener payout (mock)" })
  async payoutRequest(@Request() req, @Body() body: any) {
    return this.paymentsService.gardenerPayoutRequest(req.user.id, body);
  }
}
