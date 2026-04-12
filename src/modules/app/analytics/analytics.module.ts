import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { AnalyticsService } from "./analytics.service";
import { AdminAnalyticsController } from "./admin-analytics.controller";
import { VendorAnalyticsController } from "./vendor-analytics.controller";

@Module({
  imports: [PrismaModule],
  controllers: [AdminAnalyticsController, VendorAnalyticsController],
  providers: [AnalyticsService, RolesGuard],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
