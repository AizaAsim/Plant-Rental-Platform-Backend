import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { VendorOnboardingService } from "./vendor-onboarding.service";

@ApiTags("Vendor onboarding (Phase 00)")
@Controller("api/v1/vendor/onboarding")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@ApiBearerAuth("bearer")
export class VendorOnboardingController {
  constructor(private readonly vendorOnboardingService: VendorOnboardingService) {}

  @Get()
  @ApiOperation({
    summary:
      "Phase 00: onboarding checklist, counts, and canonical map of vendor profile / service areas / packages / staff routes",
  })
  async getOnboarding(@Request() req: { user: { id: string } }) {
    return this.vendorOnboardingService.getDashboard(req.user.id);
  }
}
