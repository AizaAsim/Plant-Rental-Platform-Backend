import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PlantInventoryService } from "./plant-inventory.service";
import { contractOk } from "src/common/contract/response";

@ApiTags("Inventory")
@Controller("api/v1/inventory")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@ApiBearerAuth("bearer")
export class InventoryController {
  constructor(private readonly inventory: PlantInventoryService) {}

  @Get()
  @ApiOperation({ summary: "Vendor inventory board" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async list(
    @Request() req: { user: { id: string } },
    @Query() q: { search?: string; page?: string; limit?: string }
  ) {
    const data = await this.inventory.listVendorInventory(req.user.id, {
      search: q.search,
      page: q.page ? Number(q.page) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
    return contractOk(data);
  }

  @Get("picker")
  @ApiOperation({ summary: "Plant picker for package creation" })
  @ApiQuery({ name: "search", required: false })
  async picker(@Request() req: { user: { id: string } }, @Query("search") search?: string) {
    const items = await this.inventory.listPickerPlants(req.user.id, search);
    return contractOk({ items });
  }
}
