import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { UpsertRecommendationPreferenceDto } from "./dto/upsert-recommendation-preference.dto";
import { RecommendOverrideDto } from "./dto/recommend-override.dto";

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertRecommendation(userId: string, dto: UpsertRecommendationPreferenceDto) {
    const topN = dto.top_n ?? 3;
    return this.prisma.userRecommendationPreference.upsert({
      where: { userId },
      create: {
        userId,
        city: dto.city.trim(),
        lightPref: dto.light_pref,
        waterPref: dto.water_pref ?? null,
        petFriendly: dto.pet_friendly,
        space: dto.space,
        topN,
      },
      update: {
        city: dto.city.trim(),
        lightPref: dto.light_pref,
        waterPref: dto.water_pref ?? null,
        petFriendly: dto.pet_friendly,
        space: dto.space,
        topN,
      },
    });
  }

  async getRecommendationOrNull(userId: string) {
    return this.prisma.userRecommendationPreference.findUnique({
      where: { userId },
    });
  }

  async getRecommendationResponse(userId: string) {
    const row = await this.getRecommendationOrNull(userId);
    if (!row) throw new NotFoundException("Recommendation preferences not set");
    return this.toResponse(row);
  }

  private toResponse(row: {
    city: string;
    lightPref: string;
    waterPref: string | null;
    petFriendly: boolean;
    space: string;
    topN: number;
    updatedAt: Date;
  }) {
    return {
      city: row.city,
      light_pref: row.lightPref,
      water_pref: row.waterPref,
      pet_friendly: row.petFriendly,
      space: row.space,
      top_n: row.topN,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  /**
   * Merge DB row + optional request overrides into upstream recommender payload.
   */
  async buildRecommendPayload(userId: string, override?: RecommendOverrideDto): Promise<Record<string, unknown>> {
    const row = await this.getRecommendationOrNull(userId);
    const o = override ?? {};

    const city = (o.city ?? row?.city)?.trim();
    const light_pref = o.light_pref ?? row?.lightPref;
    const water_pref = o.water_pref !== undefined ? o.water_pref : row?.waterPref ?? undefined;
    const pet_friendly = o.pet_friendly !== undefined ? o.pet_friendly : row?.petFriendly;
    const space = o.space ?? row?.space;
    const top_n = o.top_n !== undefined ? o.top_n : row?.topN ?? 3;

    if (!city) {
      throw new BadRequestException(
        "Missing city. Save your preferences with PUT /api/v1/preferences/recommendation or pass city in the request body."
      );
    }
    if (!light_pref) {
      throw new BadRequestException(
        "Missing light_pref. Save your preferences with PUT /api/v1/preferences/recommendation or pass light_pref in the request body."
      );
    }
    if (pet_friendly === undefined) {
      throw new BadRequestException(
        "Missing pet_friendly. Save your preferences with PUT /api/v1/preferences/recommendation or pass pet_friendly in the request body."
      );
    }
    if (!space) {
      throw new BadRequestException(
        "Missing space. Save your preferences with PUT /api/v1/preferences/recommendation or pass space in the request body."
      );
    }

    const payload: Record<string, unknown> = {
      city,
      light_pref,
      pet_friendly,
      space,
      top_n,
    };
    if (water_pref !== undefined && water_pref !== null && water_pref !== "") {
      payload.water_pref = water_pref;
    }
    return payload;
  }

  /** Natural-language prompt for the Plant RAG chatbot POST /chat. */
  buildRagRecommendMessage(payload: Record<string, unknown>): string {
    const city = String(payload.city ?? "");
    const light = String(payload.light_pref ?? "medium");
    const water =
      payload.water_pref != null && String(payload.water_pref).length
        ? String(payload.water_pref)
        : "flexible";
    const pet = payload.pet_friendly === true ? "yes" : "no";
    const space = String(payload.space ?? "medium");
    const topN = Number(payload.top_n) || 3;

    return (
      `I need plant recommendations for a home in ${city}. ` +
      `Light at the spot: ${light}. ` +
      `How often I can water: ${water}. ` +
      `Pet-friendly plants required: ${pet}. ` +
      `Available space: ${space}. ` +
      `Please recommend exactly ${topN} specific houseplants that fit these constraints. ` +
      `For each plant, give the common name, why it fits, and one care tip.`
    );
  }
}
