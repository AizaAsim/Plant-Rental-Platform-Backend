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
import { PlantChatDto } from "./dto/plant-chat.dto";
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
    summary: "Plant recommendations (Plant RAG chatbot POST /chat)",
    description:
      "**Upstream:** `https://plant-rag-chatbot-en.onrender.com/chat` (override with `APP_AI_PLANT_RAG_CHATBOT_URL`). " +
      "Builds a natural-language prompt from `PUT /api/v1/preferences/recommendation` plus optional body overrides. " +
      "Returns `response`, `sources`, parsed `recommendations[]`, and `catalog_matches` from your active plant catalogue.",
  })
  @ApiResponse({ status: 400, description: "Missing prefs — save via PUT /preferences/recommendation or send overrides in body" })
  @ApiResponse({
    status: 200,
    description: "RAG chatbot response",
    schema: {
      example: {
        engine: "plant-rag-chatbot",
        preferences: { city: "Karachi", light_pref: "low", pet_friendly: true, space: "small", top_n: 3 },
        response: "Here are three low-light plants…",
        sources: ["…"],
        recommendations: [{ rank: 1, summary: "1. **Snake Plant** …" }],
        catalog_matches: [{ plant_id: "uuid", name: "Snake Plant" }],
      },
    },
  })
  async recommend(
    @Request() req: { user: { id: string } },
    @Body() body: RecommendOverrideDto
  ) {
    return this.aiService.recommendPlants(req.user.id, body);
  }

  @Post("recommender/chat")
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
  @ApiBody({ type: PlantChatDto })
  @ApiOperation({
    summary: "Free-form plant Q&A (proxies Plant RAG POST /chat)",
    description:
      "Send any plant care or recommendation question. Same upstream as preference-based recommend.",
  })
  async chat(@Body() body: PlantChatDto) {
    return this.aiService.chatRecommend(body);
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
  @ApiOperation({ summary: "Plant RAG chatbot health probe (POST /chat ping)" })
  async recommenderHealth() {
    return this.aiService.recommenderHealth();
  }

  @Get("recommender/schema")
  @ApiOperation({
    summary: "Recommendation preference schema (for mobile dropdowns)",
    description:
      "App-defined schema for PUT /preferences/recommendation. The RAG chatbot does not expose /schema.",
  })
  async recommenderSchema() {
    return this.aiService.recommenderSchema();
  }
}
