// src/modules/app/plants/plants.controller.ts
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
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { PlantsService } from "./plants.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole, FeatureType } from "@prisma/client";

@ApiTags("Plants")
@Controller("api/v1/plants")
export class PlantsController {
  constructor(private readonly plantsService: PlantsService) {}

  // ========== PUBLIC STATIC ROUTES FIRST ==========

  @Get()
  @ApiOperation({ summary: "Browse all plants across nurseries" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "category_id", required: false, type: String })
  @ApiQuery({ name: "category_slug", required: false, type: String })
  @ApiQuery({ name: "nursery_id", required: false, type: String })
  @ApiQuery({ name: "maintenance_level", required: false, enum: ["LOW", "MEDIUM", "HIGH"] })
  @ApiQuery({ name: "sunlight_requirement", required: false })
  @ApiQuery({ name: "water_frequency", required: false })
  @ApiQuery({ name: "is_indoor", required: false, type: Boolean })
  @ApiQuery({ name: "is_pet_friendly", required: false, type: Boolean })
  @ApiQuery({ name: "available_for", required: false, enum: ["RENT", "BUY"] })
  @ApiQuery({ name: "price_min", required: false, type: Number })
  @ApiQuery({ name: "price_max", required: false, type: Number })
  @ApiQuery({ name: "latitude", required: false, type: Number })
  @ApiQuery({ name: "longitude", required: false, type: Number })
  @ApiQuery({ name: "radius_km", required: false, type: Number })
  @ApiQuery({ name: "pincode", required: false, type: String })
  @ApiQuery({ name: "tags", required: false, type: [String] })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "sort_by", required: false, enum: ["price_asc", "price_desc", "rating", "popularity", "newest"] })
  @ApiResponse({ status: 200, description: "Plants retrieved successfully" })
  async findAll(@Query() filterDto: any) {
    return this.plantsService.findAll(filterDto);
  }

  @Get("featured")
  @ApiOperation({ summary: "Get featured/curated plants" })
  @ApiQuery({ name: "feature_type", required: false, enum: FeatureType })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Featured plants retrieved successfully" })
  async getFeatured(
    @Query("feature_type") featureType?: FeatureType,
    @Query("limit") limit?: string
  ) {
    return this.plantsService.getFeatured(featureType, limit ? parseInt(limit) : 20);
  }

  @Get("trending")
  @ApiOperation({ summary: "Get trending plants" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "days", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Trending plants retrieved successfully" })
  async getTrending(
    @Query("limit") limit?: string,
    @Query("days") days?: string
  ) {
    return this.plantsService.getTrending(
      limit ? parseInt(limit) : 20,
      days ? parseInt(days) : 7
    );
  }

  @Get("seasonal")
  @ApiOperation({ summary: "Get seasonal recommendations" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Seasonal plants retrieved successfully" })
  async getSeasonal(@Query("limit") limit?: string) {
    return this.plantsService.getSeasonal(limit ? parseInt(limit) : 20);
  }

  @Get("categories")
  @ApiOperation({ summary: "Get all plant categories" })
  @ApiResponse({ status: 200, description: "Categories retrieved successfully" })
  async getCategories() {
    return this.plantsService.getCategories();
  }

  @Get("categories/:category_id")
  @ApiOperation({ summary: "Get category details with plants" })
  @ApiParam({ name: "category_id", description: "Category ID" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Category with plants retrieved successfully" })
  async getCategoryById(
    @Param("category_id") categoryId: string,
    @Query() filterDto: any
  ) {
    return this.plantsService.getCategoryById(categoryId, filterDto);
  }

  @Get("slug/:nursery_slug/:plant_slug")
  @ApiOperation({ summary: "Get plant by slug" })
  @ApiParam({ name: "nursery_slug", description: "Nursery slug" })
  @ApiParam({ name: "plant_slug", description: "Plant slug" })
  @ApiResponse({ status: 200, description: "Plant retrieved successfully" })
  @ApiResponse({ status: 404, description: "Plant not found" })
  async findBySlug(
    @Param("nursery_slug") nurserySlug: string,
    @Param("plant_slug") plantSlug: string
  ) {
    return this.plantsService.findBySlug(nurserySlug, plantSlug);
  }

  // ========== VENDOR ROUTES (protected) ==========

  @Post("vendor/plants")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add new plant to nursery catalog" })
  @ApiResponse({ status: 201, description: "Plant created successfully" })
  async createPlant(@Request() req, @Body() createDto: any) {
    return this.plantsService.createPlant(req.user.id, createDto);
  }

  @Get("vendor/plants")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Get vendor's plant inventory" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "category_id", required: false, type: String })
  @ApiQuery({ name: "is_active", required: false, type: Boolean })
  @ApiQuery({ name: "stock_status", required: false, enum: ["in_stock", "out_of_stock", "low_stock"] })
  @ApiResponse({ status: 200, description: "Plants retrieved successfully" })
  async getVendorPlants(@Request() req, @Query() filterDto: any) {
    return this.plantsService.getVendorPlants(req.user.id, filterDto);
  }

  @Put("vendor/plants/bulk-update")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Bulk update multiple plants" })
  @ApiResponse({ status: 200, description: "Bulk update completed" })
  async bulkUpdate(@Request() req, @Body() bulkDto: any) {
    return this.plantsService.bulkUpdate(req.user.id, bulkDto);
  }

  @Get("vendor/plants/:plant_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Get plant details (vendor view)" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Plant details retrieved successfully" })
  async getVendorPlant(@Request() req, @Param("plant_id") plantId: string) {
    return this.plantsService.getVendorPlant(req.user.id, plantId);
  }

  @Put("vendor/plants/:plant_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Update plant details" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Plant updated successfully" })
  async updatePlant(@Request() req, @Param("plant_id") plantId: string, @Body() updateDto: any) {
    return this.plantsService.updatePlant(req.user.id, plantId, updateDto);
  }

  @Delete("vendor/plants/:plant_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete/deactivate plant" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Plant deleted/deactivated successfully" })
  async deletePlant(@Request() req, @Param("plant_id") plantId: string) {
    return this.plantsService.deletePlant(req.user.id, plantId);
  }

  @Put("vendor/plants/:plant_id/stock")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Update stock quantity" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Stock updated successfully" })
  async updateStock(@Request() req, @Param("plant_id") plantId: string, @Body() stockDto: any) {
    return this.plantsService.updateStock(req.user.id, plantId, stockDto);
  }

  @Post("vendor/plants/:plant_id/images")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add plant images" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 201, description: "Images added successfully" })
  async addPlantImages(@Request() req, @Param("plant_id") plantId: string, @Body() imagesDto: any) {
    return this.plantsService.addPlantImages(req.user.id, plantId, imagesDto);
  }

  @Delete("vendor/plants/:plant_id/images/:image_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove plant image" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiParam({ name: "image_id", description: "Image ID" })
  @ApiResponse({ status: 200, description: "Image removed successfully" })
  async deletePlantImage(@Request() req, @Param("plant_id") plantId: string, @Param("image_id") imageId: string) {
    return this.plantsService.deletePlantImage(req.user.id, plantId, imageId);
  }

  @Put("vendor/plants/:plant_id/pricing")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: "Update plant pricing" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Pricing updated successfully" })
  async updatePricing(@Request() req, @Param("plant_id") plantId: string, @Body() pricingDto: any) {
    return this.plantsService.updatePricing(req.user.id, plantId, pricingDto);
  }

  // ========== DYNAMIC :plant_id ROUTES LAST ==========

  @Get(":plant_id")
  @ApiOperation({ summary: "Get plant details" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Plant details retrieved successfully" })
  @ApiResponse({ status: 404, description: "Plant not found" })
  async findById(@Param("plant_id") plantId: string) {
    return this.plantsService.findById(plantId);
  }

  @Get(":plant_id/reviews")
  @ApiOperation({ summary: "Get plant reviews" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "rating", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Reviews retrieved successfully" })
  async getPlantReviews(@Param("plant_id") plantId: string, @Query() filterDto: any) {
    return this.plantsService.getPlantReviews(plantId, filterDto);
  }

  @Post(":plant_id/reviews")
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth('bearer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add review for plant" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 201, description: "Review created successfully" })
  async createReview(@Request() req, @Param("plant_id") plantId: string, @Body() reviewDto: any) {
    return this.plantsService.createReview(req.user.id, plantId, reviewDto);
  }

  @Get(":plant_id/availability")
  @ApiOperation({ summary: "Check plant availability for dates" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiQuery({ name: "start_date", required: false, type: String })
  @ApiQuery({ name: "end_date", required: false, type: String })
  @ApiQuery({ name: "quantity", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Availability checked successfully" })
  async checkAvailability(@Param("plant_id") plantId: string, @Query() filterDto: any) {
    return this.plantsService.checkAvailability(plantId, filterDto);
  }
}