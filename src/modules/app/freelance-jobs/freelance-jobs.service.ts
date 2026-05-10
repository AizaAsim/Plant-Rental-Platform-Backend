import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk, contractPublicId, contractFail } from "src/common/contract/response";
import { ContractErrorCode } from "src/common/contract/error-codes";
import {
  Prisma,
  FreelanceJobStatus,
  UserRole,
  FreelanceJob,
  TransactionStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { resolveOrderId } from "src/common/contract/resolve-entity";

@Injectable()
export class FreelanceJobsService {
  constructor(private readonly prisma: PrismaService) {}

  /** URL param may be row UUID or contract public_id (FJB-xxxxxxxx). */
  private async findJobByRef(ref: string) {
    return this.prisma.freelanceJob.findFirst({
      where: { OR: [{ id: ref }, { publicId: ref }] },
    });
  }

  private async hasPendingFreelancePayment(jobId: string): Promise<boolean> {
    const p = await this.prisma.payment.findFirst({
      where: { freelanceJobId: jobId, status: TransactionStatus.PENDING },
    });
    return Boolean(p);
  }

  async createRequest(userId: string, body: Record<string, unknown>) {
    const orderId = body.order_id ? await resolveOrderId(this.prisma, String(body.order_id)) : null;
    const addressId = String(body.delivery_address_id ?? "");
    const addr = await this.prisma.userAddress.findFirst({ where: { id: addressId, userId } });
    if (!addr) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Address not found", HttpStatus.NOT_FOUND);
    }
    const rawDate = body.preferred_date;
    if (rawDate == null || String(rawDate).trim() === "") {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "preferred_date is required",
        HttpStatus.BAD_REQUEST
      );
    }
    const preferredDate = new Date(String(rawDate));
    if (Number.isNaN(preferredDate.getTime())) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "preferred_date must be a valid ISO date",
        HttpStatus.BAD_REQUEST
      );
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prefDay = new Date(preferredDate);
    prefDay.setHours(0, 0, 0, 0);
    if (prefDay < today) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "preferred_date cannot be in the past",
        HttpStatus.BAD_REQUEST
      );
    }

    let budgetAmount: Decimal | undefined;
    if (body.budget_amount != null && body.budget_amount !== "") {
      try {
        const b = new Decimal(String(body.budget_amount));
        if (b.lessThanOrEqualTo(0)) {
          throw new Error("lte0");
        }
        budgetAmount = b;
      } catch {
        throw contractFail(
          ContractErrorCode.VALIDATION_ERROR,
          "budget_amount must be a positive decimal",
          HttpStatus.BAD_REQUEST
        );
      }
    }

    const care = Array.isArray(body.care_types) ? (body.care_types as string[]) : [];
    const job = await this.prisma.freelanceJob.create({
      data: {
        publicId: contractPublicId("FJB"),
        userId,
        orderId: orderId ?? undefined,
        deliveryAddressId: addressId,
        careTypes: care,
        preferredDate,
        timeFrom: String(body.preferred_time_from ?? "09:00"),
        timeTo: String(body.preferred_time_to ?? "17:00"),
        plantDetails: body.plant_details != null ? String(body.plant_details) : null,
        specialInstructions: body.special_instructions != null ? String(body.special_instructions) : null,
        city: addr.city,
        pincode: addr.pincode,
        ...(budgetAmount != null ? { budgetAmount } : {}),
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
      this.prisma.freelanceJob.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.freelanceJob.count({ where }),
    ]);
    return contractOk({
      items: items.map((j) => this.jobDto(j)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  }

  async listOpen(q: {
    city?: string;
    pincode?: string;
    care_type?: string;
    date_from?: string;
    date_to?: string;
    page?: string;
    limit?: string;
  }) {
    const page = Math.max(1, parseInt(q.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10) || 20));
    const where: Prisma.FreelanceJobWhereInput = { status: FreelanceJobStatus.OPEN };
    if (q.city) where.city = { contains: q.city, mode: "insensitive" };
    if (q.pincode) where.pincode = q.pincode;
    if (q.care_type) where.careTypes = { has: q.care_type };
    if (q.date_from || q.date_to) {
      where.preferredDate = {};
      if (q.date_from) (where.preferredDate as { gte?: Date; lte?: Date }).gte = new Date(q.date_from);
      if (q.date_to) (where.preferredDate as { gte?: Date; lte?: Date }).lte = new Date(q.date_to);
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.freelanceJob.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.freelanceJob.count({ where }),
    ]);
    return contractOk({
      items: items.map((j) => this.jobDto(j)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  }

  async getOne(actorUserId: string, role: UserRole, jobRef: string) {
    const job = await this.findJobByRef(jobRef);
    if (!job) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Job not found", HttpStatus.NOT_FOUND);
    }
    if (role === UserRole.USER) {
      if (job.userId !== actorUserId) {
        throw contractFail(ContractErrorCode.UNAUTHORIZED_ACTION, "Forbidden", HttpStatus.FORBIDDEN);
      }
      return contractOk(this.jobDto(job));
    }
    if (role === UserRole.GARDENER) {
      const g = await this.prisma.gardener.findUnique({ where: { userId: actorUserId } });
      if (!g) {
        throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener profile not found", HttpStatus.NOT_FOUND);
      }
      if (!g.isFreelancer && job.acceptedGardenerId !== g.id) {
        throw contractFail(ContractErrorCode.UNAUTHORIZED_ACTION, "Freelance profile required", HttpStatus.FORBIDDEN);
      }
      const canBrowseOpen = Boolean(g.isFreelancer && job.status === FreelanceJobStatus.OPEN);
      const isAssignee = job.acceptedGardenerId === g.id;
      if (!canBrowseOpen && !isAssignee) {
        throw contractFail(ContractErrorCode.UNAUTHORIZED_ACTION, "Forbidden", HttpStatus.FORBIDDEN);
      }
      return contractOk(this.jobDto(job));
    }
    throw contractFail(ContractErrorCode.UNAUTHORIZED_ACTION, "Forbidden", HttpStatus.FORBIDDEN);
  }

  async accept(gardenerUserId: string, jobRef: string) {
    const g = await this.prisma.gardener.findUnique({ where: { userId: gardenerUserId } });
    if (!g?.isFreelancer) {
      throw contractFail(ContractErrorCode.UNAUTHORIZED_ACTION, "Freelance profile required", HttpStatus.FORBIDDEN);
    }
    const job = await this.findJobByRef(jobRef);
    if (!job?.id || job.status !== FreelanceJobStatus.OPEN) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Job not available", HttpStatus.NOT_FOUND);
    }
    const result = await this.prisma.freelanceJob.updateMany({
      where: { id: job.id, status: FreelanceJobStatus.OPEN },
      data: { status: FreelanceJobStatus.ACCEPTED, acceptedGardenerId: g.id },
    });
    if (result.count !== 1) {
      throw contractFail(ContractErrorCode.CONFLICT, "Job already taken", HttpStatus.CONFLICT);
    }
    const updated = await this.prisma.freelanceJob.findUnique({ where: { id: job.id } });
    return contractOk(this.jobDto(updated!));
  }

  async myJobs(gardenerUserId: string, q: { status?: string; page?: string; limit?: string }) {
    const g = await this.prisma.gardener.findUnique({ where: { userId: gardenerUserId } });
    if (!g) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener profile not found", HttpStatus.NOT_FOUND);
    const page = Math.max(1, parseInt(q.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || "20", 10) || 20));
    const where: Prisma.FreelanceJobWhereInput = { acceptedGardenerId: g.id };
    if (q.status) where.status = q.status as FreelanceJobStatus;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.freelanceJob.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.freelanceJob.count({ where }),
    ]);
    return contractOk({
      items: items.map((j) => this.jobDto(j)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    });
  }

  async start(gardenerUserId: string, jobRef: string) {
    const g = await this.prisma.gardener.findUnique({ where: { userId: gardenerUserId } });
    if (!g) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener not found", HttpStatus.NOT_FOUND);
    const job = await this.findJobByRef(jobRef);
    if (!job) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Job not found", HttpStatus.NOT_FOUND);
    }
    if (job.budgetAmount != null && !job.paidAt) {
      throw contractFail(
        ContractErrorCode.INVALID_STATE_TRANSITION,
        "Customer must complete payment before work starts when a budget was set",
        HttpStatus.BAD_REQUEST
      );
    }
    const result = await this.prisma.freelanceJob.updateMany({
      where: {
        id: job.id,
        acceptedGardenerId: g.id,
        status: FreelanceJobStatus.ACCEPTED,
      },
      data: { status: FreelanceJobStatus.IN_PROGRESS, startedAt: new Date() },
    });
    if (result.count !== 1) {
      throw contractFail(ContractErrorCode.INVALID_STATE_TRANSITION, "Cannot start this job", HttpStatus.BAD_REQUEST);
    }
    const updated = await this.prisma.freelanceJob.findUnique({ where: { id: job.id } });
    return contractOk(this.jobDto(updated!));
  }

  async complete(gardenerUserId: string, jobRef: string, body: Record<string, unknown>) {
    const g = await this.prisma.gardener.findUnique({ where: { userId: gardenerUserId } });
    if (!g) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Gardener not found", HttpStatus.NOT_FOUND);
    const job = await this.findJobByRef(jobRef);
    if (!job?.id) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Job not found", HttpStatus.NOT_FOUND);
    }
    const result = await this.prisma.freelanceJob.updateMany({
      where: {
        id: job.id,
        acceptedGardenerId: g.id,
        status: FreelanceJobStatus.IN_PROGRESS,
      },
      data: {
        status: FreelanceJobStatus.COMPLETED,
        completedAt: new Date(),
        completionNotes: body.completion_notes != null ? String(body.completion_notes) : null,
        completionPhotoUrls:
          body.photo_urls != null ? (body.photo_urls as Prisma.InputJsonValue) : undefined,
      },
    });
    if (result.count !== 1) {
      throw contractFail(ContractErrorCode.INVALID_STATE_TRANSITION, "Cannot complete this job", HttpStatus.BAD_REQUEST);
    }
    const updated = await this.prisma.freelanceJob.findUnique({ where: { id: job.id } });
    return contractOk(this.jobDto(updated!));
  }

  async review(userId: string, jobRef: string, body: { rating: number; comment?: string }) {
    const job = await this.findJobByRef(jobRef);
    if (!job || job.userId !== userId || job.status !== FreelanceJobStatus.COMPLETED) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Job not found or not completed", HttpStatus.NOT_FOUND);
    }
    const r = Number(body.rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      throw contractFail(ContractErrorCode.VALIDATION_ERROR, "rating must be an integer 1–5", HttpStatus.BAD_REQUEST);
    }
    if (job.reviewRating != null) {
      if (job.reviewRating === r && (job.reviewComment ?? null) === (body.comment ?? null)) {
        return contractOk(this.jobDto(job));
      }
      throw contractFail(ContractErrorCode.CONFLICT, "Review already submitted", HttpStatus.CONFLICT);
    }
    const updated = await this.prisma.freelanceJob.update({
      where: { id: job.id },
      data: { reviewRating: r, reviewComment: body.comment ?? null },
    });
    return contractOk(this.jobDto(updated));
  }

  async cancelCustomer(userId: string, jobRef: string, body: { reason?: string }) {
    const job = await this.findJobByRef(jobRef);
    if (!job?.id || job.userId !== userId) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Job not found", HttpStatus.NOT_FOUND);
    }
    if (job.paidAt) {
      throw contractFail(
        ContractErrorCode.CONFLICT,
        "Paid jobs cannot be cancelled via this endpoint; contact support for refunds.",
        HttpStatus.CONFLICT
      );
    }
    if (job.status === FreelanceJobStatus.CANCELLED || job.status === FreelanceJobStatus.COMPLETED) {
      throw contractFail(ContractErrorCode.INVALID_STATE_TRANSITION, "Job is already terminal", HttpStatus.BAD_REQUEST);
    }
    if (job.status === FreelanceJobStatus.IN_PROGRESS) {
      throw contractFail(
        ContractErrorCode.INVALID_STATE_TRANSITION,
        "Cannot cancel a job that is already in progress",
        HttpStatus.BAD_REQUEST
      );
    }
    if (await this.hasPendingFreelancePayment(job.id)) {
      throw contractFail(
        ContractErrorCode.CONFLICT,
        "A payment is pending for this job",
        HttpStatus.CONFLICT
      );
    }

    if (job.status !== FreelanceJobStatus.OPEN && job.status !== FreelanceJobStatus.ACCEPTED) {
      throw contractFail(ContractErrorCode.INVALID_STATE_TRANSITION, "Cannot cancel this job", HttpStatus.BAD_REQUEST);
    }

    const updated = await this.prisma.freelanceJob.update({
      where: { id: job.id },
      data: {
        status: FreelanceJobStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByRole: "CUSTOMER",
        cancellationReason: body.reason ?? null,
      },
    });
    return contractOk(this.jobDto(updated));
  }

  async withdrawGardener(gardenerUserId: string, jobRef: string, _body?: { reason?: string }) {
    const g = await this.prisma.gardener.findUnique({ where: { userId: gardenerUserId } });
    if (!g?.isFreelancer) {
      throw contractFail(ContractErrorCode.UNAUTHORIZED_ACTION, "Freelance profile required", HttpStatus.FORBIDDEN);
    }
    const job = await this.findJobByRef(jobRef);
    if (!job?.id || job.acceptedGardenerId !== g.id) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Job not found", HttpStatus.NOT_FOUND);
    }
    if (job.status !== FreelanceJobStatus.ACCEPTED) {
      throw contractFail(ContractErrorCode.INVALID_STATE_TRANSITION, "Can only withdraw before work starts", HttpStatus.BAD_REQUEST);
    }
    if (job.paidAt || (await this.hasPendingFreelancePayment(job.id))) {
      throw contractFail(
        ContractErrorCode.CONFLICT,
        "Withdraw not allowed once payment exists for this job",
        HttpStatus.CONFLICT
      );
    }

    const updated = await this.prisma.freelanceJob.update({
      where: { id: job.id },
      data: {
        status: FreelanceJobStatus.OPEN,
        acceptedGardenerId: null,
      },
    });
    return contractOk(this.jobDto(updated));
  }

  private jobDto(j: FreelanceJob) {
    return {
      job_id: j.publicId,
      id: j.id,
      user_id: j.userId,
      order_id: j.orderId,
      delivery_address_id: j.deliveryAddressId,
      care_types: j.careTypes,
      preferred_date: j.preferredDate.toISOString().slice(0, 10),
      preferred_time_from: j.timeFrom,
      preferred_time_to: j.timeTo,
      plant_details: j.plantDetails,
      special_instructions: j.specialInstructions,
      budget_amount: j.budgetAmount != null ? j.budgetAmount.toString() : null,
      city: j.city,
      pincode: j.pincode,
      status: j.status,
      accepted_gardener_id: j.acceptedGardenerId,
      started_at: j.startedAt?.toISOString() ?? null,
      completed_at: j.completedAt?.toISOString() ?? null,
      completion_notes: j.completionNotes,
      completion_photo_urls: j.completionPhotoUrls,
      paid_at: j.paidAt?.toISOString() ?? null,
      cancelled_at: j.cancelledAt?.toISOString() ?? null,
      cancellation_reason: j.cancellationReason,
      cancelled_by_role: j.cancelledByRole,
      review_rating: j.reviewRating,
      review_comment: j.reviewComment,
      created_at: j.createdAt.toISOString(),
      updated_at: j.updatedAt.toISOString(),
    };
  }
}
