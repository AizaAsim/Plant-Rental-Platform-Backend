import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PenaltyService } from "./penalty.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [PenaltyService],
  exports: [PenaltyService],
})
export class PenaltyModule {}
