import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Admin analytics")
@Controller("api/v1/admin/analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("overview")
  @ApiOperation({ summary: "Platform overview" })
  overview(@Query("period") period?: string) {
    return this.analytics.adminOverview(period);
  }

  @Get("revenue")
  @ApiOperation({ summary: "Revenue analytics" })
  revenue(@Query("period") period?: string, @Query("group_by") group_by?: string) {
    return this.analytics.adminRevenue(period, group_by);
  }

  @Get("orders")
  @ApiOperation({ summary: "Order analytics" })
  orders(
    @Query("period") period?: string,
    @Query("group_by") group_by?: string,
    @Query("order_type") order_type?: string
  ) {
    return this.analytics.adminOrdersAnalytics(period, group_by, order_type);
  }

  @Get("top-nurseries")
  @ApiOperation({ summary: "Top nurseries" })
  topNurseries(
    @Query("period") period?: string,
    @Query("limit") limit?: string,
    @Query("metric") metric?: string
  ) {
    return this.analytics.topNurseries(period, limit ? Number(limit) : 10, metric);
  }

  @Get("top-plants")
  @ApiOperation({ summary: "Top plants" })
  topPlants(
    @Query("period") period?: string,
    @Query("limit") limit?: string,
    @Query("metric") metric?: string
  ) {
    return this.analytics.topPlants(period, limit ? Number(limit) : 10, metric);
  }

  @Get("user-growth")
  @ApiOperation({ summary: "User growth" })
  userGrowth(
    @Query("period") period?: string,
    @Query("group_by") group_by?: string,
    @Query("role") role?: UserRole
  ) {
    return this.analytics.userGrowth(period, group_by, role);
  }
}
