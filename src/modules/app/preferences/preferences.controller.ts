import { Body, Controller, Get, Put, Request, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guard/jwt-auth.guard";
import { RolesGuard } from "../auth/guard/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PreferencesService } from "./preferences.service";
import { UpsertRecommendationPreferenceDto } from "./dto/upsert-recommendation-preference.dto";

@ApiTags("Preferences")
@Controller("api/v1/preferences")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.VENDOR, UserRole.GARDENER, UserRole.ADMIN)
@ApiBearerAuth("bearer")
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get("recommendation")
  @ApiOperation({
    summary: "Get saved plant recommendation preferences",
    description: "Values from the onboarding / settings modal. Used by POST /api/v1/ai/recommender/recommend when the body is omitted.",
  })
  @ApiResponse({ status: 200, description: "Preferences in snake_case" })
  @ApiResponse({ status: 404, description: "No row yet — call PUT /preferences/recommendation first" })
  async getRecommendation(@Request() req: { user: { id: string } }) {
    return this.preferencesService.getRecommendationResponse(req.user.id);
  }

  @Put("recommendation")
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  )
  @ApiOperation({ summary: "Save plant recommendation preferences (upsert)" })
  @ApiBody({ type: UpsertRecommendationPreferenceDto })
  @ApiResponse({ status: 200, description: "Saved entity (camelCase in raw Prisma shape)" })
  async putRecommendation(
    @Request() req: { user: { id: string } },
    @Body() body: UpsertRecommendationPreferenceDto
  ) {
    const row = await this.preferencesService.upsertRecommendation(req.user.id, body);
    return row;
  }
}
