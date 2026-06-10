// src/modules/app/nurseries/nurseries.module.ts
import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { NurseriesController } from "./nurseries.controller";
import { NurseriesService } from "./nurseries.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { MediaModule } from "../media/media.module";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [
    PrismaModule,
    MediaModule,
    CacheModule.register({
      ttl: 300, // Default cache TTL in seconds
      max: 100, // Maximum number of items in cache
    }),
  ],
  controllers: [NurseriesController],
  providers: [NurseriesService, RolesGuard],
  exports: [NurseriesService],
})
export class NurseriesModule {}
