import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { PaymentsModule } from "../payments/payments.module";
import { OrdersModule } from "../orders/orders.module";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";

@Module({
  imports: [PrismaModule, PaymentsModule, OrdersModule],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard],
  exports: [AdminService],
})
export class AdminModule {}
