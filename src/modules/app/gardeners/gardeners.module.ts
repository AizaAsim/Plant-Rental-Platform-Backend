// src/modules/app/gardeners/gardeners.module.ts
import { Module } from "@nestjs/common";
import { GardenersController } from "./gardeners.controller";
import { GardenersService } from "./gardeners.service";
import { GardenerOnboardingService } from "./gardener-onboarding.service";
import { VendorStaffGardenersController } from "./vendor-staff-gardeners.controller";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { NurseriesModule } from "../nurseries/nurseries.module";

@Module({
  imports: [PrismaModule, NurseriesModule],
  controllers: [GardenersController, VendorStaffGardenersController],
  providers: [GardenersService, GardenerOnboardingService, RolesGuard],
  exports: [GardenersService],
})
export class GardenersModule {}
