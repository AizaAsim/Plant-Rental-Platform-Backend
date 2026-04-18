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
import { PreferencesService } from "../preferences/preferences.service";
import { RecommendFeedbackDto } from "./dto/recommend-feedback.dto";
import { RecommendOverrideDto } from "../preferences/dto/recommend-override.dto";

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

@Injectable()
export class AiService {
  constructor(
    private readonly http: HttpService,
    private readonly preferences: PreferencesService
  ) {}

  private doctorUrl(path: string): string {
    return `${AppConfig.AI.PLANT_DOCTOR_BASE_URL}${path}`;
  }

  private recommenderUrl(path: string): string {
    return `${AppConfig.AI.PLANT_RECOMMENDER_BASE_URL}${path}`;
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

  async recommendPlants(userId: string, override?: RecommendOverrideDto) {
    const payload = await this.preferences.buildRecommendPayload(userId, override);
    try {
      const { data } = await firstValueFrom(
        this.http.post(this.recommenderUrl("/recommend"), payload, {
          headers: { "Content-Type": "application/json" },
        })
      );
      return data;
    } catch (e: unknown) {
      throw this.mapUpstreamError(e);
    }
  }

  async recommendFeedback(logId: string, body: RecommendFeedbackDto) {
    const id = encodeURIComponent(logId);
    const payload: Record<string, unknown> = {};
    if (body.helpful !== undefined) {
      payload.helpful = body.helpful;
    }
    if (body.comment !== undefined) {
      payload.comment = body.comment;
    }
    try {
      const { data } = await firstValueFrom(
        this.http.post(this.recommenderUrl(`/feedback/${id}`), payload, {
          headers: { "Content-Type": "application/json" },
        })
      );
      return data;
    } catch (e: unknown) {
      throw this.mapUpstreamError(e);
    }
  }

  async recommenderHealth() {
    try {
      const { data } = await firstValueFrom(
        this.http.get(this.recommenderUrl("/health"))
      );
      return data;
    } catch (e: unknown) {
      throw this.mapUpstreamError(e);
    }
  }

  async recommenderSchema() {
    try {
      const { data } = await firstValueFrom(
        this.http.get(this.recommenderUrl("/schema"))
      );
      return data;
    } catch (e: unknown) {
      throw this.mapUpstreamError(e);
    }
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
