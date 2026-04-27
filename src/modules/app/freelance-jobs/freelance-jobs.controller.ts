import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { FreelanceJobsService } from "./freelance-jobs.service";

@ApiTags("Freelance jobs (contract)")
@Controller("api/v1/freelance-jobs")
export class FreelanceJobsController {
  constructor(private readonly svc: FreelanceJobsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Create freelance job request (MISS-04)" })
  async create(@Request() req: { user: { id: string } }, @Body() body: Record<string, unknown>) {
    return this.svc.createRequest(req.user.id, body);
  }

  @Get("my-requests")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "List my freelance requests" })
  async myRequests(@Request() req: { user: { id: string } }, @Query() q: Record<string, string | undefined>) {
    return this.svc.myRequests(req.user.id, q);
  }

  @Get("open")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "List open jobs (MISS-05)" })
  async open(@Query() q: Record<string, string | undefined>) {
    return this.svc.listOpen(q);
  }

  @Post(":job_id/accept")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Accept open job" })
  async accept(@Request() req: { user: { id: string } }, @Param("job_id") jobId: string) {
    return this.svc.accept(req.user.id, jobId);
  }

  @Get("my-jobs")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Gardener's jobs" })
  async myJobs(@Request() req: { user: { id: string } }, @Query() q: Record<string, string | undefined>) {
    return this.svc.myJobs(req.user.id, q);
  }

  @Post(":job_id/start")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Start job (MISS-06)" })
  async start(@Request() req: { user: { id: string } }, @Param("job_id") jobId: string) {
    return this.svc.start(req.user.id, jobId);
  }

  @Post(":job_id/complete")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Complete job (MISS-06)" })
  async complete(
    @Request() req: { user: { id: string } },
    @Param("job_id") jobId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.svc.complete(req.user.id, jobId, body);
  }

  @Post(":job_id/review")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Review after completion (MISS-07)" })
  async review(
    @Request() req: { user: { id: string } },
    @Param("job_id") jobId: string,
    @Body() body: { rating: number; comment?: string }
  ) {
    return this.svc.review(req.user.id, jobId, body);
  }
}
