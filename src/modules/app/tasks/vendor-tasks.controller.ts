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

@ApiTags("Vendor Tasks")
@Controller("api/v1/vendor/tasks")
export class VendorTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get nursery's tasks" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "gardener_id", required: false, type: String })
  @ApiQuery({ name: "date_from", required: false, type: String })
  @ApiQuery({ name: "date_to", required: false, type: String })
  @ApiResponse({ status: 200, description: "Tasks retrieved successfully" })
  async getVendorTasks(@Request() req, @Query() filterDto: any) {
    return this.tasksService.getVendorTasks(req.user.id, filterDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create maintenance task" })
  @ApiResponse({ status: 201, description: "Task created successfully" })
  async createTask(@Request() req, @Body() createDto: any) {
    return this.tasksService.createTask(req.user.id, createDto);
  }

  @Put(":task_id/reassign")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reassign task to different gardener" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({ status: 200, description: "Task reassigned successfully" })
  async reassignTask(
    @Request() req,
    @Param("task_id") taskId: string,
    @Body() reassignDto: any
  ) {
    return this.tasksService.reassignTask(req.user.id, taskId, reassignDto);
  }

  @Put(":task_id/reschedule")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Reschedule task" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({ status: 200, description: "Task rescheduled successfully" })
  async rescheduleTask(
    @Request() req,
    @Param("task_id") taskId: string,
    @Body() rescheduleDto: any
  ) {
    return this.tasksService.rescheduleTask(req.user.id, taskId, rescheduleDto);
  }

  @Post(":task_id/cancel")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancel task" })
  @ApiParam({ name: "task_id", description: "Task ID" })
  @ApiResponse({ status: 200, description: "Task cancelled successfully" })
  async cancelTask(
    @Request() req,
    @Param("task_id") taskId: string,
    @Body() cancelDto: any
  ) {
    return this.tasksService.cancelTask(req.user.id, taskId, cancelDto);
  }
}
