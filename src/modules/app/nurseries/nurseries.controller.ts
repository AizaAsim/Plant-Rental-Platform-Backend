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

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create nursery profile (for vendors)" })
  @ApiResponse({
    status: 201,
    description: "Nursery created successfully",
  })
  @ApiResponse({ status: 409, description: "Vendor already has a nursery" })
  async createNursery(
    @Request() req,
    @Body() createDto: CreateNurseryDto
  ) {
    return this.nurseriesService.createNursery(req.user.id, createDto);
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
  @ApiResponse({
    status: 200,
    description: "Nurseries retrieved successfully",
  })
  async findAll(@Query() filterDto: any) {
    return this.nurseriesService.findAllNurseries(filterDto);
  }

  @Get(":nursery_id")
  @ApiOperation({ summary: "Get nursery details" })
  @ApiParam({ name: "nursery_id", description: "Nursery ID" })
  @ApiResponse({
    status: 200,
    description: "Nursery details retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Nursery not found" })
  async findById(@Param("nursery_id") id: string) {
    return this.nurseriesService.findById(id);
  }

  @Get("slug/:slug")
  @ApiOperation({ summary: "Get nursery by slug" })
  @ApiParam({ name: "slug", description: "Nursery slug" })
  @ApiResponse({
    status: 200,
    description: "Nursery retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Nursery not found" })
  async findBySlug(@Param("slug") slug: string) {
    return this.nurseriesService.findBySlug(slug);
  }

  @Get("my-nursery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get vendor's own nursery" })
  @ApiResponse({
    status: 200,
    description: "Nursery retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Nursery not found" })
  async getMyNursery(@Request() req) {
    return this.nurseriesService.getMyNursery(req.user.id);
  }

  @Put("my-nursery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update nursery profile" })
  @ApiResponse({
    status: 200,
    description: "Nursery updated successfully",
  })
  async updateMyNursery(
    @Request() req,
    @Body() updateDto: Partial<CreateNurseryDto>
  ) {
    return this.nurseriesService.updateMyNursery(req.user.id, updateDto);
  }

  @Post("my-nursery/images")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add nursery images" })
  @ApiResponse({
    status: 201,
    description: "Images added successfully",
  })
  async addImages(
    @Request() req,
    @Body() addImagesDto: AddNurseryImagesDto
  ) {
    return this.nurseriesService.addImages(req.user.id, addImagesDto);
  }

  @Delete("my-nursery/images/:image_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove nursery image" })
  @ApiParam({ name: "image_id", description: "Image ID" })
  @ApiResponse({
    status: 200,
    description: "Image removed successfully",
  })
  async deleteImage(
    @Request() req,
    @Param("image_id") imageId: string
  ) {
    return this.nurseriesService.deleteImage(req.user.id, imageId);
  }

  @Put("my-nursery/working-hours")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set working hours" })
  @ApiResponse({
    status: 200,
    description: "Working hours updated successfully",
  })
  async updateWorkingHours(
    @Request() req,
    @Body() updateDto: UpdateWorkingHoursDto
  ) {
    return this.nurseriesService.updateWorkingHours(req.user.id, updateDto);
  }

  @Get("my-nursery/working-hours")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get working hours" })
  @ApiResponse({
    status: 200,
    description: "Working hours retrieved successfully",
  })
  async getWorkingHours(@Request() req) {
    return this.nurseriesService.getWorkingHours(req.user.id);
  }

  @Put("my-nursery/service-areas")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set service areas" })
  @ApiResponse({
    status: 200,
    description: "Service areas updated successfully",
  })
  async updateServiceAreas(
    @Request() req,
    @Body() updateDto: UpdateServiceAreasDto
  ) {
    return this.nurseriesService.updateServiceAreas(req.user.id, updateDto);
  }

  @Get("my-nursery/service-areas")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get service areas" })
  @ApiResponse({
    status: 200,
    description: "Service areas retrieved successfully",
  })
  async getServiceAreas(@Request() req) {
    return this.nurseriesService.getServiceAreas(req.user.id);
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
  @ApiResponse({
    status: 200,
    description: "Plants retrieved successfully",
  })
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
  @ApiResponse({
    status: 200,
    description: "Reviews retrieved successfully",
  })
  async getNurseryReviews(
    @Param("nursery_id") nurseryId: string,
    @Query() filterDto: any
  ) {
    return this.nurseriesService.getNurseryReviews(nurseryId, filterDto);
  }

  @Get("my-nursery/gardeners")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get gardeners assigned to nursery" })
  @ApiResponse({
    status: 200,
    description: "Gardeners retrieved successfully",
  })
  async getAssignedGardeners(@Request() req) {
    return this.nurseriesService.getAssignedGardeners(req.user.id);
  }

  @Post("my-nursery/gardeners/:gardener_id/assign")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Assign gardener to nursery" })
  @ApiParam({ name: "gardener_id", description: "Gardener ID" })
  @ApiResponse({
    status: 200,
    description: "Gardener assigned successfully",
  })
  async assignGardener(
    @Request() req,
    @Param("gardener_id") gardenerId: string
  ) {
    return this.nurseriesService.assignGardener(req.user.id, gardenerId);
  }

  @Delete("my-nursery/gardeners/:gardener_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove gardener from nursery" })
  @ApiParam({ name: "gardener_id", description: "Gardener ID" })
  @ApiResponse({
    status: 200,
    description: "Gardener removed successfully",
  })
  async removeGardener(
    @Request() req,
    @Param("gardener_id") gardenerId: string
  ) {
    return this.nurseriesService.removeGardener(req.user.id, gardenerId);
  }

  @Get("check-serviceability")
  @ApiOperation({ summary: "Check if nursery services a location" })
  @ApiQuery({ name: "nursery_id", required: true, type: String })
  @ApiQuery({ name: "pincode", required: true, type: String })
  @ApiResponse({
    status: 200,
    description: "Serviceability check completed",
  })
  async checkServiceability(
    @Query("nursery_id") nurseryId: string,
    @Query("pincode") pincode: string
  ) {
    return this.nurseriesService.checkServiceability(nurseryId, pincode);
  }
}
