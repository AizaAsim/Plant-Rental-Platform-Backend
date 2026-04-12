import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ReviewsDisputesService } from "./reviews-disputes.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Reviews")
@Controller("api/v1/reviews")
export class ReviewsController {
  constructor(private readonly svc: ReviewsDisputesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create review" })
  async create(@Request() req, @Body() body: any) {
    return this.svc.createReview(req.user.id, body);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: "List reviews (public)" })
  async list(@Query() q: any) {
    return this.svc.listReviewsPublic(q);
  }

  @Put(":review_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update own review" })
  async update(@Request() req, @Param("review_id") id: string, @Body() body: any) {
    return this.svc.updateReview(req.user.id, id, body);
  }

  @Delete(":review_id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete review (owner or admin)" })
  async remove(@Request() req, @Param("review_id") id: string) {
    return this.svc.deleteReview(req.user.id, req.user.role, id);
  }
}
