// src/modules/app/plants/plants.module.ts
import { CacheModule } from "@nestjs/cache-manager";
import { PlantsController } from "./plants.controller";
import { PlantsService } from "./plants.service";
import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { MediaModule } from "../media/media.module";

@Module({
  imports: [
    PrismaModule,
    MediaModule,
    CacheModule.register({
      ttl: 300, // Default cache TTL in seconds
      max: 100, // Maximum number of items in cache
    }),
  ],
  controllers: [PlantsController],
  providers: [PlantsService],
  exports: [PlantsService],
})
export class PlantsModule {}
