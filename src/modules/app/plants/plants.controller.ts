import {
  BadRequestException,
  Controller, Get, Post, Put, Patch, Delete,
  Query, Param, Body, UseGuards, Request,
  HttpCode, HttpStatus,
  UseInterceptors, UploadedFiles,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiParam, ApiQuery, ApiBearerAuth, ApiBody, ApiConsumes,
} from "@nestjs/swagger";
import { PlantsService } from "./plants.service";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole, FeatureType } from "@prisma/client";
import { PlantFilterDto } from "./dto/plant-filter.dto";
import {
  CreatePlantDto,
  UpdatePlantDto,
  BulkUpdateDto,
  UpdateStockDto,
  AddPlantImagesDto,
  UpdatePricingDto,
  CreateReviewDto,
} from "./dto/plant-body.dto";
import { PlantListResponseDto, PlantResponseDto, CategoryResponseDto } from "./dto/plant-response.dto";

const plantsImageMulter = {
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (
    _req: import("express").Request,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new BadRequestException("Only image files are allowed"), false);
    }
    cb(null, true);
  },
};

@ApiTags("Plants")
@Controller("api/v1/plants")
export class PlantsController {
  constructor(private readonly plantsService: PlantsService) {}

  // ========== PUBLIC STATIC ROUTES FIRST ==========

  @Get()
  @ApiOperation({ summary: "Browse all plants across nurseries" })
  @ApiResponse({ status: 200, description: "Plants retrieved successfully", type: PlantListResponseDto })
  async findAll(@Query() filterDto: PlantFilterDto) {
    return this.plantsService.findAll(filterDto);
  }

  @Get("featured")
  @ApiOperation({ summary: "Get featured/curated plants" })
  @ApiQuery({ name: "feature_type", required: false, enum: FeatureType })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Featured plants retrieved successfully", type: [PlantResponseDto] })
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
  @ApiResponse({ status: 200, description: "Trending plants retrieved successfully", type: [PlantResponseDto] })
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
  @ApiResponse({ status: 200, description: "Seasonal plants retrieved successfully", type: [PlantResponseDto] })
  async getSeasonal(@Query("limit") limit?: string) {
    return this.plantsService.getSeasonal(limit ? parseInt(limit) : 20);
  }

  @Get("categories")
  @ApiOperation({ summary: "Get all plant categories" })
  @ApiResponse({ status: 200, description: "Categories retrieved successfully", type: [CategoryResponseDto] })
  async getCategories() {
    return this.plantsService.getCategories();
  }

  @Get("categories/:category_id")
  @ApiOperation({ summary: "Get category details with plants" })
  @ApiParam({ name: "category_id", description: "Category ID" })
  @ApiResponse({ status: 200, description: "Category with plants retrieved successfully" })
  async getCategoryById(
    @Param("category_id") categoryId: string,
    @Query() filterDto: PlantFilterDto
  ) {
    return this.plantsService.getCategoryById(categoryId, filterDto);
  }

  @Get("slug/:nursery_slug/:plant_slug")
  @ApiOperation({ summary: "Get plant by slug" })
  @ApiParam({ name: "nursery_slug", description: "Nursery slug" })
  @ApiParam({ name: "plant_slug", description: "Plant slug" })
  @ApiResponse({ status: 200, description: "Plant retrieved successfully", type: PlantResponseDto })
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
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add new plant to nursery catalog" })
  @ApiResponse({ status: 201, description: "Plant created successfully", type: PlantResponseDto })
  async createPlant(@Request() req, @Body() createDto: CreatePlantDto) {
    return this.plantsService.createPlant(req.user.id, createDto);
  }

  @Get("vendor/plants")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get vendor's plant inventory" })
  @ApiResponse({ status: 200, description: "Plants retrieved successfully", type: PlantListResponseDto })
  async getVendorPlants(@Request() req, @Query() filterDto: PlantFilterDto) {
    return this.plantsService.getVendorPlants(req.user.id, filterDto);
  }

  @Put("vendor/plants/bulk-update")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Bulk update multiple plants" })
  @ApiResponse({ status: 200, description: "Bulk update completed" })
  async bulkUpdate(@Request() req, @Body() bulkDto: BulkUpdateDto) {
    return this.plantsService.bulkUpdate(req.user.id, bulkDto);
  }

  @Get("vendor/plants/:plant_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get plant details (vendor view)" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Plant details retrieved successfully", type: PlantResponseDto })
  async getVendorPlant(@Request() req, @Param("plant_id") plantId: string) {
    return this.plantsService.getVendorPlant(req.user.id, plantId);
  }

  @Put("vendor/plants/:plant_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Update plant details" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Plant updated successfully", type: PlantResponseDto })
  async updatePlant(
    @Request() req,
    @Param("plant_id") plantId: string,
    @Body() updateDto: UpdatePlantDto
  ) {
    return this.plantsService.updatePlant(req.user.id, plantId, updateDto);
  }

  @Patch("vendor/plants/:plant_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @UseInterceptors(FilesInterceptor("images", 20, plantsImageMulter))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description:
            "JSON string: UpdatePlant fields (snake_case). Optional key adjustment (number) for relative stock. Omit or use {} to only upload files.",
        },
        images: { type: "array", items: { type: "string", format: "binary" } },
      },
    },
  })
  @ApiOperation({
    summary: "Update plant and/or stock (optionally) and upload new images (local storage)",
  })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Plant details after update" })
  async patchVendorPlantMultipart(
    @Request() req,
    @Param("plant_id") plantId: string,
    @Body() body: { data?: string },
    @UploadedFiles() files: { buffer: Buffer; mimetype: string; size: number }[] | undefined
  ) {
    return this.plantsService.patchVendorPlantWithImages(
      req.user.id,
      plantId,
      body?.data,
      files
    );
  }

  @Delete("vendor/plants/:plant_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
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
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Update stock quantity" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Stock updated successfully" })
  async updateStock(
    @Request() req,
    @Param("plant_id") plantId: string,
    @Body() stockDto: UpdateStockDto
  ) {
    return this.plantsService.updateStock(req.user.id, plantId, stockDto);
  }

  @Patch("vendor/plants/:plant_id/stock")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @UseInterceptors(FilesInterceptor("images", 20, plantsImageMulter))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description:
            "JSON string: stock_quantity and/or adjustment (UpdateStock). Omit to only attach images via upload.",
        },
        images: { type: "array", items: { type: "string", format: "binary" } },
      },
    },
  })
  @ApiOperation({
    summary: "Update stock and optionally upload and attach new images (local storage)",
  })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Plant details after update" })
  async patchVendorStockMultipart(
    @Request() req,
    @Param("plant_id") plantId: string,
    @Body() body: { data?: string },
    @UploadedFiles() files: { buffer: Buffer; mimetype: string; size: number }[] | undefined
  ) {
    return this.plantsService.patchVendorStockWithImages(
      req.user.id,
      plantId,
      body?.data,
      files
    );
  }

  @Post("vendor/plants/:plant_id/images/upload")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor("images", 20, plantsImageMulter))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["images"],
      properties: { images: { type: "array", items: { type: "string", format: "binary" } } },
    },
  })
  @ApiOperation({
    summary: "Upload image files to local storage and attach to plant (no S3; files saved under /uploads/plants/…)",
  })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 201, description: "Created PlantImage records" })
  async uploadVendorPlantImageFiles(
    @Request() req,
    @Param("plant_id") plantId: string,
    @UploadedFiles() files: { buffer: Buffer; mimetype: string; size: number }[] | undefined
  ) {
    if (!files?.length) {
      throw new BadRequestException("At least one file is required under the images field");
    }
    return this.plantsService.attachLocalImagesToPlant(req.user.id, plantId, files);
  }

  @Post("vendor/plants/:plant_id/images")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add plant images" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 201, description: "Images added successfully" })
  async addPlantImages(
    @Request() req,
    @Param("plant_id") plantId: string,
    @Body() imagesDto: AddPlantImagesDto
  ) {
    return this.plantsService.addPlantImages(req.user.id, plantId, imagesDto);
  }

  @Delete("vendor/plants/:plant_id/images/:image_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove plant image" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiParam({ name: "image_id", description: "Image ID" })
  @ApiResponse({ status: 200, description: "Image removed successfully" })
  async deletePlantImage(
    @Request() req,
    @Param("plant_id") plantId: string,
    @Param("image_id") imageId: string
  ) {
    return this.plantsService.deletePlantImage(req.user.id, plantId, imageId);
  }

  @Put("vendor/plants/:plant_id/pricing")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Update plant pricing" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Pricing updated successfully" })
  async updatePricing(
    @Request() req,
    @Param("plant_id") plantId: string,
    @Body() pricingDto: UpdatePricingDto
  ) {
    return this.plantsService.updatePricing(req.user.id, plantId, pricingDto);
  }

  // ========== DYNAMIC :plant_id ROUTES LAST ==========

  @Get(":plant_id")
  @ApiOperation({ summary: "Get plant details" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 200, description: "Plant details retrieved successfully", type: PlantResponseDto })
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
  async getPlantReviews(@Param("plant_id") plantId: string, @Query() filterDto: PlantFilterDto) {
    return this.plantsService.getPlantReviews(plantId, filterDto);
  }

  @Post(":plant_id/reviews")
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add review for plant" })
  @ApiParam({ name: "plant_id", description: "Plant ID" })
  @ApiResponse({ status: 201, description: "Review created successfully" })
  async createReview(
    @Request() req,
    @Param("plant_id") plantId: string,
    @Body() reviewDto: CreateReviewDto
  ) {
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