// src/modules/app/nurseries/nurseries.service.ts
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import * as bcrypt from "bcrypt";
import { UserRole, OrderStatus, ReviewableType } from "@prisma/client";
import { contractOk, contractFail } from "src/common/contract/response";
import { ContractErrorCode } from "src/common/contract/error-codes";
import { NurseryFilterDto } from "./dto/nursery-filter.dto";
import {
  UpdateInventoryDto,
  BulkUpdateInventoryDto,
} from "./dto/inventory.dto";
import { CreateNurseryDto } from "./dto/create-nursery.dto";
import { UpdateWorkingHoursDto } from "./dto/working-hours.dto";
import { UpdateServiceAreasDto } from "./dto/service-areas.dto";
import { ReorderNurseryGalleryDto } from "./dto/nursery-media.dto";
import { UpdateNurseryDto } from "./dto/update-nursery.dto";
import { Prisma, PrismaPromise } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";
import { MediaService } from "../media/media.service";
import { toPublicNursery, toNurseryMediaResponse } from "./nursery.mapper";
import {
  MAX_NURSERY_GALLERY_IMAGES,
  NurseryUploadedFiles,
  UploadFileMeta,
} from "./nursery-media.constants";

const publicNurseryInclude = {
  images: { orderBy: { displayOrder: "asc" as const } },
} satisfies Prisma.NurseryInclude;

@Injectable()
export class NurseriesService {
  private readonly log = new Logger(NurseriesService.name);

  constructor(
    private prisma: PrismaService,
    private media: MediaService
  ) {}

  /** Surface Prisma schema drift (missing migration) instead of a generic 500. */
  private rethrowNurseryDbError(err: unknown, context: string): never {
    if (err instanceof PrismaClientKnownRequestError) {
      if (err.code === "P2021" || err.code === "P2022" || err.code === "P2010") {
        this.log.error(`Nursery DB schema drift in ${context}: ${err.message}`);
        throw new HttpException(
          {
            success: false,
            error: {
              code: "SERVICE_UNAVAILABLE",
              message:
                "Nursery catalogue is unavailable — run prisma migrate deploy on the server",
            },
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
    }
    throw err;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.nursery.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing || existing.id === excludeId) return slug;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  // ─── Create Nursery ─────────────────────────────────────────────────────────

  private async getVendorNurseryOrThrow(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    return nursery;
  }

  private nurseryIncludeWithImages = {
    images: { orderBy: { displayOrder: "asc" as const } },
  };

  private async loadNurseryMedia(nurseryId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { id: nurseryId },
      include: this.nurseryIncludeWithImages,
    });
    if (!nursery) throw new NotFoundException("Nursery not found");
    return toNurseryMediaResponse(nursery);
  }

  private async cleanupUploadedKeys(keys: string[]) {
    for (const key of keys) {
      await this.media.deleteStoredAsset(`/uploads/${key}`);
    }
  }

  private async uploadNurseryFiles(
    nurseryId: string,
    files: Partial<Record<"cover" | "profile" | "logo" | "gallery", UploadFileMeta[]>>
  ) {
    const uploadedKeys: string[] = [];
    const result: {
      coverUrl?: string;
      profileUrl?: string;
      logoUrl?: string;
      galleryUrls: string[];
    } = { galleryUrls: [] };

    try {
      if (files.cover?.length) {
        const { url, key } = await this.media.uploadNurseryImage(nurseryId, "cover", files.cover[0]);
        uploadedKeys.push(key);
        result.coverUrl = url;
      }
      if (files.profile?.length) {
        const { url, key } = await this.media.uploadNurseryImage(nurseryId, "profile", files.profile[0]);
        uploadedKeys.push(key);
        result.profileUrl = url;
      }
      if (files.logo?.length) {
        const { url, key } = await this.media.uploadNurseryImage(nurseryId, "logo", files.logo[0]);
        uploadedKeys.push(key);
        result.logoUrl = url;
      }
      if (files.gallery?.length) {
        for (const file of files.gallery) {
          const { url, key } = await this.media.uploadNurseryImage(nurseryId, "gallery", file);
          uploadedKeys.push(key);
          result.galleryUrls.push(url);
        }
      }
      return { ...result, uploadedKeys };
    } catch (error) {
      await this.cleanupUploadedKeys(uploadedKeys);
      throw error;
    }
  }

  async createNursery(
    vendorId: string,
    createDto: CreateNurseryDto,
    uploadedFiles: NurseryUploadedFiles
  ) {
    const existingNursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (existingNursery) throw new ConflictException("Vendor already has a nursery");

    const coverFile = uploadedFiles.cover_image?.[0];
    const profileFile = uploadedFiles.profile_picture?.[0];
    if (!coverFile) throw new BadRequestException("cover_image is required");
    if (!profileFile) throw new BadRequestException("profile_picture is required");

    const galleryFiles = uploadedFiles.gallery_images ?? [];
    if (galleryFiles.length > MAX_NURSERY_GALLERY_IMAGES) {
      throw new BadRequestException(`Gallery limit is ${MAX_NURSERY_GALLERY_IMAGES} images`);
    }

    const slug = await this.ensureUniqueSlug(this.generateSlug(createDto.name));

    const nursery = await this.prisma.nursery.create({
      data: {
        vendorId,
        name: createDto.name,
        slug,
        description: createDto.description,
        addressLine1: createDto.address_line1,
        addressLine2: createDto.address_line2,
        city: createDto.city,
        state: createDto.state,
        pincode: createDto.pincode,
        latitude: createDto.latitude != null ? new Decimal(createDto.latitude) : null,
        longitude: createDto.longitude != null ? new Decimal(createDto.longitude) : null,
        serviceRadiusKm: createDto.service_radius_km || 10,
        phone: createDto.phone,
        email: createDto.email,
        isVerified: false,
      },
    });

    let uploadedKeys: string[] = [];
    try {
      const uploads = await this.uploadNurseryFiles(nursery.id, {
        cover: [coverFile],
        profile: [profileFile],
        logo: uploadedFiles.logo,
        gallery: galleryFiles,
      });
      uploadedKeys = uploads.uploadedKeys;

      await this.prisma.$transaction(async (tx) => {
        await tx.nursery.update({
          where: { id: nursery.id },
          data: {
            coverImageUrl: uploads.coverUrl,
            profilePictureUrl: uploads.profileUrl,
            logoUrl: uploads.logoUrl ?? null,
          },
        });
        if (uploads.galleryUrls.length) {
          await tx.nurseryImage.createMany({
            data: uploads.galleryUrls.map((imageUrl, index) => ({
              nurseryId: nursery.id,
              imageUrl,
              displayOrder: index,
            })),
          });
        }
      });
    } catch (error) {
      await this.cleanupUploadedKeys(uploadedKeys);
      await this.prisma.nursery.delete({ where: { id: nursery.id } }).catch(() => undefined);
      throw error;
    }

    return this.loadNurseryMedia(nursery.id);
  }

  private buildNurseryOrderBy(
    sortBy: string,
    sortOrder: "asc" | "desc"
  ): Prisma.NurseryOrderByWithRelationInput | Prisma.NurseryOrderByWithRelationInput[] {
    const dir = sortOrder;
    switch (sortBy) {
      case "name":
        return { name: dir };
      case "distance":
        // Distance is computed in memory after fetch; DB order is a stable fallback.
        return dir === "desc"
          ? [{ ratingAvg: "desc" }, { totalReviews: "desc" }]
          : [{ ratingAvg: "asc" }, { totalReviews: "asc" }];
      case "rating":
      default:
        return dir === "desc"
          ? [{ ratingAvg: "desc" }, { totalReviews: "desc" }]
          : [{ ratingAvg: "asc" }, { totalReviews: "asc" }];
    }
  }

  // ─── Browse All Nurseries ───────────────────────────────────────────────────

  async findAllNurseries(filterDto: any) {
    const {
      page = 1, limit = 20, city, state, pincode,
      latitude, longitude, radius_km, rating_min, is_verified, sort_by = "rating",
      sort_order,
    } = filterDto;

    const parsedPage = Number(page);
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const parsedRatingMin = rating_min ? Number(rating_min) : undefined;
    const parsedLatitude = latitude ? Number(latitude) : undefined;
    const parsedLongitude = longitude ? Number(longitude) : undefined;
    const parsedRadiusKm = radius_km ? Number(radius_km) : undefined;
    const parsedIsVerified =
      is_verified === "true" ? true : is_verified === "false" ? false : undefined;
    const parsedSortOrder: "asc" | "desc" =
      String(sort_order ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const where: Prisma.NurseryWhereInput = {
      isActive: true,
      ...(parsedIsVerified !== undefined && { isVerified: parsedIsVerified }),
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(state && { state: { contains: state, mode: "insensitive" } }),
      ...(pincode && {
        OR: [
          { pincode: { contains: pincode } },
          { serviceAreas: { some: { pincode: { contains: pincode } } } },
        ],
      }),
      ...(parsedRatingMin !== undefined && {
        ratingAvg: { gte: new Decimal(parsedRatingMin) },
      }),
    };

    const orderBy = this.buildNurseryOrderBy(String(sort_by), parsedSortOrder);

    const skip = (parsedPage - 1) * parsedLimit;
    try {
      const [nurseries, total] = await Promise.all([
        this.prisma.nursery.findMany({
          where,
          orderBy,
          skip,
          take: parsedLimit,
          include: publicNurseryInclude,
        }),
        this.prisma.nursery.count({ where }),
      ]);

      let result = nurseries
        .map((nursery) => {
          let distance: number | undefined;
          if (parsedLatitude && parsedLongitude && nursery.latitude && nursery.longitude) {
            distance = this.calculateDistance(
              parsedLatitude, parsedLongitude,
              Number(nursery.latitude), Number(nursery.longitude)
            );
            if (parsedRadiusKm && distance > parsedRadiusKm) return null;
          }
          return toPublicNursery(nursery, distance != null ? { distance } : undefined);
        })
        .filter((row): row is NonNullable<typeof row> => row != null);

      if (sort_by === "distance" && parsedLatitude && parsedLongitude) {
        result.sort((a, b) =>
          a.distance == null ? 1 : b.distance == null ? -1 : a.distance - b.distance
        );
        if (parsedSortOrder === "desc") {
          result.reverse();
        }
      }

      return {
        items: result,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages: Math.ceil(total / parsedLimit),
        },
      };
    } catch (err) {
      this.rethrowNurseryDbError(err, "findAllNurseries");
    }
  }

  /** Top-rated active nurseries — used by customer home "Top Nurseries". */
  async findTopRated(limit = 5, isVerified = true) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
    try {
      const nurseries = await this.prisma.nursery.findMany({
        where: {
          isActive: true,
          ...(isVerified && { isVerified: true }),
        },
        orderBy: [{ ratingAvg: "desc" }, { totalReviews: "desc" }],
        take: parsedLimit,
        include: publicNurseryInclude,
      });
      return { items: nurseries.map((n) => toPublicNursery(n)) };
    } catch (err) {
      this.rethrowNurseryDbError(err, "findTopRated");
    }
  }

  // ─── Find by ID ─────────────────────────────────────────────────────────────

  private async loadPublicNurseryDetail(idOrSlug: string) {
    let nursery;
    try {
      nursery = await this.prisma.nursery.findFirst({
        where: {
          isActive: true,
          OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        },
        include: {
          ...publicNurseryInclude,
          workingHours: { orderBy: { dayOfWeek: "asc" } },
          serviceAreas: true,
          _count: { select: { plants: true, orders: true, gardeners: true } },
        },
      });
    } catch (err) {
      this.rethrowNurseryDbError(err, "loadPublicNurseryDetail");
    }
    if (!nursery) throw new NotFoundException("Nursery not found");
    const publicCore = toPublicNursery(nursery);
    return {
      ...publicCore,
      slug: nursery.slug,
      addressLine1: nursery.addressLine1,
      addressLine2: nursery.addressLine2,
      city: nursery.city,
      state: nursery.state,
      pincode: nursery.pincode,
      latitude: nursery.latitude != null ? Number(nursery.latitude) : null,
      longitude: nursery.longitude != null ? Number(nursery.longitude) : null,
      serviceRadiusKm: nursery.serviceRadiusKm,
      phone: nursery.phone,
      email: nursery.email,
      isVerified: nursery.isVerified,
      workingHours: nursery.workingHours,
      serviceAreas: nursery.serviceAreas,
      _count: nursery._count,
    };
  }

  async findById(idOrSlug: string) {
    return this.loadPublicNurseryDetail(idOrSlug);
  }

  // ─── Find by Slug ───────────────────────────────────────────────────────────

  async findBySlug(slug: string) {
    return this.loadPublicNurseryDetail(slug);
  }

  // ─── Get My Nursery ─────────────────────────────────────────────────────────

  async getMyNursery(vendorId: string) {
    let nursery;
    try {
      nursery = await this.prisma.nursery.findUnique({
        where: { vendorId },
        include: {
          workingHours: { orderBy: { dayOfWeek: "asc" } },
          images: { orderBy: { displayOrder: "asc" } },
          serviceAreas: true,
          plants: { take: 10, orderBy: { createdAt: "desc" } },
          gardeners: {
            include: { user: { select: { id: true, fullName: true, phone: true } } },
          },
          _count: { select: { plants: true, orders: true, gardeners: true } },
        },
      });
    } catch (err) {
      this.rethrowNurseryDbError(err, "getMyNursery");
    }
    if (!nursery) throw new NotFoundException("Nursery not found");
    const analytics = await this.getNurseryAnalytics(nursery.id);
    return { ...nursery, analytics };
  }

  // ─── Update My Nursery ──────────────────────────────────────────────────────

  async updateMyNursery(vendorId: string, updateDto: UpdateNurseryDto) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const updateData: Prisma.NurseryUpdateInput = {};
    if (updateDto.name !== undefined) {
      updateData.name = updateDto.name;
      updateData.slug = await this.ensureUniqueSlug(this.generateSlug(updateDto.name), nursery.id);
    }
    if (updateDto.description !== undefined) updateData.description = updateDto.description;
    if (updateDto.address_line1 !== undefined) updateData.addressLine1 = updateDto.address_line1;
    if (updateDto.address_line2 !== undefined) updateData.addressLine2 = updateDto.address_line2;
    if (updateDto.city !== undefined) updateData.city = updateDto.city;
    if (updateDto.state !== undefined) updateData.state = updateDto.state;
    if (updateDto.pincode !== undefined) updateData.pincode = updateDto.pincode;
    if (updateDto.latitude !== undefined) updateData.latitude = new Decimal(updateDto.latitude);
    if (updateDto.longitude !== undefined) updateData.longitude = new Decimal(updateDto.longitude);
    if (updateDto.service_radius_km !== undefined) updateData.serviceRadiusKm = updateDto.service_radius_km;
    if (updateDto.phone !== undefined) updateData.phone = updateDto.phone;
    if (updateDto.email !== undefined) updateData.email = updateDto.email;

    return this.prisma.nursery.update({
      where: { id: nursery.id },
      data: updateData,
      include: { workingHours: true, images: true, serviceAreas: true },
    });
  }

  // ─── Nursery media (multipart) ──────────────────────────────────────────────

  async patchNurseryMedia(vendorId: string, uploadedFiles: NurseryUploadedFiles) {
    const nursery = await this.getVendorNurseryOrThrow(vendorId);
    const coverFile = uploadedFiles.cover_image?.[0];
    const profileFile = uploadedFiles.profile_picture?.[0];
    const logoFile = uploadedFiles.logo?.[0];
    const galleryFiles = uploadedFiles.gallery_images ?? [];

    if (!coverFile && !profileFile && !logoFile && !galleryFiles.length) {
      throw new BadRequestException("Provide at least one media file to update");
    }

    if (galleryFiles.length) {
      const existing = await this.prisma.nurseryImage.count({ where: { nurseryId: nursery.id } });
      if (existing + galleryFiles.length > MAX_NURSERY_GALLERY_IMAGES) {
        throw new BadRequestException(
          `Gallery limit is ${MAX_NURSERY_GALLERY_IMAGES} images (currently ${existing}, tried to add ${galleryFiles.length})`
        );
      }
    }

    const oldAssets: string[] = [];
    if (coverFile && nursery.coverImageUrl) oldAssets.push(nursery.coverImageUrl);
    if (profileFile && nursery.profilePictureUrl) oldAssets.push(nursery.profilePictureUrl);
    if (logoFile && nursery.logoUrl) oldAssets.push(nursery.logoUrl);

    const uploads = await this.uploadNurseryFiles(nursery.id, {
      cover: coverFile ? [coverFile] : undefined,
      profile: profileFile ? [profileFile] : undefined,
      logo: logoFile ? [logoFile] : undefined,
      gallery: galleryFiles.length ? galleryFiles : undefined,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        const nurseryUpdate: Prisma.NurseryUpdateInput = {};
        if (uploads.coverUrl) nurseryUpdate.coverImageUrl = uploads.coverUrl;
        if (uploads.profileUrl) nurseryUpdate.profilePictureUrl = uploads.profileUrl;
        if (uploads.logoUrl) nurseryUpdate.logoUrl = uploads.logoUrl;

        if (Object.keys(nurseryUpdate).length) {
          await tx.nursery.update({ where: { id: nursery.id }, data: nurseryUpdate });
        }

        if (uploads.galleryUrls.length) {
          const last = await tx.nurseryImage.findFirst({
            where: { nurseryId: nursery.id },
            orderBy: { displayOrder: "desc" },
            select: { displayOrder: true },
          });
          const baseOrder = (last?.displayOrder ?? -1) + 1;
          await tx.nurseryImage.createMany({
            data: uploads.galleryUrls.map((imageUrl, index) => ({
              nurseryId: nursery.id,
              imageUrl,
              displayOrder: baseOrder + index,
            })),
          });
        }
      });
    } catch (error) {
      await this.cleanupUploadedKeys(uploads.uploadedKeys);
      throw error;
    }

    for (const asset of oldAssets) {
      await this.media.deleteStoredAsset(asset);
    }

    return this.loadNurseryMedia(nursery.id);
  }

  async deleteNurseryLogo(vendorId: string) {
    const nursery = await this.getVendorNurseryOrThrow(vendorId);
    if (!nursery.logoUrl) {
      return this.loadNurseryMedia(nursery.id);
    }

    const previousLogo = nursery.logoUrl;
    await this.prisma.nursery.update({
      where: { id: nursery.id },
      data: { logoUrl: null },
    });
    await this.media.deleteStoredAsset(previousLogo);
    return this.loadNurseryMedia(nursery.id);
  }

  async addGalleryImages(vendorId: string, files: UploadFileMeta[]) {
    if (!files.length) throw new BadRequestException("gallery_images is required");
    const nursery = await this.getVendorNurseryOrThrow(vendorId);

    const existing = await this.prisma.nurseryImage.count({ where: { nurseryId: nursery.id } });
    if (existing + files.length > MAX_NURSERY_GALLERY_IMAGES) {
      throw new BadRequestException(
        `Gallery limit is ${MAX_NURSERY_GALLERY_IMAGES} images (currently ${existing}, tried to add ${files.length})`
      );
    }

    const uploads = await this.uploadNurseryFiles(nursery.id, { gallery: files });

    try {
      await this.prisma.$transaction(async (tx) => {
        const last = await tx.nurseryImage.findFirst({
          where: { nurseryId: nursery.id },
          orderBy: { displayOrder: "desc" },
          select: { displayOrder: true },
        });
        const baseOrder = (last?.displayOrder ?? -1) + 1;
        await tx.nurseryImage.createMany({
          data: uploads.galleryUrls.map((imageUrl, index) => ({
            nurseryId: nursery.id,
            imageUrl,
            displayOrder: baseOrder + index,
          })),
        });
      });
    } catch (error) {
      await this.cleanupUploadedKeys(uploads.uploadedKeys);
      throw error;
    }

    return this.loadNurseryMedia(nursery.id);
  }

  async deleteGalleryImage(vendorId: string, imageId: string) {
    const nursery = await this.getVendorNurseryOrThrow(vendorId);
    const image = await this.prisma.nurseryImage.findFirst({
      where: { id: imageId, nurseryId: nursery.id },
    });
    if (!image) throw new NotFoundException("Image not found");

    await this.prisma.nurseryImage.delete({ where: { id: imageId } });
    await this.media.deleteStoredAsset(image.imageUrl);
    return this.loadNurseryMedia(nursery.id);
  }

  async reorderGalleryImages(vendorId: string, dto: ReorderNurseryGalleryDto) {
    const nursery = await this.getVendorNurseryOrThrow(vendorId);
    const ids = dto.images.map((item) => item.image_id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new BadRequestException("image_id values must be unique");
    }

    const existing = await this.prisma.nurseryImage.findMany({
      where: { nurseryId: nursery.id },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      throw new BadRequestException("images must include every gallery image for this nursery");
    }
    const existingIds = new Set(existing.map((img) => img.id));
    for (const id of ids) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(`Gallery image not found: ${id}`);
      }
    }

    await this.prisma.$transaction(
      dto.images.map((item) =>
        this.prisma.nurseryImage.update({
          where: { id: item.image_id },
          data: { displayOrder: item.display_order },
        })
      )
    );

    return this.loadNurseryMedia(nursery.id);
  }

  // ─── Working Hours ──────────────────────────────────────────────────────────

  async updateWorkingHours(vendorId: string, updateDto: UpdateWorkingHoursDto) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    await this.prisma.nurseryWorkingHours.deleteMany({ where: { nurseryId: nursery.id } });
    return Promise.all(
      updateDto.working_hours.map((wh) =>
        this.prisma.nurseryWorkingHours.create({
          data: {
            nurseryId: nursery.id,
            dayOfWeek: wh.day_of_week,
            openTime: wh.open_time,
            closeTime: wh.close_time,
            isClosed: wh.is_closed || false,
          },
        })
      )
    );
  }

  async getWorkingHours(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    return this.prisma.nurseryWorkingHours.findMany({
      where: { nurseryId: nursery.id },
      orderBy: { dayOfWeek: "asc" },
    });
  }

  // ─── Service Areas ──────────────────────────────────────────────────────────

  async updateServiceAreas(vendorId: string, updateDto: UpdateServiceAreasDto) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    await this.prisma.nurseryServiceArea.deleteMany({ where: { nurseryId: nursery.id } });

    const ops: Promise<any>[] = [];
    if (updateDto.pincodes?.length) {
      for (const pincode of updateDto.pincodes) {
        ops.push(this.prisma.nurseryServiceArea.create({ data: { nurseryId: nursery.id, pincode } }));
      }
    }
    if (updateDto.cities?.length) {
      for (const city of updateDto.cities) {
        ops.push(this.prisma.nurseryServiceArea.create({ data: { nurseryId: nursery.id, pincode: city, city } }));
      }
    }
    return Promise.all(ops);
  }

  async getServiceAreas(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    return this.prisma.nurseryServiceArea.findMany({ where: { nurseryId: nursery.id } });
  }

  // ─── Nursery Plants ─────────────────────────────────────────────────────────

  async getNurseryPlants(nurseryId: string, filterDto: any) {
    const {
      page = 1, limit = 20, category_id, maintenance_level,
      price_min, price_max, is_indoor, available_for, sort_by = "rating",
    } = filterDto;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const andConditions: Prisma.PlantWhereInput[] = [];

    if (price_min) {
      andConditions.push({
        OR: [
          { rentPriceMonthly: { gte: new Decimal(Number(price_min)) } },
          { buyPrice: { gte: new Decimal(Number(price_min)) } },
        ],
      });
    }
    if (price_max) {
      andConditions.push({
        OR: [
          { rentPriceMonthly: { lte: new Decimal(Number(price_max)) } },
          { buyPrice: { lte: new Decimal(Number(price_max)) } },
        ],
      });
    }

    const where: Prisma.PlantWhereInput = {
      nurseryId,
      isActive: true,
      ...(category_id && { categoryId: category_id }),
      ...(maintenance_level && { maintenanceLevel: maintenance_level }),
      ...(is_indoor !== undefined && { isIndoor: is_indoor === true || is_indoor === "true" }),
      ...(available_for === "RENT" && { isAvailableForRent: true }),
      ...(available_for === "BUY" && { isAvailableForSale: true }),
      ...(andConditions.length > 0 && { AND: andConditions }),
    };

    let orderBy: Prisma.PlantOrderByWithRelationInput = {};
    switch (sort_by) {
      case "price":      orderBy = { buyPrice: "asc" }; break;
      case "rating":     orderBy = { ratingAvg: "desc" }; break;
      case "popularity": orderBy = { totalRentals: "desc" }; break;
      default:           orderBy = { createdAt: "desc" };
    }

    const skip = (parsedPage - 1) * parsedLimit;
    const [plants, total] = await Promise.all([
      this.prisma.plant.findMany({
        where, orderBy, skip, take: parsedLimit,
        include: { images: { where: { isPrimary: true }, take: 1 }, category: true },
      }),
      this.prisma.plant.count({ where }),
    ]);

    return {
      items: plants,
      pagination: { page: parsedPage, limit: parsedLimit, total, totalPages: Math.ceil(total / parsedLimit) },
    };
  }

  // ─── Nursery Reviews ────────────────────────────────────────────────────────

  async getNurseryReviews(nurseryId: string, filterDto: any) {
    const { page = 1, limit = 20, rating } = filterDto;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    const where: Prisma.ReviewWhereInput = {
      reviewableType: "NURSERY",
      reviewableId: nurseryId,
      isActive: true,
      ...(rating && { rating: Number(rating) }),
    };

    const skip = (parsedPage - 1) * parsedLimit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where, skip, take: parsedLimit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } }, images: true },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: reviews,
      pagination: { page: parsedPage, limit: parsedLimit, total, totalPages: Math.ceil(total / parsedLimit) },
    };
  }

  async createNurseryReview(
    userId: string,
    nurseryId: string,
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
    if (!body?.order_id) {
      throw new BadRequestException("order_id is required");
    }

    const ratings = [
      body.rating,
      body.plant_quality_rating,
      body.delivery_rating,
      body.maintenance_rating,
    ].filter((r) => r != null) as number[];

    for (const r of ratings) {
      if (!Number.isFinite(r) || r < 1 || r > 5) {
        throw new BadRequestException("All ratings must be numbers from 1 to 5");
      }
    }

    if (body.comment != null && body.comment.trim().length > 0 && body.comment.trim().length < 10) {
      throw new BadRequestException("comment must be at least 10 characters when provided");
    }

    const nursery = await this.prisma.nursery.findFirst({
      where: { id: nurseryId, isActive: true },
      select: { id: true },
    });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const order = await this.prisma.order.findFirst({
      where: {
        id: body.order_id,
        userId,
        nurseryId,
        status: OrderStatus.COMPLETED,
      },
    });
    if (!order) {
      throw new BadRequestException("A completed order with this nursery is required to leave a review");
    }

    const existing = await this.prisma.review.findFirst({
      where: {
        userId,
        reviewableType: ReviewableType.NURSERY,
        reviewableId: nurseryId,
        orderId: body.order_id,
      },
    });
    if (existing) {
      throw new ConflictException("You have already reviewed this nursery for this order");
    }

    const overall =
      ratings.length > 0
        ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
        : body.rating;

    const breakdown = {
      overall: body.rating,
      plant_quality: body.plant_quality_rating ?? null,
      delivery: body.delivery_rating ?? null,
      maintenance: body.maintenance_rating ?? null,
    };

    const review = await this.prisma.review.create({
      data: {
        userId,
        reviewableType: ReviewableType.NURSERY,
        reviewableId: nurseryId,
        orderId: body.order_id,
        rating: overall,
        title: JSON.stringify(breakdown),
        comment: body.comment?.trim() || null,
        isVerifiedPurchase: true,
        images: body.images?.length
          ? { create: body.images.map((url) => ({ imageUrl: url })) }
          : undefined,
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        images: true,
      },
    });

    const agg = await this.prisma.review.aggregate({
      where: { reviewableType: ReviewableType.NURSERY, reviewableId: nurseryId, isActive: true },
      _avg: { rating: true },
      _count: true,
    });
    await this.prisma.nursery.update({
      where: { id: nurseryId },
      data: {
        ratingAvg: new Decimal((agg._avg.rating ?? overall).toFixed(1)),
        totalReviews: agg._count,
      },
    });

    return review;
  }

  // ─── Check Serviceability ───────────────────────────────────────────────────

  async checkServiceability(nurseryId: string, pincode: string) {
    let nursery;
    try {
      nursery = await this.prisma.nursery.findUnique({
        where: { id: nurseryId },
        include: { serviceAreas: true },
      });
    } catch (err) {
      this.rethrowNurseryDbError(err, "checkServiceability");
    }
    if (!nursery || !nursery.isActive) return { serviceable: false };
    if (nursery.pincode === pincode) return { serviceable: true };
    const serviceable = nursery.serviceAreas.some(
      (area) => area.pincode === pincode || area.city === pincode
    );
    return { serviceable };
  }

  // ─── Gardeners ──────────────────────────────────────────────────────────────

  async getAssignedGardeners(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    return this.prisma.gardener.findMany({
      where: { nurseryId: nursery.id },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, avatarUrl: true } },
        _count: { select: { serviceBookings: true, maintenanceTasks: true } },
      },
    });
  }

  // ─── Invitation System ──────────────────────────────────────────────────────

  async inviteGardener(vendorId: string, gardenerId: string, message?: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const gardener = await this.prisma.gardener.findUnique({ where: { id: gardenerId } });
    if (!gardener) throw new NotFoundException("Gardener not found");

    if (gardener.nurseryId === nursery.id) {
      throw new ConflictException("Gardener is already assigned to this nursery");
    }

    // Check for existing pending invitation
    const existingInvitation = await this.prisma.nurseryInvitation.findFirst({
      where: { nurseryId: nursery.id, gardenerId, status: "PENDING" },
    });
    if (existingInvitation) {
      throw new ConflictException("A pending invitation already exists for this gardener");
    }

    const invitation = await this.prisma.nurseryInvitation.create({
      data: {
        nurseryId: nursery.id,
        gardenerId,
        status: "PENDING",
        message: message || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: {
        gardener: {
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
        nursery: { select: { id: true, name: true } },
      },
    });

    return { message: "Invitation sent successfully", invitation };
  }

  async getNurseryInvitations(vendorId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    return this.prisma.nurseryInvitation.findMany({
      where: { nurseryId: nursery.id },
      orderBy: { createdAt: "desc" },
      include: {
        gardener: {
          include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
        },
      },
    });
  }

  async removeGardener(vendorId: string, gardenerId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const gardener = await this.prisma.gardener.findFirst({
      where: { id: gardenerId, nurseryId: nursery.id },
    });
    if (!gardener) throw new NotFoundException("Gardener not assigned to this nursery");

    await this.prisma.gardener.update({
      where: { id: gardenerId },
      data: { nurseryId: null },
    });

    return { message: "Gardener removed successfully" };
  }

  // ─── Private Analytics ──────────────────────────────────────────────────────

  private async getNurseryAnalytics(nurseryId: string) {
    const [totalOrders, totalRevenue, totalPlants, activeRentals] = await Promise.all([
      this.prisma.order.count({ where: { nurseryId } }),
      this.prisma.order.aggregate({ where: { nurseryId }, _sum: { totalAmount: true } }),
      this.prisma.plant.count({ where: { nurseryId, isActive: true } }),
      this.prisma.orderItem.count({ where: { order: { nurseryId }, rentalStatus: "ACTIVE" } }),
    ]);

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalPlants,
      activeRentals,
    };
  }

  // ─── Legacy findAll (internal NurseryFilterDto usage) ───────────────────────

  async findAll(filterDto: NurseryFilterDto) {
    const {
      page = 1, limit = 20, city, state, search, minRating,
      isVerified, isActive = true, sortBy = "rating", sortOrder = "desc",
      latitude, longitude, serviceAreas,
    } = filterDto;

    const where: Prisma.NurseryWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(isVerified !== undefined && { isVerified }),
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(state && { state: { contains: state, mode: "insensitive" } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(minRating && { ratingAvg: { gte: new Decimal(minRating) } }),
      ...(serviceAreas?.length && {
        serviceAreas: { some: { pincode: { in: serviceAreas } } },
      }),
    };

    let orderBy: Prisma.NurseryOrderByWithRelationInput = {};
    switch (sortBy) {
      case "name":         orderBy = { name: sortOrder }; break;
      case "rating":       orderBy = { ratingAvg: sortOrder }; break;
      case "totalReviews": orderBy = { totalReviews: sortOrder }; break;
      default:             orderBy = { createdAt: sortOrder };
    }

    const skip = (page - 1) * limit;
    const [nurseries, total] = await this.prisma.$transaction([
      this.prisma.nursery.findMany({
        where, orderBy, skip, take: limit,
        include: { _count: { select: { plants: true } }, serviceAreas: true },
      }),
      this.prisma.nursery.count({ where }),
    ]);

    const nurseriesWithDistance = nurseries.map((n) => {
      const data: any = { ...n, totalPlants: n._count.plants };
      if (latitude && longitude && n.latitude && n.longitude) {
        data.distance = this.calculateDistance(latitude, longitude, Number(n.latitude), Number(n.longitude));
      }
      delete data._count;
      return data;
    });

    if (sortBy === "distance" && latitude && longitude) {
      nurseriesWithDistance.sort((a, b) =>
        !a.distance ? 1 : !b.distance ? -1 :
        sortOrder === "asc" ? a.distance - b.distance : b.distance - a.distance
      );
    }

    return {
      data: nurseriesWithDistance,
      total, page, limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrevious: page > 1,
    };
  }

  // --- Contract v3.1: vendor-created staff (MISS-13 / MISS-15 / MOD-07) ---

  async createStaffGardener(vendorId: string, body: Record<string, unknown>) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const email = String(body.email ?? "").toLowerCase().trim();
    const phone = String(body.phone ?? "").trim();
    if (!email || !phone) {
      throw new BadRequestException("email and phone are required");
    }
    const tempPass = `Temp@${Math.random().toString(36).slice(2, 6)}1Aa!`;
    const hashed = await bcrypt.hash(tempPass, 10);
    const taken = await this.prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
    if (taken) {
      throw contractFail(ContractErrorCode.CONFLICT, "Email or phone already in use", HttpStatus.CONFLICT);
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashed,
        fullName: String(body.full_name ?? "Staff"),
        phone,
        role: UserRole.GARDENER,
        isVerified: true,
        mustChangePassword: true,
        registerMeta: { staff_onboard: "vendor", vendor_id: vendorId, role: body.role } as object,
      },
    });
    const g = await this.prisma.gardener.create({
      data: {
        userId: user.id,
        nurseryId: nursery.id,
        isFreelancer: false,
        staffRole: body.role != null ? String(body.role) : "GARDENER_STAFF",
        staffNotes: body.notes != null ? String(body.notes) : null,
      },
    });
    return contractOk({
      gardener_id: g.id,
      email: user.email,
      temporary_password: tempPass,
      must_change_password: true,
    });
  }

  async getStaffGardenerDetail(vendorId: string, gardenerId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const g = await this.prisma.gardener.findFirst({
      where: { id: gardenerId, nurseryId: nursery.id },
      include: { user: { select: { email: true, fullName: true, phone: true, isActive: true } } },
    });
    if (!g) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener not found", HttpStatus.NOT_FOUND);
    }
    return contractOk({
      gardener_id: g.id,
      email: g.user.email,
      full_name: g.user.fullName,
      phone: g.user.phone,
      is_active: g.isAvailable && g.user.isActive,
      role: g.staffRole,
      notes: g.staffNotes,
      created_at: g.createdAt,
      deactivated_at: g.deactivatedAt,
    });
  }

  async updateStaffGardener(vendorId: string, gardenerId: string, body: Record<string, unknown>) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const g = await this.prisma.gardener.findFirst({
      where: { id: gardenerId, nurseryId: nursery.id },
      include: { user: true },
    });
    if (!g) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener not found", HttpStatus.NOT_FOUND);
    }
    await this.prisma.user.update({
      where: { id: g.userId },
      data: {
        ...(body.full_name != null && { fullName: String(body.full_name) }),
        ...(body.phone != null && { phone: String(body.phone) }),
        ...(body.email != null && { email: String(body.email).toLowerCase() }),
      },
    });
    const addr = body.address as Record<string, string> | undefined;
    const updated = await this.prisma.gardener.update({
      where: { id: g.id },
      data: {
        ...(body.notes != null && { staffNotes: String(body.notes) }),
        ...(body.role != null && { staffRole: String(body.role) }),
        ...(addr && {
          bio: [addr.street, addr.area, addr.city].filter(Boolean).join(", "),
        }),
      },
    });
    return contractOk({ gardener_id: updated.id, updated: true });
  }

  async resetStaffCredentials(vendorId: string, gardenerId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const g = await this.prisma.gardener.findFirst({
      where: { id: gardenerId, nurseryId: nursery.id },
    });
    if (!g) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener not found", HttpStatus.NOT_FOUND);
    }
    const tempPass = `Reset@${Math.random().toString(36).slice(2, 6)}1Bb!`;
    const hashed = await bcrypt.hash(tempPass, 10);
    const u = await this.prisma.user.update({
      where: { id: g.userId },
      data: { passwordHash: hashed, mustChangePassword: true },
    });
    return contractOk({
      gardener_id: g.id,
      email: u.email,
      temporary_password: tempPass,
      must_change_password: true,
    });
  }

  async setStaffGardenerStatus(
    vendorId: string,
    gardenerId: string,
    body: { is_active: boolean; reason?: string }
  ) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!nursery) throw new NotFoundException("Nursery not found");
    const g = await this.prisma.gardener.findFirst({
      where: { id: gardenerId, nurseryId: nursery.id },
    });
    if (!g) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener not found", HttpStatus.NOT_FOUND);
    }
    const active = body.is_active;
    await this.prisma.gardener.update({
      where: { id: g.id },
      data: {
        isAvailable: active,
        deactivatedAt: active ? null : new Date(),
        deactivateReason: active ? null : (body.reason ?? "deactivated") as string,
      },
    });
    await this.prisma.user.update({
      where: { id: g.userId },
      data: { isActive: active },
    });
    return contractOk({ gardener_id: g.id, is_active: active });
  }
}