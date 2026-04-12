import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ReviewsDisputesService } from "./reviews-disputes.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Disputes")
@Controller("api/v1/disputes")
export class DisputesController {
  constructor(private readonly svc: ReviewsDisputesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.VENDOR, UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create dispute" })
  async create(@Request() req, @Body() body: any) {
    return this.svc.createDispute(req.user.id, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "My disputes" })
  async list(@Request() req, @Query() q: any) {
    return this.svc.listMyDisputes(req.user.id, q);
  }

  @Get(":dispute_id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Dispute details (participant)" })
  async one(@Request() req, @Param("dispute_id") id: string) {
    return this.svc.getDisputeUser(req.user.id, req.user.role, id);
  }

  @Post(":dispute_id/messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add dispute message" })
  async message(@Request() req, @Param("dispute_id") id: string, @Body() body: any) {
    return this.svc.addDisputeMessageUser(req.user.id, req.user.role, id, body);
  }
}
