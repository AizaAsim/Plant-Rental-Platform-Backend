import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RentalExtensionPolicyService } from "./rental-extension-policy.service";
import { RentalExtensionService } from "./rental-extension.service";

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [RentalExtensionPolicyService, RentalExtensionService],
  exports: [RentalExtensionPolicyService, RentalExtensionService],
})
export class RentalExtensionModule {}
