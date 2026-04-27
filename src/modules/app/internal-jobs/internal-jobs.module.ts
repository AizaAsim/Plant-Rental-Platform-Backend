import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { InternalJobsController } from "./internal-jobs.controller";
import { InternalJobsService } from "./internal-jobs.service";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [PrismaModule],
  controllers: [InternalJobsController],
  providers: [InternalJobsService, RolesGuard],
})
export class InternalJobsModule {}
