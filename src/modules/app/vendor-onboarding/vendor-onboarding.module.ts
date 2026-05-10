import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { VendorOnboardingController } from "./vendor-onboarding.controller";
import { VendorOnboardingService } from "./vendor-onboarding.service";

@Module({
  imports: [PrismaModule],
  controllers: [VendorOnboardingController],
  providers: [VendorOnboardingService, RolesGuard],
})
export class VendorOnboardingModule {}
