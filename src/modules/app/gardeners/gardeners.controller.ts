// src/modules/app/gardeners/gardeners.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { GardenersService } from "./gardeners.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Gardeners")
@Controller("api/v1/gardeners")
export class GardenersController {
  constructor(private readonly gardenersService: GardenersService) {}

  @Post("profile")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create gardener profile" })
  @ApiResponse({
    status: 201,
    description: "Gardener profile created successfully",
  })
  async createProfile(@Request() req, @Body() createDto: any) {
    return this.gardenersService.createProfile(req.user.id, createDto);
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get own gardener profile" })
  @ApiResponse({
    status: 200,
    description: "Profile retrieved successfully",
  })
  async getProfile(@Request() req) {
    return this.gardenersService.getProfile(req.user.id);
  }

  @Put("profile")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update gardener profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
  })
  async updateProfile(@Request() req, @Body() updateDto: any) {
    return this.gardenersService.updateProfile(req.user.id, updateDto);
  }

  @Put("availability")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update availability schedule" })
  @ApiResponse({
    status: 200,
    description: "Availability updated successfully",
  })
  async updateAvailability(@Request() req, @Body() availabilityDto: any) {
    return this.gardenersService.updateAvailability(req.user.id, availabilityDto);
  }

  @Put("service-areas")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update service areas" })
  @ApiResponse({
    status: 200,
    description: "Service areas updated successfully",
  })
  async updateServiceAreas(@Request() req, @Body() serviceAreasDto: any) {
    return this.gardenersService.updateServiceAreas(req.user.id, serviceAreasDto);
  }

  @Post("skills")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Add skills" })
  @ApiResponse({
    status: 200,
    description: "Skills added successfully",
  })
  async addSkills(@Request() req, @Body() skillsDto: any) {
    return this.gardenersService.addSkills(req.user.id, skillsDto);
  }

  @Delete("skills/:skill_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove skill" })
  @ApiParam({ name: "skill_id", description: "Skill ID" })
  @ApiResponse({
    status: 200,
    description: "Skill removed successfully",
  })
  async removeSkill(@Request() req, @Param("skill_id") skillId: string) {
    return this.gardenersService.removeSkill(req.user.id, skillId);
  }

  @Get("freelance")
  @ApiOperation({ summary: "Browse freelance gardeners" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "pincode", required: false, type: String })
  @ApiQuery({ name: "city", required: false, type: String })
  @ApiQuery({ name: "skill_ids", required: false, type: [String] })
  @ApiQuery({ name: "rating_min", required: false, type: Number })
  @ApiQuery({ name: "hourly_rate_min", required: false, type: Number })
  @ApiQuery({ name: "hourly_rate_max", required: false, type: Number })
  @ApiQuery({ name: "available_date", required: false, type: String })
  @ApiQuery({ name: "available_time", required: false, type: String })
  @ApiQuery({ name: "sort_by", required: false, enum: ["rating", "price", "experience"] })
  @ApiResponse({
    status: 200,
    description: "Gardeners retrieved successfully",
  })
  async browseFreelance(@Query() filterDto: any) {
    return this.gardenersService.browseFreelance(filterDto);
  }

  @Get(":gardener_id")
  @ApiOperation({ summary: "Get gardener public profile" })
  @ApiParam({ name: "gardener_id", description: "Gardener ID" })
  @ApiResponse({
    status: 200,
    description: "Gardener profile retrieved successfully",
  })
  async getGardenerById(@Param("gardener_id") gardenerId: string) {
    return this.gardenersService.getGardenerById(gardenerId);
  }

  @Get(":gardener_id/reviews")
  @ApiOperation({ summary: "Get gardener reviews" })
  @ApiParam({ name: "gardener_id", description: "Gardener ID" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "rating", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Reviews retrieved successfully",
  })
  async getGardenerReviews(
    @Param("gardener_id") gardenerId: string,
    @Query() filterDto: any
  ) {
    return this.gardenersService.getGardenerReviews(gardenerId, filterDto);
  }

  @Get(":gardener_id/availability")
  @ApiOperation({ summary: "Check gardener availability" })
  @ApiParam({ name: "gardener_id", description: "Gardener ID" })
  @ApiQuery({ name: "date", required: false, type: String })
  @ApiQuery({ name: "duration_hours", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "Availability checked successfully",
  })
  async checkAvailability(
    @Param("gardener_id") gardenerId: string,
    @Query() filterDto: any
  ) {
    return this.gardenersService.checkAvailability(gardenerId, filterDto);
  }

  @Post("nursery-invitation/:invitation_id/accept")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Accept nursery assignment invitation" })
  @ApiParam({ name: "invitation_id", description: "Invitation ID" })
  @ApiResponse({
    status: 200,
    description: "Invitation accepted successfully",
  })
  async acceptNurseryInvitation(
    @Request() req,
    @Param("invitation_id") invitationId: string
  ) {
    return this.gardenersService.acceptNurseryInvitation(req.user.id, invitationId);
  }

  @Post("nursery-invitation/:invitation_id/decline")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Decline nursery invitation" })
  @ApiParam({ name: "invitation_id", description: "Invitation ID" })
  @ApiResponse({
    status: 200,
    description: "Invitation declined successfully",
  })
  async declineNurseryInvitation(
    @Request() req,
    @Param("invitation_id") invitationId: string
  ) {
    return this.gardenersService.declineNurseryInvitation(req.user.id, invitationId);
  }

  @Post("leave-nursery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GARDENER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Leave current nursery" })
  @ApiResponse({
    status: 200,
    description: "Left nursery successfully",
  })
  async leaveNursery(@Request() req) {
    return this.gardenersService.leaveNursery(req.user.id);
  }

  @Get("skills/all")
  @ApiOperation({ summary: "Get all available skills" })
  @ApiResponse({
    status: 200,
    description: "Skills retrieved successfully",
  })
  async getAllSkills() {
    return this.gardenersService.getAllSkills();
  }
}
