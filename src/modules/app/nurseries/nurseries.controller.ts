// src/modules/app/nurseries/nurseries.controller.ts
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UsePipes,
  UploadedFiles,
  ValidationPipe,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { FileFieldsInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { NurseriesService } from "./nurseries.service";
import { CreateNurseryDto } from "./dto/create-nursery.dto";
import { UpdateNurseryDto } from "./dto/update-nursery.dto";
import { NurseryListResponseDto, NurseryPublicDto } from "./dto/nursery-public.dto";
import { UpdateWorkingHoursDto } from "./dto/working-hours.dto";
import { UpdateServiceAreasDto } from "./dto/service-areas.dto";
import {
  NurseryMediaResponseDto,
  ReorderNurseryGalleryDto,
} from "./dto/nursery-media.dto";
import {
  MAX_NURSERY_GALLERY_IMAGES,
  NURSERY_CREATE_FILE_FIELDS,
  NURSERY_MEDIA_PATCH_FIELDS,
  NurseryUploadedFiles,
  nurseryImageMulter,
} from "./nursery-media.constants";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

const nurseryMultipartPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

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
  @UseInterceptors(FileFieldsInterceptor([...NURSERY_CREATE_FILE_FIELDS], nurseryImageMulter))
  @UsePipes(nurseryMultipartPipe)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["name", "description", "address_line1", "city", "state", "pincode", "phone", "cover_image", "profile_picture"],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        address_line1: { type: "string" },
        address_line2: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        pincode: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        phone: { type: "string" },
        email: { type: "string" },
        cover_image: { type: "string", format: "binary" },
        profile_picture: { type: "string", format: "binary" },
        logo: { type: "string", format: "binary" },
        gallery_images: { type: "array", items: { type: "string", format: "binary" } },
      },
    },
  })
  @ApiOperation({
    summary: "Create nursery profile with media (multipart)",
    description:
      "Submit nursery fields and image files in one request. `cover_image` and `profile_picture` are required; `logo` and `gallery_images` are optional.",
  })
  @ApiResponse({ status: 201, description: "Nursery created successfully", type: NurseryMediaResponseDto })
  @ApiResponse({ status: 409, description: "Vendor already has a nursery" })
  async createNursery(
    @Request() req,
    @Body() createDto: CreateNurseryDto,
    @UploadedFiles() files: NurseryUploadedFiles
  ) {
    return this.nurseriesService.createNursery(req.user.id, createDto, files ?? {});
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
  @ApiOperation({
    summary: "Update nursery profile (text fields only)",
    description: "Update nursery details. Use PATCH /my-nursery/media for image changes.",
  })
  @ApiResponse({ status: 200, description: "Nursery updated successfully" })
  async updateMyNursery(
    @Request() req,
    @Body() updateDto: UpdateNurseryDto
  ) {
    return this.nurseriesService.updateMyNursery(req.user.id, updateDto);
  }

  @Patch("my-nursery/media")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @UseInterceptors(FileFieldsInterceptor([...NURSERY_MEDIA_PATCH_FIELDS], nurseryImageMulter))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        cover_image: { type: "string", format: "binary" },
        profile_picture: { type: "string", format: "binary" },
        logo: { type: "string", format: "binary" },
        gallery_images: { type: "array", items: { type: "string", format: "binary" } },
      },
    },
  })
  @ApiOperation({
    summary: "Replace or add nursery media",
    description:
      "Send only files being changed. Cover and profile picture can be replaced but not removed without a replacement file.",
  })
  @ApiResponse({ status: 200, type: NurseryMediaResponseDto })
  async patchNurseryMedia(
    @Request() req,
    @UploadedFiles() files: NurseryUploadedFiles
  ) {
    return this.nurseriesService.patchNurseryMedia(req.user.id, files ?? {});
  }

  @Delete("my-nursery/media/logo")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove optional nursery logo" })
  @ApiResponse({ status: 200, type: NurseryMediaResponseDto })
  async deleteNurseryLogo(@Request() req) {
    return this.nurseriesService.deleteNurseryLogo(req.user.id);
  }

  @Post("my-nursery/media/gallery")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor("gallery_images", MAX_NURSERY_GALLERY_IMAGES, nurseryImageMulter))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["gallery_images"],
      properties: {
        gallery_images: { type: "array", items: { type: "string", format: "binary" } },
      },
    },
  })
  @ApiOperation({ summary: "Add gallery images" })
  @ApiResponse({ status: 201, type: NurseryMediaResponseDto })
  async addGalleryImages(
    @Request() req,
    @UploadedFiles() files: { buffer: Buffer; mimetype: string; size: number }[] | undefined
  ) {
    if (!files?.length) {
      throw new BadRequestException("gallery_images is required");
    }
    return this.nurseriesService.addGalleryImages(req.user.id, files);
  }

  @Put("my-nursery/media/gallery/order")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Reorder gallery images" })
  @ApiResponse({ status: 200, type: NurseryMediaResponseDto })
  async reorderGalleryImages(@Request() req, @Body() body: ReorderNurseryGalleryDto) {
    return this.nurseriesService.reorderGalleryImages(req.user.id, body);
  }

  @Delete("my-nursery/media/gallery/:image_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete a gallery image" })
  @ApiParam({ name: "image_id", description: "Gallery image ID" })
  @ApiResponse({ status: 200, type: NurseryMediaResponseDto })
  async deleteGalleryImage(@Request() req, @Param("image_id") imageId: string) {
    return this.nurseriesService.deleteGalleryImage(req.user.id, imageId);
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
  @ApiResponse({ status: 200, description: "Nursery retrieved successfully", type: NurseryPublicDto })
  @ApiResponse({ status: 404, description: "Nursery not found" })
  async findBySlug(@Param("slug") slug: string) {
    return this.nurseriesService.findBySlug(slug);
  }

  @Get("top-rated")
  @ApiOperation({
    summary: "Top-rated nurseries (customer home)",
    description: "Active nurseries sorted by ratingAvg DESC, totalReviews DESC. Verified only by default.",
  })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 5 })
  @ApiQuery({ name: "is_verified", required: false, type: Boolean, example: true })
  @ApiResponse({ status: 200, type: NurseryListResponseDto })
  async findTopRated(
    @Query("limit") limit?: string,
    @Query("is_verified") isVerified?: string
  ) {
    const verified = isVerified === "false" ? false : true;
    return this.nurseriesService.findTopRated(limit ? Number(limit) : 5, verified);
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
  @ApiQuery({
    name: "sort_order",
    required: false,
    enum: ["asc", "desc"],
    description: "Default desc. sort_by=rating uses ratingAvg then totalReviews.",
  })
  @ApiResponse({ status: 200, description: "Nurseries retrieved successfully", type: NurseryListResponseDto })
  async findAll(@Query() filterDto: any) {
    return this.nurseriesService.findAllNurseries(filterDto);
  }

  // ─── Parameterised routes LAST ──────────────────────────────────────────────

  @Get(":nursery_id")
  @ApiOperation({ summary: "Get nursery details (UUID or slug)" })
  @ApiParam({ name: "nursery_id", description: "Nursery UUID or slug" })
  @ApiResponse({ status: 200, description: "Nursery details retrieved successfully", type: NurseryPublicDto })
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

  @Post(":nursery_id/reviews")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER)
  @ApiBearerAuth("bearer")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Review nursery after completed rental" })
  @ApiParam({ name: "nursery_id", description: "Nursery ID" })
  @ApiResponse({ status: 201, description: "Review created successfully" })
  async createNurseryReview(
    @Request() req,
    @Param("nursery_id") nurseryId: string,
    @Body()
    body: {
      order_id: string;
      rating: number;
      plant_quality_rating?: number;
      delivery_rating?: number;
      maintenance_rating?: number;
      comment?: string;
      images?: string[];
    }
  ) {
    return this.nurseriesService.createNurseryReview(req.user.id, nurseryId, body);
  }
}