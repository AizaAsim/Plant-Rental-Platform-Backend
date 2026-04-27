import { Module } from "@nestjs/common";
import { FreelanceJobsController } from "./freelance-jobs.controller";
import { FreelanceJobsService } from "./freelance-jobs.service";
import { PrismaModule } from "src/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [FreelanceJobsController],
  providers: [FreelanceJobsService],
})
export class FreelanceJobsModule {}
