import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";
import { ReviewsDisputesService } from "./reviews-disputes.service";
import { ReviewsController } from "./reviews.controller";
import { DisputesController } from "./disputes.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController, DisputesController],
  providers: [ReviewsDisputesService, RolesGuard],
  exports: [ReviewsDisputesService],
})
export class ReviewsDisputesModule {}
