// src/modules/app/orders/orders.module.ts
import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { VendorRentalsController } from "./vendor-rentals.controller";
import { OrdersService } from "./orders.service";
import { OrderContractFlowService } from "./order-contract-flow.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { CartModule } from "../cart/cart.module";
import { UsersModule } from "../users/users.module";
import { RolesGuard } from "../auth/guard/roles.guard";
@Module({
  imports: [PrismaModule, CartModule, UsersModule],
  controllers: [OrdersController, VendorRentalsController],
  providers: [OrdersService, OrderContractFlowService, RolesGuard],
  exports: [OrdersService, OrderContractFlowService],
})
export class OrdersModule {}
