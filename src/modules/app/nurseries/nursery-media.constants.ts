import { BadRequestException } from "@nestjs/common";

export const MAX_NURSERY_GALLERY_IMAGES = 10;
export const MAX_NURSERY_UPLOAD_BYTES = Number(
  process.env.MEDIA_NURSERY_MAX_BYTES ?? process.env.MEDIA_MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024
);

export type NurseryMediaSlot = "cover" | "profile" | "logo" | "gallery";

export type UploadFileMeta = { buffer: Buffer; mimetype: string; size: number };

export type NurseryUploadedFiles = {
  cover_image?: UploadFileMeta[];
  profile_picture?: UploadFileMeta[];
  logo?: UploadFileMeta[];
  gallery_images?: UploadFileMeta[];
};

export const nurseryImageMulter = {
  limits: { fileSize: MAX_NURSERY_UPLOAD_BYTES },
  fileFilter: (
    _req: Express.Request,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void
  ) => {
    const mime = (file.mimetype || "").toLowerCase();
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mime)) {
      return cb(new BadRequestException("Nursery images must be JPEG, PNG, or WebP"), false);
    }
    cb(null, true);
  },
};

export const NURSERY_CREATE_FILE_FIELDS = [
  { name: "cover_image", maxCount: 1 },
  { name: "profile_picture", maxCount: 1 },
  { name: "logo", maxCount: 1 },
  { name: "gallery_images", maxCount: MAX_NURSERY_GALLERY_IMAGES },
] as const;

export const NURSERY_MEDIA_PATCH_FIELDS = [
  { name: "cover_image", maxCount: 1 },
  { name: "profile_picture", maxCount: 1 },
  { name: "logo", maxCount: 1 },
  { name: "gallery_images", maxCount: MAX_NURSERY_GALLERY_IMAGES },
] as const;
