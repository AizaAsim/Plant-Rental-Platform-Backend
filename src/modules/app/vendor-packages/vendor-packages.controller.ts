import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { VendorPackagesService } from "./vendor-packages.service";
import { CreateVendorPackageDto, UpdateVendorPackageDto } from "./dto/vendor-package.dto";

@ApiTags("Vendor packages (Phase 02)")
@Controller("api/v1/vendor/packages")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@ApiBearerAuth("bearer")
export class VendorPackagesController {
  constructor(private readonly svc: VendorPackagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create vendor-owned rental package",
    description:
      "Replaces reliance on legacy public PlantPackage catalogue for tenants that sell package tiers. Requires an existing nursery profile.",
  })
  @ApiBody({ type: CreateVendorPackageDto })
  async create(@Request() req: { user: { id: string } }, @Body() body: CreateVendorPackageDto) {
    return this.svc.create(req.user.id, body);
  }

  @Get()
  @ApiOperation({
    summary: "List vendor packages for your nursery",
    description: "Optional filter by is_active. Response uses contract envelope with data.items[].",
  })
  @ApiQuery({ name: "is_active", required: false, type: Boolean })
  async list(@Request() req: { user: { id: string } }, @Query("is_active") isActive?: string) {
    const f = isActive === "true" ? true : isActive === "false" ? false : undefined;
    return this.svc.list(req.user.id, f);
  }

  @Get(":package_id")
  @ApiOperation({
    summary: "Get one vendor package",
    description:
      "`package_id` may be the public id from list/create (recommended) or the row UUID for backwards compatibility.",
  })
  @ApiParam({
    name: "package_id",
    description: "Public package id (e.g. VPkg-…) or VendorPackage UUID",
  })
  async getOne(@Request() req: { user: { id: string } }, @Param("package_id") packageId: string) {
    return this.svc.getOne(req.user.id, packageId);
  }

  @Put(":package_id")
  @ApiOperation({ summary: "Update vendor package" })
  @ApiParam({ name: "package_id", description: "Public package id or UUID" })
  @ApiBody({ type: UpdateVendorPackageDto })
  async update(
    @Request() req: { user: { id: string } },
    @Param("package_id") packageId: string,
    @Body() body: UpdateVendorPackageDto
  ) {
    return this.svc.update(req.user.id, packageId, body as Record<string, unknown>);
  }

  @Delete(":package_id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Soft-deactivate vendor package (sets is_active false)" })
  @ApiParam({ name: "package_id", description: "Public package id or UUID" })
  async remove(@Request() req: { user: { id: string } }, @Param("package_id") packageId: string) {
    return this.svc.remove(req.user.id, packageId);
  }
}
