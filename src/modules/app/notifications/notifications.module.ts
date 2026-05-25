import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { DomainNotificationsService } from "./domain-notifications.service";

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, DomainNotificationsService, RolesGuard],
  exports: [NotificationsService, DomainNotificationsService],
})
export class NotificationsModule {}
