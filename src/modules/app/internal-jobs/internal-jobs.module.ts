import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { InternalJobsController } from "./internal-jobs.controller";
import { InternalJobsService } from "./internal-jobs.service";
import { RolesGuard } from "../auth/guard/roles.guard";
import { PenaltyModule } from "../orders/penalty.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { InventoryModule } from "../inventory/inventory.module";

@Module({
  imports: [PrismaModule, PenaltyModule, NotificationsModule, InventoryModule],
  controllers: [InternalJobsController],
  providers: [InternalJobsService, RolesGuard],
  exports: [InternalJobsService],
})
export class InternalJobsModule {}
