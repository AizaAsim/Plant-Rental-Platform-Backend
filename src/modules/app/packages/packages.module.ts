// src/modules/app/packages/packages.module.ts
import { Module } from "@nestjs/common";
import { PackagesController } from "./packages.controller";
import { PackagesService } from "./packages.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [PrismaModule],
  controllers: [PackagesController],
  providers: [PackagesService, RolesGuard],
  exports: [PackagesService],
})
export class PackagesModule {}
