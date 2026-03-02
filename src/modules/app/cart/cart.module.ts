// src/modules/app/cart/cart.module.ts
import { Module } from "@nestjs/common";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [PrismaModule],
  controllers: [CartController],
  providers: [CartService, RolesGuard],
  exports: [CartService],
})
export class CartModule {}
