// src/modules/app/ai/ai.module.ts
import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import AppConfig from "src/configs/app.config";
import { PrismaModule } from "src/prisma/prisma.module";
import { PreferencesModule } from "../preferences/preferences.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [
    PrismaModule,
    PreferencesModule,
    HttpModule.register({
      timeout: AppConfig.AI.TIMEOUT_MS,
      maxRedirects: 5,
    }),
  ],
  controllers: [AiController],
  providers: [AiService, RolesGuard],
  exports: [AiService],
})
export class AiModule {}
