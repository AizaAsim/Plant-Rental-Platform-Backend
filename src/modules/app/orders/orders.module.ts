// src/modules/app/orders/orders.module.ts
import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { VendorRentalsController } from "./vendor-rentals.controller";
import { OrdersService } from "./orders.service";
import { OrderContractFlowService } from "./order-contract-flow.service";
import { OrderComplaintsService } from "./order-complaints.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { CartModule } from "../cart/cart.module";
import { UsersModule } from "../users/users.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { RentalExtensionModule } from "../rentals/rental-extension.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PenaltyModule } from "./penalty.module";

@Module({
  imports: [
    PrismaModule,
    CartModule,
    UsersModule,
    RentalExtensionModule,
    NotificationsModule,
    PenaltyModule,
  ],
  controllers: [OrdersController, VendorRentalsController],
  providers: [OrdersService, OrderContractFlowService, OrderComplaintsService, RolesGuard],
  exports: [
    OrdersService,
    OrderContractFlowService,
    OrderComplaintsService,
    PenaltyModule,
  ],
})
export class OrdersModule {}
