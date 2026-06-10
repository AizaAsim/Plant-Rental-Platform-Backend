import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AppConfig from "src/configs/app.config";

const ALLOWED_ROOT_FOLDERS = new Set(["plants", "nurseries", "profiles", "tasks", "diagnoses"]);
const NURSERY_SUBFOLDERS = new Set(["logos", "covers", "gallery"]);
const NURSERY_MEDIA_SLOTS = new Set(["cover", "profile", "logo", "gallery"]);
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);
const NURSERY_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);
const MAX_UPLOAD_BYTES = Number(process.env.MEDIA_MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);
const MAX_NURSERY_UPLOAD_BYTES = Number(process.env.MEDIA_NURSERY_MAX_BYTES ?? MAX_UPLOAD_BYTES);

@Injectable()
export class MediaService {
  private uploadRoot: string;
  private s3: S3Client | null = null;
  private bucket: string | null;

  constructor(private config: ConfigService) {
    this.uploadRoot = path.join(process.cwd(), "uploads");
    const bucket = AppConfig.AWS.BUCKET;
    this.bucket = bucket || null;
    if (this.bucket && AppConfig.AWS.ACCESS_KEY && AppConfig.AWS.SECRET_KEY) {
      this.s3 = new S3Client({
        region: AppConfig.AWS.REGION,
        credentials: {
          accessKeyId: AppConfig.AWS.ACCESS_KEY,
          secretAccessKey: AppConfig.AWS.SECRET_KEY,
        },
      });
    }
  }

  private publicBase(): string {
    return (
      this.config.get<string>("APP_PUBLIC_BASE_URL") ||
      process.env.APP_PUBLIC_BASE_URL ||
      `http://localhost:${AppConfig.APP.PORT || 3000}`
    );
  }

  private normalizeFolder(folder?: string) {
    return (folder || "profiles").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }

  private assertFolder(folder?: string) {
    const f = this.normalizeFolder(folder);
    const root = f.split("/")[0];
    if (!ALLOWED_ROOT_FOLDERS.has(root)) {
      throw new BadRequestException(
        `Invalid folder. Allowed roots: ${[...ALLOWED_ROOT_FOLDERS].join(", ")} ` +
          `(nursery uploads: nurseries/logos, nurseries/covers, nurseries/gallery)`
      );
    }
    if (root === "nurseries" && f.includes("/")) {
      const sub = f.split("/")[1];
      if (!NURSERY_SUBFOLDERS.has(sub)) {
        throw new BadRequestException(
          `Invalid nursery subfolder "${sub}". Use nurseries/logos, nurseries/covers, or nurseries/gallery`
        );
      }
    }
    return f;
  }

  private assertImage(mimetype: string, folder?: string) {
    const m = (mimetype || "").toLowerCase();
    const root = this.normalizeFolder(folder).split("/")[0];
    const allowed = root === "nurseries" ? NURSERY_IMAGE_MIMES : IMAGE_MIMES;
    if (!allowed.has(m)) {
      throw new BadRequestException(
        root === "nurseries"
          ? "Nursery images must be JPEG, PNG, or WebP"
          : "Only image uploads are allowed for this endpoint"
      );
    }
  }

  private assertFileSize(size: number, folder?: string) {
    const root = this.normalizeFolder(folder).split("/")[0];
    const max = root === "nurseries" ? MAX_NURSERY_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
    if (size > max) {
      throw new BadRequestException(`File exceeds maximum size of ${Math.round(max / (1024 * 1024))}MB`);
    }
  }

  private parseResize(resize?: string) {
    if (!resize?.trim()) return undefined;
    if (!/^\d{2,4}x\d{2,4}$/.test(resize.trim())) {
      throw new BadRequestException('resize must be like "512x512" or "1600x900"');
    }
    return resize.trim();
  }

  private buildUploadResponse(
    key: string,
    size: number,
    mimetype: string,
    storage: "local" | "s3",
    absoluteUrl: string,
    resize?: string
  ) {
    const path = `/uploads/${key}`;
    return {
      url: absoluteUrl,
      path,
      key,
      size,
      mime_type: mimetype,
      storage,
      ...(resize ? { resize_requested: resize } : {}),
    };
  }

  private async ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
  }

  private extFromMime(mime: string) {
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("gif")) return "gif";
    return "jpg";
  }

  async uploadFile(
    _userId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    folder?: string,
    resize?: string
  ) {
    if (!file) throw new BadRequestException("file is required");
    const f = this.assertFolder(folder);
    this.assertImage(file.mimetype, f);
    this.assertFileSize(file.size, f);
    const resizeHint = this.parseResize(resize);
    const key = `${f}/${Date.now()}-${randomUUID()}.${this.extFromMime(file.mimetype)}`;

    if (this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
      const base =
        AppConfig.AWS.BUCKET_BASE_URL || `https://${this.bucket}.s3.${AppConfig.AWS.REGION}.amazonaws.com`;
      const url = `${base.replace(/\/$/, "")}/${key}`;
      return this.buildUploadResponse(key, file.size, file.mimetype, "s3", url, resizeHint);
    }

    const dir = path.join(this.uploadRoot, f);
    await this.ensureDir(dir);
    const diskPath = path.join(this.uploadRoot, key);
    await fs.writeFile(diskPath, file.buffer);
    const pathUrl = `/uploads/${key}`;
    const absolute = `${this.publicBase().replace(/\/$/, "")}${pathUrl}`;
    return this.buildUploadResponse(key, file.size, file.mimetype, "local", absolute, resizeHint);
  }

  async uploadMultiple(
    _userId: string,
    files: { buffer: Buffer; mimetype: string; size: number }[],
    folder?: string,
    resize?: string
  ) {
    if (!files?.length) throw new BadRequestException("files are required");
    const results = [];
    for (const file of files) {
      results.push(await this.uploadFile(_userId, file, folder, resize));
    }
    return results;
  }

  /** Storage key: nurseries/{nurseryId}/{slot}/{timestamp-uuid}.ext */
  async uploadNurseryImage(
    nurseryId: string,
    slot: string,
    file: { buffer: Buffer; mimetype: string; size: number }
  ) {
    if (!file?.buffer?.length) throw new BadRequestException(`${slot} file is required`);
    const normalizedSlot = slot.trim().toLowerCase();
    if (!NURSERY_MEDIA_SLOTS.has(normalizedSlot)) {
      throw new BadRequestException(`Invalid nursery media slot "${slot}"`);
    }
    this.assertImage(file.mimetype, "nurseries");
    this.assertFileSize(file.size, "nurseries");
    const key = `nurseries/${nurseryId}/${normalizedSlot}/${Date.now()}-${randomUUID()}.${this.extFromMime(file.mimetype)}`;
    return this.persistUpload(key, file);
  }

  private async persistUpload(
    key: string,
    file: { buffer: Buffer; mimetype: string; size: number },
    resizeHint?: string
  ) {
    if (this.s3 && this.bucket) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );
      const base =
        AppConfig.AWS.BUCKET_BASE_URL || `https://${this.bucket}.s3.${AppConfig.AWS.REGION}.amazonaws.com`;
      const url = `${base.replace(/\/$/, "")}/${key}`;
      return this.buildUploadResponse(key, file.size, file.mimetype, "s3", url, resizeHint);
    }

    const dir = path.join(this.uploadRoot, path.dirname(key));
    await this.ensureDir(dir);
    const diskPath = path.join(this.uploadRoot, key);
    await fs.writeFile(diskPath, file.buffer);
    const pathUrl = `/uploads/${key}`;
    const absolute = `${this.publicBase().replace(/\/$/, "")}${pathUrl}`;
    return this.buildUploadResponse(key, file.size, file.mimetype, "local", absolute, resizeHint);
  }

  extractStorageKey(storedUrl: string | null | undefined): string | null {
    if (!storedUrl?.trim()) return null;
    const value = storedUrl.trim();
    const uploadsIdx = value.indexOf("/uploads/");
    if (uploadsIdx >= 0) {
      return value.slice(uploadsIdx + "/uploads/".length).split("?")[0];
    }
    const match = value.match(/nurseries\/[a-f0-9-]{36}\/(cover|profile|logo|gallery)\/[^?#]+/i);
    return match ? match[0] : null;
  }

  /** Delete a stored nursery (or other) asset by public URL or /uploads path. */
  async deleteStoredAsset(storedUrl: string | null | undefined): Promise<void> {
    const key = this.extractStorageKey(storedUrl);
    if (!key) return;

    if (this.s3 && this.bucket) {
      try {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      } catch {
        /* best-effort cleanup */
      }
      return;
    }

    const diskPath = this.resolveLocalKey(key);
    try {
      await fs.unlink(diskPath);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code !== "ENOENT") throw e;
    }
  }

  async presignedUpload(_userId: string, body: { filename: string; content_type: string; folder: string }) {
    const f = this.assertFolder(body.folder);
    this.assertImage(body.content_type, f);
    const safeName = path.basename(body.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${f}/${Date.now()}-${randomUUID()}-${safeName}`;

    if (this.s3 && this.bucket) {
      const cmd = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: body.content_type,
      });
      const upload_url = await getSignedUrl(this.s3, cmd, { expiresIn: 3600 });
      const base = (AppConfig.AWS.BUCKET_BASE_URL || "").replace(/\/$/, "");
      const file_url = base
        ? `${base}/${key}`
        : `https://${this.bucket}.s3.${AppConfig.AWS.REGION}.amazonaws.com/${key}`;
      return { upload_url, file_url, expires_in: 3600, key, storage: "s3" };
    }

    const mockUrl = `${this.publicBase().replace(/\/$/, "")}/uploads/${key}`;
    return {
      upload_url: mockUrl,
      file_url: mockUrl,
      expires_in: 3600,
      key,
      storage: "mock",
      message:
        "S3 not configured: returned placeholder URLs. Use multipart POST /api/v1/media/upload for local storage.",
    };
  }

  /** Resolve key to path under upload root; reject path traversal. */
  private resolveLocalKey(key: string) {
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const full = path.join(this.uploadRoot, normalized);
    const root = path.resolve(this.uploadRoot);
    if (!full.startsWith(root)) {
      throw new ForbiddenException("Invalid key");
    }
    return full;
  }

  async deleteMedia(requesterId: string, requesterRole: UserRole, key: string) {
    if (!key) throw new BadRequestException("key is required");
    if (requesterRole !== UserRole.ADMIN) {
      if (!key.startsWith("profiles/")) {
        throw new ForbiddenException("Only profile uploads can be self-deleted, or use admin");
      }
    }

    if (this.s3 && this.bucket) {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return { success: true, storage: "s3" };
    }

    const diskPath = this.resolveLocalKey(key);
    try {
      await fs.unlink(diskPath);
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e;
    }
    return { success: true, storage: "local" };
  }
}
