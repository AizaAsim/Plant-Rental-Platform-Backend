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

const ALLOWED_FOLDERS = new Set(["plants", "nurseries", "profiles", "tasks", "diagnoses"]);
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

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

  private assertFolder(folder?: string) {
    const f = folder || "profiles";
    if (!ALLOWED_FOLDERS.has(f)) {
      throw new BadRequestException(`Invalid folder. Allowed: ${[...ALLOWED_FOLDERS].join(", ")}`);
    }
    return f;
  }

  private assertImage(mimetype: string) {
    const m = (mimetype || "").toLowerCase();
    if (!IMAGE_MIMES.has(m)) {
      throw new BadRequestException("Only image uploads are allowed for this endpoint");
    }
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
    _resize?: string
  ) {
    if (!file) throw new BadRequestException("file is required");
    this.assertImage(file.mimetype);
    const f = this.assertFolder(folder);
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
      return {
        url,
        key,
        size: file.size,
        mime_type: file.mimetype,
        storage: "s3",
      };
    }

    const dir = path.join(this.uploadRoot, f);
    await this.ensureDir(dir);
    const diskPath = path.join(this.uploadRoot, key);
    await fs.writeFile(diskPath, file.buffer);
    const url = `${this.publicBase().replace(/\/$/, "")}/uploads/${key}`;
    return {
      url,
      key,
      size: file.size,
      mime_type: file.mimetype,
      storage: "local",
    };
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

  async presignedUpload(_userId: string, body: { filename: string; content_type: string; folder: string }) {
    this.assertImage(body.content_type);
    const f = this.assertFolder(body.folder);
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
