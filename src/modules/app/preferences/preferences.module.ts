import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { PreferencesController } from "./preferences.controller";
import { PreferencesService } from "./preferences.service";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [PrismaModule],
  controllers: [PreferencesController],
  providers: [PreferencesService, RolesGuard],
  exports: [PreferencesService],
})
export class PreferencesModule {}
