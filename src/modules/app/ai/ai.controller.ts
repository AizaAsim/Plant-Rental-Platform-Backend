// src/modules/app/ai/ai.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { AiService, UploadedImageFile } from "./ai.service";
import { RecommendFeedbackDto } from "./dto/recommend-feedback.dto";
import { RecommendOverrideDto } from "../preferences/dto/recommend-override.dto";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

const imageMulter = {
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (
    _req: Express.Request,
    file: { mimetype: string },
    cb: (e: Error | null, ok: boolean) => void
  ) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new BadRequestException("Only image files are allowed"), false);
      return;
    }
    cb(null, true);
  },
};

@ApiTags("AI")
@Controller("api/v1/ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("plant-doctor/diagnose")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.VENDOR, UserRole.GARDENER, UserRole.ADMIN)
  @ApiBearerAuth("bearer")
  @UseInterceptors(FileInterceptor("file", imageMulter))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({
    summary: "Full plant diagnosis (proxies Plant Doctor /diagnose)",
    description:
      "Forwards the image to the Plant Doctor API: species identification, disease detection, and care recommendations.",
  })
  async diagnose(@UploadedFile() file: UploadedImageFile | undefined) {
    return this.aiService.diagnosePlant(file);
  }

  @Post("plant-doctor/plant-diagnosis")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.VENDOR, UserRole.GARDENER, UserRole.ADMIN)
  @ApiBearerAuth("bearer")
  @UseInterceptors(FileInterceptor("file", imageMulter))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({
    summary: "Leaf disease detection (proxies Plant Doctor /plant-diagnosis)",
  })
  async plantDiagnosis(@UploadedFile() file: UploadedImageFile | undefined) {
    return this.aiService.plantDiagnosisQuick(file);
  }

  @Get("plant-doctor")
  @ApiOperation({ summary: "Plant Doctor upstream root (metadata)" })
  async plantDoctorInfo() {
    return this.aiService.plantDoctorRoot();
  }

  @Post("recommender/recommend")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.VENDOR, UserRole.GARDENER, UserRole.ADMIN)
  @ApiBearerAuth("bearer")
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    })
  )
  @ApiBody({
    type: RecommendOverrideDto,
    required: false,
    description:
      "Optional. Omit or send `{}` to use only DB-backed preferences. Any field present overrides the saved value for this request only.",
    examples: {
      empty: { summary: "Use saved preferences only", value: {} },
      overrides: {
        summary: "One-off overrides",
        value: { city: "Lahore", top_n: 5 },
      },
    },
  })
  @ApiOperation({
    summary: "Plant recommendations (proxies upstream POST /recommend)",
    description:
      "**Authentication:** JWT bearer required (Authorize in Swagger must use scheme `bearer`). " +
      "**Payload:** Merged from `PUT /api/v1/preferences/recommendation` plus optional body overrides. " +
      "If nothing is saved yet and the body does not supply all required fields, this API returns **400** with a clear hint. " +
      "**422** is usually the upstream recommender rejecting the merged payload (this service forwards 4xx status codes). " +
      "Returns `log_id` for POST .../recommender/feedback/:log_id. Enums: `light_pref`, `water_pref`, `space` (lowercase).",
  })
  @ApiResponse({ status: 400, description: "Missing prefs — save via PUT /preferences/recommendation or send overrides in body" })
  @ApiResponse({
    status: 422,
    description: "Often forwarded from the upstream recommender (validation on merged payload)",
  })
  @ApiResponse({
    status: 200,
    description: "Upstream recommender JSON (includes log_id, live_weather, recommendations, …)",
    schema: {
      example: {
        log_id: 42,
        city: "Karachi",
        live_weather: { temperature_c: 28, humidity_pct: 55 },
        preferences: {},
        recommendations: [{ rank: 1, plant: "Snake Plant", confidence: "high" }],
      },
    },
  })
  async recommend(
    @Request() req: { user: { id: string } },
    @Body() body: RecommendOverrideDto
  ) {
    return this.aiService.recommendPlants(req.user.id, body);
  }

  @Post("recommender/feedback/:log_id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.VENDOR, UserRole.GARDENER, UserRole.ADMIN)
  @ApiBearerAuth("bearer")
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  @ApiParam({ name: "log_id", description: "log_id returned from /recommend" })
  @ApiBody({ type: RecommendFeedbackDto })
  @ApiOperation({
    summary: "Recommendation feedback (proxies POST /feedback/{log_id})",
  })
  async feedback(@Param("log_id") logId: string, @Body() body: RecommendFeedbackDto) {
    return this.aiService.recommendFeedback(logId, body);
  }

  @Get("recommender/health")
  @ApiOperation({ summary: "Recommender upstream health" })
  async recommenderHealth() {
    return this.aiService.recommenderHealth();
  }

  @Get("recommender/schema")
  @ApiOperation({
    summary: "Recommender input schema (dropdowns)",
    description: "Proxies GET /schema from the plant recommendation service.",
  })
  async recommenderSchema() {
    return this.aiService.recommenderSchema();
  }
}
