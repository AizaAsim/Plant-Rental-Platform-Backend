// src/modules/app/orders/orders.module.ts
import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { CartModule } from "../cart/cart.module";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [PrismaModule, CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, RolesGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
