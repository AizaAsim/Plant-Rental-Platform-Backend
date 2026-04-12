import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Vendor analytics")
@Controller("api/v1/vendor/analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@ApiBearerAuth()
export class VendorAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("overview")
  @ApiOperation({ summary: "Nursery overview" })
  overview(@Request() req, @Query("period") period?: string) {
    return this.analytics.vendorOverview(req.user.id, period);
  }

  @Get("sales")
  @ApiOperation({ summary: "Sales analytics" })
  sales(@Request() req, @Query("period") period?: string, @Query("group_by") group_by?: string) {
    return this.analytics.vendorSales(req.user.id, period, group_by);
  }

  @Get("inventory")
  @ApiOperation({ summary: "Inventory analytics" })
  inventory(@Request() req) {
    return this.analytics.vendorInventory(req.user.id);
  }

  @Get("rentals")
  @ApiOperation({ summary: "Rental analytics" })
  rentals(@Request() req, @Query("period") period?: string) {
    return this.analytics.vendorRentals(req.user.id, period);
  }
}
