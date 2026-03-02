// src/modules/app/tasks/tasks.module.ts
import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [TasksService, RolesGuard],
  exports: [TasksService],
})
export class TasksModule {}
