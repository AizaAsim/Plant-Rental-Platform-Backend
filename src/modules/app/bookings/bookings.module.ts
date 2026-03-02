// src/modules/app/bookings/bookings.module.ts
import { Module } from "@nestjs/common";
import { BookingsController } from "./bookings.controller";
import { BookingsService } from "./bookings.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [PrismaModule],
  controllers: [BookingsController],
  providers: [BookingsService, RolesGuard],
  exports: [BookingsService],
})
export class BookingsModule {}
