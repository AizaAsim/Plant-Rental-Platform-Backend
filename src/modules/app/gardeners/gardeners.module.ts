// src/modules/app/gardeners/gardeners.module.ts
import { Module } from "@nestjs/common";
import { GardenersController } from "./gardeners.controller";
import { GardenersService } from "./gardeners.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [PrismaModule],
  controllers: [GardenersController],
  providers: [GardenersService, RolesGuard],
  exports: [GardenersService],
})
export class GardenersModule {}
