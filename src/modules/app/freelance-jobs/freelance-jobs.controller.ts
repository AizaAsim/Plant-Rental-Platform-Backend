import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Request, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { FreelanceJobsService } from "./freelance-jobs.service";
import {
  freelanceJobCancelApiBody,
  freelanceJobCompleteApiBody,
  freelanceJobCreateApiBody,
  freelanceJobReviewApiBody,
} from "./freelance-jobs.swagger";

const FREELANCE_JOB_STATUSES = ["OPEN", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

@ApiTags("Freelance jobs (marketplace)")
@Controller("api/v1/freelance-jobs")
export class FreelanceJobsController {
  constructor(private readonly svc: FreelanceJobsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @ApiBody(freelanceJobCreateApiBody)
  @ApiOperation({
    summary: "Customer: create open maintenance job (browse / accept by freelancers)",
    description:
      "**State:** OPEN. Requires `delivery_address_id` owned by user. Response `job_id` is the contract public id (`FJB-…`) usable on all `:job_id` routes.",
  })
  async create(@Request() req: { user: { id: string } }, @Body() body: Record<string, unknown>) {
    return this.svc.createRequest(req.user.id, body);
  }

  @Get("my-requests")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Customer: list jobs you posted" })
  @ApiQuery({ name: "status", required: false, enum: FREELANCE_JOB_STATUSES })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async myRequests(@Request() req: { user: { id: string } }, @Query() q: Record<string, string | undefined>) {
    return this.svc.myRequests(req.user.id, q);
  }

  @Get("open")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Gardener (freelance profile): browse OPEN jobs near filters",
    description: "Freelancers only (`is_freelancer` on gardener row).",
  })
  @ApiQuery({ name: "city", required: false })
  @ApiQuery({ name: "pincode", required: false })
  @ApiQuery({ name: "care_type", required: false, description: "Matches array contains" })
  @ApiQuery({ name: "date_from", required: false })
  @ApiQuery({ name: "date_to", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async open(@Query() q: Record<string, string | undefined>) {
    return this.svc.listOpen(q);
  }

  @Get("my-jobs")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Gardener: jobs you have accepted" })
  @ApiQuery({ name: "status", required: false, enum: FREELANCE_JOB_STATUSES })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async myJobs(@Request() req: { user: { id: string } }, @Query() q: Record<string, string | undefined>) {
    return this.svc.myJobs(req.user.id, q);
  }

  @Post(":job_id/cancel")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiBody(freelanceJobCancelApiBody)
  @ApiOperation({
    summary: "Customer: cancel OPEN / ACCEPTED (before in progress)",
    description:
      "Sets status CANCELLED. Blocked while a freelance payment is PENDING or after `paid_at` is set.",
  })
  @ApiParam({ name: "job_id" })
  async cancel(
    @Request() req: { user: { id: string } },
    @Param("job_id") jobId: string,
    @Body() body: { reason?: string }
  ) {
    return this.svc.cancelCustomer(req.user.id, jobId, body ?? {});
  }

  @Post(":job_id/withdraw")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiBody(freelanceJobCancelApiBody)
  @ApiOperation({
    summary: "Gardener: release ACCEPTED job back to OPEN",
    description:
      "Only while status is ACCEPTED and work has not started. Not allowed once payment exists.",
  })
  @ApiParam({ name: "job_id" })
  async withdraw(
    @Request() req: { user: { id: string } },
    @Param("job_id") jobId: string,
    @Body() body: { reason?: string }
  ) {
    return this.svc.withdrawGardener(req.user.id, jobId, body);
  }

  @Get(":job_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Job detail",
    description:
      "`job_id` = public `FJB-…` **or** UUID. Customer: owner only. Freelance gardener: any `OPEN` job, otherwise the assigned gardener only.",
  })
  @ApiParam({
    name: "job_id",
    description: "Public id (FJB-…) or FreelanceJob UUID",
  })
  async getOne(
    @Request() req: { user: { id: string; role: UserRole } },
    @Param("job_id") jobId: string
  ) {
    return this.svc.getOne(req.user.id, req.user.role, jobId);
  }

  @Post(":job_id/accept")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Gardener: accept OPEN job → ACCEPTED", description: "Freelance profile required." })
  @ApiParam({ name: "job_id", description: "FJB-… or UUID" })
  async accept(@Request() req: { user: { id: string } }, @Param("job_id") jobId: string) {
    return this.svc.accept(req.user.id, jobId);
  }

  @Post(":job_id/start")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Gardener: ACCEPTED → IN_PROGRESS" })
  @ApiParam({ name: "job_id" })
  async start(@Request() req: { user: { id: string } }, @Param("job_id") jobId: string) {
    return this.svc.start(req.user.id, jobId);
  }

  @Post(":job_id/complete")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiBody(freelanceJobCompleteApiBody)
  @ApiOperation({ summary: "Gardener: IN_PROGRESS → COMPLETED" })
  @ApiParam({ name: "job_id" })
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
  @HttpCode(HttpStatus.OK)
  @ApiBody(freelanceJobReviewApiBody)
  @ApiOperation({ summary: "Customer: review after COMPLETED (rating + comment)" })
  @ApiParam({ name: "job_id" })
  async review(
    @Request() req: { user: { id: string } },
    @Param("job_id") jobId: string,
    @Body() body: { rating: number; comment?: string }
  ) {
    return this.svc.review(req.user.id, jobId, body);
  }
}
