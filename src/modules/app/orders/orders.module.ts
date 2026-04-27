// src/modules/app/orders/orders.module.ts
import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrderContractFlowService } from "./order-contract-flow.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { CartModule } from "../cart/cart.module";
import { RolesGuard } from "../auth/guard/roles.guard";
@Module({
  imports: [PrismaModule, CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderContractFlowService, RolesGuard],
  exports: [OrdersService, OrderContractFlowService],
})
export class OrdersModule {}
