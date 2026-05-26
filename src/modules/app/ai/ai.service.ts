// src/modules/app/ai/ai.service.ts
import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import FormData = require("form-data");
import AppConfig from "src/configs/app.config";
import { PrismaService } from "src/prisma/prisma.service";
import { PreferencesService } from "../preferences/preferences.service";
import { RecommendFeedbackDto } from "./dto/recommend-feedback.dto";
import { RecommendOverrideDto } from "../preferences/dto/recommend-override.dto";
import { PlantChatDto } from "./dto/plant-chat.dto";
import { RECOMMENDER_INPUT_SCHEMA } from "./recommender-schema";

/** Matches multer memory-storage file shape used by FileInterceptor */
export type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
};

function isAxiosLike(
  err: unknown
): err is { response?: { status?: number; data?: unknown }; message?: string; config?: unknown; isAxiosError?: boolean } {
  if (typeof err !== "object" || err === null) return false;
  const o = err as Record<string, unknown>;
  if (o.isAxiosError === true) return true;
  return "response" in o && "config" in o;
}

type RagChatResponse = {
  response: string;
  sources: string[];
};

@Injectable()
export class AiService {
  constructor(
    private readonly http: HttpService,
    private readonly preferences: PreferencesService,
    private readonly prisma: PrismaService
  ) {}

  private doctorUrl(path: string): string {
    return `${AppConfig.AI.PLANT_DOCTOR_BASE_URL}${path}`;
  }

  private ragChatbotUrl(path: string): string {
    return `${AppConfig.AI.PLANT_RAG_CHATBOT_BASE_URL}${path}`;
  }

  private legacyRecommenderUrl(path: string): string {
    const base = AppConfig.AI.PLANT_RECOMMENDER_LEGACY_BASE_URL;
    if (!base) return "";
    return `${base}${path}`;
  }

  private async postRagChat(message: string): Promise<RagChatResponse> {
    try {
      const { data } = await firstValueFrom(
        this.http.post<RagChatResponse>(
          this.ragChatbotUrl("/chat"),
          { message },
          { headers: { "Content-Type": "application/json" } }
        )
      );
      if (!data?.response || typeof data.response !== "string") {
        throw new HttpException(
          { message: "Plant RAG chatbot returned an invalid response shape" },
          HttpStatus.BAD_GATEWAY
        );
      }
      return {
        response: data.response,
        sources: Array.isArray(data.sources) ? data.sources : [],
      };
    } catch (e: unknown) {
      throw this.mapUpstreamError(e);
    }
  }

  private async matchCatalogPlants(responseText: string) {
    const active = await this.prisma.plant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        scientificName: true,
        nurseryId: true,
        rentPriceMonthly: true,
        nursery: { select: { id: true, name: true } },
      },
      take: 500,
    });
    const hay = responseText.toLowerCase();
    const matches = active.filter((p) => {
      const name = p.name.toLowerCase();
      if (hay.includes(name)) return true;
      if (p.scientificName && hay.includes(p.scientificName.toLowerCase())) return true;
      return false;
    });
    return matches.map((p) => ({
      plant_id: p.id,
      name: p.name,
      scientific_name: p.scientificName,
      nursery_id: p.nurseryId,
      nursery_name: p.nursery?.name ?? null,
      rent_price_monthly: p.rentPriceMonthly != null ? Number(p.rentPriceMonthly) : null,
    }));
  }

  /** Ensures a string `message` so HttpExceptionFilter does not fall back to "An error occurred". */
  private normalizeUpstreamErrorBody(raw: Record<string, unknown>): Record<string, unknown> {
    const msg = raw["message"];
    if (typeof msg === "string" && msg.length) {
      return { ...raw, message: msg };
    }
    const detail = raw["detail"];
    if (detail !== undefined) {
      return {
        ...raw,
        message:
          typeof detail === "string"
            ? detail
            : `Upstream validation: ${JSON.stringify(detail)}`,
      };
    }
    return { ...raw, message: "Upstream AI service rejected the request" };
  }

  private mapUpstreamError(err: unknown): never {
    if (isAxiosLike(err)) {
      const upstream = err.response?.status;
      const status =
        upstream && upstream >= 400 && upstream < 500
          ? upstream
          : HttpStatus.BAD_GATEWAY;
      const raw = err.response?.data;
      const body =
        raw === undefined || raw === null
          ? { message: err.message || "Upstream AI service error" }
          : typeof raw === "string"
            ? { message: raw }
            : typeof raw === "object" && !Array.isArray(raw)
              ? this.normalizeUpstreamErrorBody(raw as Record<string, unknown>)
              : { message: String(raw) };
      throw new HttpException(body, status);
    }
    const detail = err instanceof Error ? err.message : String(err);
    throw new HttpException(
      { message: "Plant Doctor request failed", detail },
      HttpStatus.BAD_GATEWAY
    );
  }

  private assertImageFile(file: UploadedImageFile | undefined): UploadedImageFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Image file is required (field name: file)");
    }
    const mime = file.mimetype || "";
    if (!mime.startsWith("image/")) {
      throw new BadRequestException("Only image uploads are allowed");
    }
    return file;
  }

  /**
   * Full diagnosis: species (Roboflow) + disease (Groq) + care KB.
   * Proxies POST /diagnose on the Plant Doctor service.
   */
  async diagnosePlant(file: UploadedImageFile | undefined) {
    const f = this.assertImageFile(file);
    const form = new FormData();
    form.append("file", f.buffer, {
      filename: f.originalname || "plant.jpg",
      contentType: f.mimetype || "application/octet-stream",
    });
    try {
      const { data } = await firstValueFrom(
        this.http.post(this.doctorUrl("/diagnose"), form, {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        })
      );
      return data;
    } catch (e: unknown) {
      throw this.mapUpstreamError(e);
    }
  }

  /** Proxies POST /plant-diagnosis (disease-focused) on the Plant Doctor service. */
  async plantDiagnosisQuick(file: UploadedImageFile | undefined) {
    const f = this.assertImageFile(file);
    const form = new FormData();
    form.append("file", f.buffer, {
      filename: f.originalname || "plant.jpg",
      contentType: f.mimetype || "application/octet-stream",
    });
    try {
      const { data } = await firstValueFrom(
        this.http.post(this.doctorUrl("/plant-diagnosis"), form, {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        })
      );
      return data;
    } catch (e: unknown) {
      throw this.mapUpstreamError(e);
    }
  }

  /**
   * Preference-based recommendations via Plant RAG chatbot POST /chat.
   */
  async recommendPlants(userId: string, override?: RecommendOverrideDto) {
    const payload = await this.preferences.buildRecommendPayload(userId, override);
    const message = this.preferences.buildRagRecommendMessage(payload);
    const rag = await this.postRagChat(message);
    const catalog_matches = await this.matchCatalogPlants(rag.response);

    return {
      engine: "plant-rag-chatbot",
      upstream: AppConfig.AI.PLANT_RAG_CHATBOT_BASE_URL,
      preferences: payload,
      message_sent: message,
      response: rag.response,
      sources: rag.sources,
      catalog_matches,
      recommendations: this.extractRecommendationLines(rag.response),
    };
  }

  /** Free-form chat with the same RAG engine (POST /chat). */
  async chatRecommend(body: PlantChatDto) {
    const rag = await this.postRagChat(body.message.trim());
    const includeCatalog = body.include_catalog_matches !== false;
    return {
      engine: "plant-rag-chatbot",
      upstream: AppConfig.AI.PLANT_RAG_CHATBOT_BASE_URL,
      message: body.message,
      response: rag.response,
      sources: rag.sources,
      ...(includeCatalog
        ? { catalog_matches: await this.matchCatalogPlants(rag.response) }
        : {}),
    };
  }

  /** Best-effort numbered/bullet plant lines for mobile list UIs. */
  private extractRecommendationLines(text: string): { rank: number; summary: string }[] {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const picked: { rank: number; summary: string }[] = [];
    for (const line of lines) {
      if (!/^\d+[\).\]]\s+|^[-*•]\s+\*\*/.test(line) && !/^\*\*[^*]+\*\*/.test(line)) {
        continue;
      }
      picked.push({ rank: picked.length + 1, summary: line.replace(/^\d+[\).\]]\s+/, "") });
      if (picked.length >= 20) break;
    }
    if (picked.length === 0 && text.length > 0) {
      return [{ rank: 1, summary: text.slice(0, 500) }];
    }
    return picked;
  }

  async recommendFeedback(logId: string, body: RecommendFeedbackDto) {
    const legacy = this.legacyRecommenderUrl(`/feedback/${encodeURIComponent(logId)}`);
    if (legacy) {
      const payload: Record<string, unknown> = {};
      if (body.helpful !== undefined) payload.helpful = body.helpful;
      if (body.comment !== undefined) payload.comment = body.comment;
      try {
        const { data } = await firstValueFrom(
          this.http.post(legacy, payload, {
            headers: { "Content-Type": "application/json" },
          })
        );
        return { engine: "legacy", ...data };
      } catch (e: unknown) {
        throw this.mapUpstreamError(e);
      }
    }
    return {
      engine: "plant-rag-chatbot",
      accepted: true,
      log_id: logId,
      helpful: body.helpful,
      comment: body.comment,
      note: "Feedback stored locally only; RAG chatbot has no feedback endpoint.",
    };
  }

  async recommenderHealth() {
    const started = Date.now();
    try {
      const rag = await this.postRagChat("Reply with OK if you are healthy.");
      const latency_ms = Date.now() - started;
      return {
        ok: true,
        engine: "plant-rag-chatbot",
        base_url: AppConfig.AI.PLANT_RAG_CHATBOT_BASE_URL,
        latency_ms,
        sample_response: rag.response.slice(0, 120),
      };
    } catch (e: unknown) {
      if (isAxiosLike(e)) {
        return {
          ok: false,
          engine: "plant-rag-chatbot",
          base_url: AppConfig.AI.PLANT_RAG_CHATBOT_BASE_URL,
          error: e.message ?? "upstream error",
        };
      }
      throw e;
    }
  }

  async recommenderSchema() {
    return RECOMMENDER_INPUT_SCHEMA;
  }

  async plantDoctorRoot() {
    try {
      const { data } = await firstValueFrom(
        this.http.get(this.doctorUrl("/"))
      );
      return data;
    } catch (e: unknown) {
      throw this.mapUpstreamError(e);
    }
  }
}
