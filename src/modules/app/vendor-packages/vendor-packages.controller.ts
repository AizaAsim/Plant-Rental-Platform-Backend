import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { VendorPackagesService } from "./vendor-packages.service";

@ApiTags("Vendor packages (contract)")
@Controller("api/v1/vendor/packages")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@ApiBearerAuth("bearer")
export class VendorPackagesController {
  constructor(private readonly svc: VendorPackagesService) {}

  @Post()
  @ApiOperation({ summary: "Create vendor-owned package (MISS-01)" })
  async create(@Request() req: { user: { id: string } }, @Body() body: Record<string, unknown>) {
    return this.svc.create(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: "List vendor packages" })
  @ApiQuery({ name: "is_active", required: false, type: Boolean })
  async list(
    @Request() req: { user: { id: string } },
    @Query("is_active") isActive?: string
  ) {
    const f =
      isActive === "true" ? true : isActive === "false" ? false : undefined;
    return this.svc.list(req.user.id, f);
  }

  @Put(":package_id")
  @ApiOperation({ summary: "Update vendor package" })
  async update(
    @Request() req: { user: { id: string } },
    @Param("package_id") packageId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.svc.update(req.user.id, packageId, body);
  }

  @Delete(":package_id")
  @ApiOperation({ summary: "Soft-deactivate vendor package" })
  async remove(@Request() req: { user: { id: string } }, @Param("package_id") packageId: string) {
    return this.svc.remove(req.user.id, packageId);
  }
}
