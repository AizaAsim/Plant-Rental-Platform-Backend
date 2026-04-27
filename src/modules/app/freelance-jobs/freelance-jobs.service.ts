import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk, contractPublicId, contractFail } from "src/common/contract/response";
import { ContractErrorCode } from "src/common/contract/error-codes";
import { Prisma, FreelanceJobStatus } from "@prisma/client";
import { resolveOrderId } from "src/common/contract/resolve-entity";

@Injectable()
export class FreelanceJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(userId: string, body: Record<string, unknown>) {
    const orderId = body.order_id ? await resolveOrderId(this.prisma, String(body.order_id)) : null;
    const addressId = String(body.delivery_address_id ?? "");
    const addr = await this.prisma.userAddress.findFirst({ where: { id: addressId, userId } });
    if (!addr) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Address not found", HttpStatus.NOT_FOUND);
    }
    const care = Array.isArray(body.care_types) ? (body.care_types as string[]) : [];
    const job = await this.prisma.freelanceJob.create({
      data: {
        publicId: contractPublicId("FJB"),
        userId,
        orderId: orderId ?? undefined,
        deliveryAddressId: addressId,
        careTypes: care,
        preferredDate: new Date(String(body.preferred_date ?? "1970-01-01")),
        timeFrom: String(body.preferred_time_from ?? "09:00"),
        timeTo: String(body.preferred_time_to ?? "17:00"),
        plantDetails: body.plant_details != null ? String(body.plant_details) : null,
        specialInstructions: body.special_instructions != null ? String(body.special_instructions) : null,
        city: addr.city,
        pincode: addr.pincode,
        status: FreelanceJobStatus.OPEN,
      },
    });
    return contractOk(this.jobDto(job));
  }

  async myRequests(userId: string, q: { status?: string; page?: string; limit?: string }) {
    const page = Math.max(1, parseInt(q.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10) || 20));
    const where: Prisma.FreelanceJobWhereInput = { userId };
    if (q.status) {
      where.status = q.status as FreelanceJobStatus;
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.freelanceJob.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.freelanceJob.count({ where }),
    ]);
    return contractOk({
      items: items.map((j) => this.jobDto(j)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  }

  async listOpen(q: { city?: string; pincode?: string; care_type?: string; date_from?: string; date_to?: string; page?: string; limit?: string }) {
    const page = Math.max(1, parseInt(q.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10) || 20));
    const where: Prisma.FreelanceJobWhereInput = { status: FreelanceJobStatus.OPEN };
    if (q.city) where.city = { contains: q.city, mode: "insensitive" };
    if (q.pincode) where.pincode = q.pincode;
    if (q.care_type) where.careTypes = { has: q.care_type };
    if (q.date_from || q.date_to) {
      where.preferredDate = {};
      if (q.date_from) (where.preferredDate as any).gte = new Date(q.date_from);
      if (q.date_to) (where.preferredDate as any).lte = new Date(q.date_to);
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.freelanceJob.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.freelanceJob.count({ where }),
    ]);
    return contractOk({
      items: items.map((j) => this.jobDto(j)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  }

  async accept(gardenerUserId: string, jobId: string) {
    const g = await this.prisma.gardener.findUnique({ where: { userId: gardenerUserId } });
    if (!g?.isFreelancer) {
      throw contractFail(ContractErrorCode.UNAUTHORIZED_ACTION, "Freelance profile required", HttpStatus.FORBIDDEN);
    }
    const job = await this.prisma.freelanceJob.findFirst({
      where: { id: jobId, status: FreelanceJobStatus.OPEN },
    });
    if (!job) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Job not available", HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.freelanceJob.update({
      where: { id: job.id },
      data: { status: FreelanceJobStatus.ACCEPTED, acceptedGardenerId: g.id },
    });
    return contractOk(this.jobDto(updated));
  }

  async myJobs(gardenerUserId: string, q: { status?: string; page?: string; limit?: string }) {
    const g = await this.prisma.gardener.findUnique({ where: { userId: gardenerUserId } });
    if (!g) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener profile not found", HttpStatus.NOT_FOUND);
    const page = Math.max(1, parseInt(q.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10) || 20));
    const where: Prisma.FreelanceJobWhereInput = { acceptedGardenerId: g.id };
    if (q.status) where.status = q.status as FreelanceJobStatus;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.freelanceJob.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.freelanceJob.count({ where }),
    ]);
    return contractOk({
      items: items.map((j) => this.jobDto(j)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  }

  async start(gardenerUserId: string, jobId: string) {
    const g = await this.prisma.gardener.findUnique({ where: { userId: gardenerUserId } });
    if (!g) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener not found", HttpStatus.NOT_FOUND);
    const job = await this.prisma.freelanceJob.findFirst({
      where: { id: jobId, acceptedGardenerId: g.id, status: FreelanceJobStatus.ACCEPTED },
    });
    if (!job) {
      throw contractFail(ContractErrorCode.INVALID_STATE_TRANSITION, "Cannot start this job", HttpStatus.BAD_REQUEST);
    }
    const updated = await this.prisma.freelanceJob.update({
      where: { id: job.id },
      data: { status: FreelanceJobStatus.IN_PROGRESS, startedAt: new Date() },
    });
    return contractOk(this.jobDto(updated));
  }

  async complete(gardenerUserId: string, jobId: string, body: Record<string, unknown>) {
    const g = await this.prisma.gardener.findUnique({ where: { userId: gardenerUserId } });
    if (!g) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener not found", HttpStatus.NOT_FOUND);
    const job = await this.prisma.freelanceJob.findFirst({
      where: { id: jobId, acceptedGardenerId: g.id, status: FreelanceJobStatus.IN_PROGRESS },
    });
    if (!job) {
      throw contractFail(ContractErrorCode.INVALID_STATE_TRANSITION, "Cannot complete this job", HttpStatus.BAD_REQUEST);
    }
    const updated = await this.prisma.freelanceJob.update({
      where: { id: job.id },
      data: {
        status: FreelanceJobStatus.COMPLETED,
        completedAt: new Date(),
        completionNotes: body.completion_notes != null ? String(body.completion_notes) : null,
        completionPhotoUrls: (body.photo_urls as object) ?? undefined,
      },
    });
    return contractOk(this.jobDto(updated));
  }

  async review(userId: string, jobId: string, body: { rating: number; comment?: string }) {
    const job = await this.prisma.freelanceJob.findFirst({
      where: { id: jobId, userId, status: FreelanceJobStatus.COMPLETED },
    });
    if (!job) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Job not found or not completed", HttpStatus.NOT_FOUND);
    }
    const updated = await this.prisma.freelanceJob.update({
      where: { id: job.id },
      data: { reviewRating: body.rating, reviewComment: body.comment ?? null },
    });
    return contractOk(this.jobDto(updated));
  }

  private jobDto(j: {
    id: string;
    publicId: string;
    orderId: string | null;
    careTypes: string[];
    preferredDate: Date;
    timeFrom: string;
    timeTo: string;
    status: FreelanceJobStatus;
    reviewRating: number | null;
  }) {
    return {
      job_id: j.publicId,
      id: j.id,
      order_id: j.orderId,
      care_types: j.careTypes,
      preferred_date: j.preferredDate.toISOString().slice(0, 10),
      status: j.status,
      review_rating: j.reviewRating,
    };
  }
}
