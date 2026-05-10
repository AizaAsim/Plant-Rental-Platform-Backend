import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { NurseriesService } from "../nurseries/nurseries.service";

/**
 * Vendor-facing aliases for nursery staff gardener CRUD.
 * Behaviour is identical to /api/v1/nurseries/my-nursery/gardeners/*.
 */
@ApiTags("Gardener staff (vendor)")
@Controller("api/v1/vendor/staff-gardeners")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@ApiBearerAuth("bearer")
export class VendorStaffGardenersController {
  constructor(private readonly nurseriesService: NurseriesService) {}

  @Get("invitations/sent")
  @ApiOperation({ summary: "List invitations sent by this vendor's nursery (alias of my-nursery/invitations)" })
  getInvitationsSent(@Request() req: { user: { id: string } }) {
    return this.nurseriesService.getNurseryInvitations(req.user.id);
  }

  @Get()
  @ApiOperation({ summary: "List gardeners assigned to vendor nursery" })
  list(@Request() req: { user: { id: string } }) {
    return this.nurseriesService.getAssignedGardeners(req.user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create staff gardener account (temporary password returned)" })
  create(@Request() req: { user: { id: string } }, @Body() body: Record<string, unknown>) {
    return this.nurseriesService.createStaffGardener(req.user.id, body);
  }

  @Get(":gardener_id")
  @ApiOperation({ summary: "Staff gardener detail" })
  @ApiParam({ name: "gardener_id" })
  getOne(@Request() req: { user: { id: string } }, @Param("gardener_id") gardenerId: string) {
    return this.nurseriesService.getStaffGardenerDetail(req.user.id, gardenerId);
  }

  @Put(":gardener_id")
  @ApiOperation({ summary: "Update staff gardener" })
  @ApiParam({ name: "gardener_id" })
  update(
    @Request() req: { user: { id: string } },
    @Param("gardener_id") gardenerId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.nurseriesService.updateStaffGardener(req.user.id, gardenerId, body);
  }

  @Post(":gardener_id/reset-credentials")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset staff password (temporary password returned)" })
  @ApiParam({ name: "gardener_id" })
  resetCredentials(@Request() req: { user: { id: string } }, @Param("gardener_id") gardenerId: string) {
    return this.nurseriesService.resetStaffCredentials(req.user.id, gardenerId);
  }

  @Post(":gardener_id/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Activate or deactivate staff" })
  @ApiParam({ name: "gardener_id" })
  setStatus(
    @Request() req: { user: { id: string } },
    @Param("gardener_id") gardenerId: string,
    @Body() body: { is_active: boolean; reason?: string }
  ) {
    return this.nurseriesService.setStaffGardenerStatus(req.user.id, gardenerId, body);
  }

  @Post(":gardener_id/invite")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send nursery invitation to an existing gardener" })
  @ApiParam({ name: "gardener_id" })
  invite(
    @Request() req: { user: { id: string } },
    @Param("gardener_id") gardenerId: string,
    @Body() body: { message?: string }
  ) {
    return this.nurseriesService.inviteGardener(req.user.id, gardenerId, body?.message);
  }

  @Delete(":gardener_id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove gardener from nursery" })
  @ApiParam({ name: "gardener_id" })
  remove(@Request() req: { user: { id: string } }, @Param("gardener_id") gardenerId: string) {
    return this.nurseriesService.removeGardener(req.user.id, gardenerId);
  }
}
