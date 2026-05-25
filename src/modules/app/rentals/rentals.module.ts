// src/modules/app/rentals/rentals.module.ts
import { Module } from "@nestjs/common";
import { RentalsController } from "./rentals.controller";
import { RentalsService } from "./rentals.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { CartModule } from "../cart/cart.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { RentalExtensionModule } from "./rental-extension.module";

@Module({
  imports: [PrismaModule, CartModule, RentalExtensionModule],
  controllers: [RentalsController],
  providers: [RentalsService, RolesGuard],
  exports: [RentalsService],
})
export class RentalsModule {}
