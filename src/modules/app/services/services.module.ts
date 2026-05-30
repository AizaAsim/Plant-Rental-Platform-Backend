import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { ActiveMaintenanceController } from "./active-maintenance.controller";
import { ActiveMaintenanceService } from "./active-maintenance.service";

@Module({
  imports: [PrismaModule],
  controllers: [ActiveMaintenanceController],
  providers: [ActiveMaintenanceService, RolesGuard],
  exports: [ActiveMaintenanceService],
})
export class ServicesModule {}
