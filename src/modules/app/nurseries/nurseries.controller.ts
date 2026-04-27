// src/modules/app/nurseries/nurseries.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
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
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { NurseriesService } from "./nurseries.service";
import { CreateNurseryDto } from "./dto/create-nursery.dto";
import { UpdateWorkingHoursDto } from "./dto/working-hours.dto";
import { UpdateServiceAreasDto } from "./dto/service-areas.dto";
import { AddNurseryImagesDto } from "./dto/nursery-images.dto";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("Nurseries")
@Controller("api/v1/nurseries")
export class NurseriesController {
  constructor(private readonly nurseriesService: NurseriesService) {}

  // ─── Vendor: Create nursery ─────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create nursery profile (for vendors)" })
  @ApiResponse({ status: 201, description: "Nursery created successfully" })
  @ApiResponse({ status: 409, description: "Vendor already has a nursery" })
  async createNursery(@Request() req, @Body() createDto: CreateNurseryDto) {
    return this.nurseriesService.createNursery(req.user.id, createDto);
  }

  // ─── Vendor: my-nursery static routes (BEFORE /:nursery_id) ────────────────

  @Get("my-nursery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get vendor's own nursery" })
  @ApiResponse({ status: 200, description: "Nursery retrieved successfully" })
  @ApiResponse({ status: 404, description: "Nursery not found" })
  async getMyNursery(@Request() req) {
    return this.nurseriesService.getMyNursery(req.user.id);
  }

  @Put("my-nursery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Update nursery profile" })
  @ApiResponse({ status: 200, description: "Nursery updated successfully" })
  async updateMyNursery(
    @Request() req,
    @Body() updateDto: Partial<CreateNurseryDto>
  ) {
    return this.nurseriesService.updateMyNursery(req.user.id, updateDto);
  }

  @Post("my-nursery/images")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add nursery images" })
  @ApiResponse({ status: 201, description: "Images added successfully" })
  async addImages(@Request() req, @Body() addImagesDto: AddNurseryImagesDto) {
    return this.nurseriesService.addImages(req.user.id, addImagesDto);
  }

  @Delete("my-nursery/images/:image_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove nursery image" })
  @ApiParam({ name: "image_id", description: "Image ID" })
  @ApiResponse({ status: 200, description: "Image removed successfully" })
  async deleteImage(@Request() req, @Param("image_id") imageId: string) {
    return this.nurseriesService.deleteImage(req.user.id, imageId);
  }

  @Put("my-nursery/working-hours")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Set working hours" })
  @ApiResponse({ status: 200, description: "Working hours updated successfully" })
  async updateWorkingHours(
    @Request() req,
    @Body() updateDto: UpdateWorkingHoursDto
  ) {
    return this.nurseriesService.updateWorkingHours(req.user.id, updateDto);
  }

  @Get("my-nursery/working-hours")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get working hours" })
  @ApiResponse({ status: 200, description: "Working hours retrieved successfully" })
  async getWorkingHours(@Request() req) {
    return this.nurseriesService.getWorkingHours(req.user.id);
  }

  @Put("my-nursery/service-areas")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Set service areas" })
  @ApiResponse({ status: 200, description: "Service areas updated successfully" })
  async updateServiceAreas(
    @Request() req,
    @Body() updateDto: UpdateServiceAreasDto
  ) {
    return this.nurseriesService.updateServiceAreas(req.user.id, updateDto);
  }

  @Get("my-nursery/service-areas")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get service areas" })
  @ApiResponse({ status: 200, description: "Service areas retrieved successfully" })
  async getServiceAreas(@Request() req) {
    return this.nurseriesService.getServiceAreas(req.user.id);
  }

  @Get("my-nursery/gardeners")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get gardeners assigned to nursery" })
  @ApiResponse({ status: 200, description: "Gardeners retrieved successfully" })
  async getAssignedGardeners(@Request() req) {
    return this.nurseriesService.getAssignedGardeners(req.user.id);
  }

  @Post("my-nursery/gardeners")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create staff gardener account (MISS-13)" })
  async createStaffGardener(@Request() req, @Body() body: Record<string, unknown>) {
    return this.nurseriesService.createStaffGardener(req.user.id, body);
  }

  @Get("my-nursery/gardeners/:gardener_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Staff gardener profile (MISS-14)" })
  @ApiParam({ name: "gardener_id" })
  async getStaffGardener(@Request() req, @Param("gardener_id") gardenerId: string) {
    return this.nurseriesService.getStaffGardenerDetail(req.user.id, gardenerId);
  }

  @Put("my-nursery/gardeners/:gardener_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Update staff gardener (MISS-15)" })
  @ApiParam({ name: "gardener_id" })
  async updateStaffGardener(
    @Request() req,
    @Param("gardener_id") gardenerId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.nurseriesService.updateStaffGardener(req.user.id, gardenerId, body);
  }

  @Post("my-nursery/gardeners/:gardener_id/reset-credentials")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset staff credentials (MISS-16)" })
  @ApiParam({ name: "gardener_id" })
  async resetStaffCredentials(@Request() req, @Param("gardener_id") gardenerId: string) {
    return this.nurseriesService.resetStaffCredentials(req.user.id, gardenerId);
  }

  @Post("my-nursery/gardeners/:gardener_id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Activate/deactivate staff (MOD-07)" })
  @ApiParam({ name: "gardener_id" })
  async setStaffGardenerStatus(
    @Request() req,
    @Param("gardener_id") gardenerId: string,
    @Body() body: { is_active: boolean; reason?: string }
  ) {
    return this.nurseriesService.setStaffGardenerStatus(req.user.id, gardenerId, body);
  }

  // Changed: now sends invitation instead of direct assign
  @Post("my-nursery/gardeners/:gardener_id/invite")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send invitation to gardener" })
  @ApiParam({ name: "gardener_id", description: "Gardener ID" })
  @ApiResponse({ status: 200, description: "Invitation sent successfully" })
  async inviteGardener(
    @Request() req,
    @Param("gardener_id") gardenerId: string,
    @Body() body: { message?: string }
  ) {
    return this.nurseriesService.inviteGardener(req.user.id, gardenerId, body.message);
  }

  @Get("my-nursery/invitations")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get all invitations sent by this nursery" })
  @ApiResponse({ status: 200, description: "Invitations retrieved successfully" })
  async getNurseryInvitations(@Request() req) {
    return this.nurseriesService.getNurseryInvitations(req.user.id);
  }

  @Delete("my-nursery/gardeners/:gardener_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove gardener from nursery" })
  @ApiParam({ name: "gardener_id", description: "Gardener ID" })
  @ApiResponse({ status: 200, description: "Gardener removed successfully" })
  async removeGardener(
    @Request() req,
    @Param("gardener_id") gardenerId: string
  ) {
    return this.nurseriesService.removeGardener(req.user.id, gardenerId);
  }

  // ─── Public static routes (BEFORE /:nursery_id) ────────────────────────────

  @Get("check-serviceability")
  @ApiOperation({ summary: "Check if nursery services a location" })
  @ApiQuery({ name: "nursery_id", required: true, type: String })
  @ApiQuery({ name: "pincode", required: true, type: String })
  @ApiResponse({ status: 200, description: "Serviceability check completed" })
  async checkServiceability(
    @Query("nursery_id") nurseryId: string,
    @Query("pincode") pincode: string
  ) {
    return this.nurseriesService.checkServiceability(nurseryId, pincode);
  }

  @Get("slug/:slug")
  @ApiOperation({ summary: "Get nursery by slug" })
  @ApiParam({ name: "slug", description: "Nursery slug" })
  @ApiResponse({ status: 200, description: "Nursery retrieved successfully" })
  @ApiResponse({ status: 404, description: "Nursery not found" })
  async findBySlug(@Param("slug") slug: string) {
    return this.nurseriesService.findBySlug(slug);
  }

  @Get()
  @ApiOperation({ summary: "Browse all nurseries" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "city", required: false, type: String })
  @ApiQuery({ name: "state", required: false, type: String })
  @ApiQuery({ name: "pincode", required: false, type: String })
  @ApiQuery({ name: "latitude", required: false, type: Number })
  @ApiQuery({ name: "longitude", required: false, type: Number })
  @ApiQuery({ name: "radius_km", required: false, type: Number })
  @ApiQuery({ name: "rating_min", required: false, type: Number })
  @ApiQuery({ name: "is_verified", required: false, type: Boolean })
  @ApiQuery({ name: "sort_by", required: false, enum: ["rating", "distance", "name"] })
  @ApiResponse({ status: 200, description: "Nurseries retrieved successfully" })
  async findAll(@Query() filterDto: any) {
    return this.nurseriesService.findAllNurseries(filterDto);
  }

  // ─── Parameterised routes LAST ──────────────────────────────────────────────

  @Get(":nursery_id")
  @ApiOperation({ summary: "Get nursery details" })
  @ApiParam({ name: "nursery_id", description: "Nursery ID" })
  @ApiResponse({ status: 200, description: "Nursery details retrieved successfully" })
  @ApiResponse({ status: 404, description: "Nursery not found" })
  async findById(@Param("nursery_id") id: string) {
    return this.nurseriesService.findById(id);
  }

  @Get(":nursery_id/plants")
  @ApiOperation({ summary: "Get nursery's plant catalog" })
  @ApiParam({ name: "nursery_id", description: "Nursery ID" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "category_id", required: false, type: String })
  @ApiQuery({ name: "maintenance_level", required: false, type: String })
  @ApiQuery({ name: "price_min", required: false, type: Number })
  @ApiQuery({ name: "price_max", required: false, type: Number })
  @ApiQuery({ name: "is_indoor", required: false, type: Boolean })
  @ApiQuery({ name: "available_for", required: false, enum: ["RENT", "BUY"] })
  @ApiQuery({ name: "sort_by", required: false, enum: ["price", "rating", "popularity"] })
  async getNurseryPlants(
    @Param("nursery_id") nurseryId: string,
    @Query() filterDto: any
  ) {
    return this.nurseriesService.getNurseryPlants(nurseryId, filterDto);
  }

  @Get(":nursery_id/reviews")
  @ApiOperation({ summary: "Get nursery reviews" })
  @ApiParam({ name: "nursery_id", description: "Nursery ID" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "rating", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Reviews retrieved successfully" })
  async getNurseryReviews(
    @Param("nursery_id") nurseryId: string,
    @Query() filterDto: any
  ) {
    return this.nurseriesService.getNurseryReviews(nurseryId, filterDto);
  }
}