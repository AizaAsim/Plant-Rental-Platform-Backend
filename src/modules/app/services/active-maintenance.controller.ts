import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ActiveMaintenanceService } from "./active-maintenance.service";

@ApiTags("Services")
@Controller("api/v1/services")
export class ActiveMaintenanceController {
  constructor(private readonly activeMaintenance: ActiveMaintenanceService) {}

  @Get("active-maintenance")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Active rentals with maintenance enabled (customer_plantservice_active)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  listActiveMaintenance(
    @Request() req: { user: { id: string } },
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.activeMaintenance.listForUser(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
