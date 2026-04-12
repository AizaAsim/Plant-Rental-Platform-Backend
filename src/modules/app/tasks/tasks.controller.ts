// src/modules/app/tasks/tasks.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { TasksService } from "./tasks.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Tasks")
@Controller("api/v1/tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get tasks (gardener view)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "task_type", required: false })
  @ApiQuery({ name: "date_from", required: false, type: String })
  @ApiQuery({ name: "date_to", required: false, type: String })
  @ApiQuery({ name: "priority", required: false })
  @ApiResponse({
    status: 200,
    description: "Tasks retrieved successfully",
  })
  async getGardenerTasks(@Request() req, @Query() filterDto: any) {
    return this.tasksService.getGardenerTasks(req.user.id, filterDto);
  }

  @Get(":task_id/images")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get task images" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({
    status: 200,
    description: "Images retrieved successfully",
  })
  async getTaskImages(@Request() req, @Param("task_id") taskId: string) {
    return this.tasksService.getTaskImages(req.user.id, taskId, req.user.role);
  }

  @Get(":task_id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get task details" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({
    status: 200,
    description: "Task details retrieved successfully",
  })
  async getTaskById(@Request() req, @Param("task_id") taskId: string) {
    return this.tasksService.getTaskById(req.user.id, taskId, req.user.role);
  }

  @Post(":task_id/accept")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Accept task" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({
    status: 200,
    description: "Task accepted successfully",
  })
  async acceptTask(@Request() req, @Param("task_id") taskId: string) {
    return this.tasksService.acceptTask(req.user.id, taskId);
  }

  @Post(":task_id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject task" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({
    status: 200,
    description: "Task rejected successfully",
  })
  async rejectTask(
    @Request() req,
    @Param("task_id") taskId: string,
    @Body() rejectDto: any
  ) {
    return this.tasksService.rejectTask(req.user.id, taskId, rejectDto);
  }

  @Post(":task_id/start")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Start task" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({
    status: 200,
    description: "Task started successfully",
  })
  async startTask(@Request() req, @Param("task_id") taskId: string) {
    return this.tasksService.startTask(req.user.id, taskId);
  }

  @Post(":task_id/complete")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Complete task" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({
    status: 200,
    description: "Task completed successfully",
  })
  async completeTask(
    @Request() req,
    @Param("task_id") taskId: string,
    @Body() completeDto: any
  ) {
    return this.tasksService.completeTask(req.user.id, taskId, completeDto);
  }

  @Post(":task_id/images")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Upload task images" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({
    status: 201,
    description: "Images uploaded successfully",
  })
  async uploadTaskImages(
    @Request() req,
    @Param("task_id") taskId: string,
    @Body() imagesDto: any
  ) {
    return this.tasksService.uploadTaskImages(req.user.id, taskId, imagesDto);
  }
}
