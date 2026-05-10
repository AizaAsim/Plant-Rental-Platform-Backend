import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { VendorPackagesService } from "./vendor-packages.service";

/**
 * Public catalogue: active vendor packages for a nursery (Phase 02).
 * Complements authenticated CRUD at /api/v1/vendor/packages.
 */
@ApiTags("Nurseries", "Vendor packages (Phase 02)")
@Controller("api/v1/nurseries")
export class NurseryVendorPackagesController {
  constructor(private readonly vendorPackagesService: VendorPackagesService) {}

  @Get(":nursery_id/vendor-packages")
  @ApiOperation({ summary: "List active vendor rental packages for this nursery (public catalogue)" })
  @ApiParam({ name: "nursery_id", description: "Nursery UUID" })
  @ApiResponse({ status: 200, description: "Package list wrapped in contract envelope" })
  @ApiResponse({ status: 404, description: "Nursery not found or inactive" })
  listForNursery(@Param("nursery_id") nurseryId: string) {
    return this.vendorPackagesService.listPublicCatalogueForNursery(nurseryId);
  }
}
