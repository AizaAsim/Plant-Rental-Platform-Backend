import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma, ReviewableType, UserRole, NotificationType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ReviewsDisputesService {
  constructor(private prisma: PrismaService) {}

  private async recalcReviewable(type: ReviewableType, id: string) {
    const agg = await this.prisma.review.aggregate({
      where: { reviewableType: type, reviewableId: id, isActive: true },
      _avg: { rating: true },
      _count: true,
    });
    const avgNum = agg._avg.rating != null ? Number(agg._avg.rating) : 0;
    const avg = new Decimal(avgNum.toFixed(1));
    const count = agg._count;
    if (type === ReviewableType.PLANT) {
      await this.prisma.plant.update({
        where: { id },
        data: { ratingAvg: avg, totalReviews: count },
      });
    } else if (type === ReviewableType.NURSERY) {
      await this.prisma.nursery.update({
        where: { id },
        data: { ratingAvg: avg, totalReviews: count },
      });
    } else if (type === ReviewableType.GARDENER) {
      await this.prisma.gardener.update({
        where: { id },
        data: { ratingAvg: avg, totalReviews: count },
      });
    }
  }

  async createReview(
    userId: string,
    body: {
      reviewable_type: ReviewableType;
      reviewable_id: string;
      order_id?: string;
      booking_id?: string;
      rating: number;
      title?: string;
      comment?: string;
      images?: string[];
    }
  ) {
    if (body.rating < 1 || body.rating > 5) throw new BadRequestException("rating must be 1-5");

    if (body.order_id) {
      const order = await this.prisma.order.findFirst({
        where: { id: body.order_id, userId },
        include: { items: { include: { plant: true } } },
      });
      if (!order) throw new ForbiddenException("Order not found or not yours");
      if (body.reviewable_type === ReviewableType.PLANT) {
        const hasPlant = order.items.some((i) => i.plantId === body.reviewable_id);
        if (!hasPlant) throw new BadRequestException("Plant not in this order");
      }
    }

    if (body.booking_id) {
      const b = await this.prisma.serviceBooking.findFirst({
        where: { id: body.booking_id, userId },
      });
      if (!b) throw new ForbiddenException("Booking not found or not yours");
      if (body.reviewable_type === ReviewableType.GARDENER && b.gardenerId !== body.reviewable_id) {
        throw new BadRequestException("Gardener does not match booking");
      }
    }

    const rtype = body.reviewable_type;
    if (!body.order_id && !body.booking_id) {
      if (rtype === ReviewableType.NURSERY) {
        const anyOrder = await this.prisma.order.findFirst({
          where: { userId, nurseryId: body.reviewable_id },
        });
        if (!anyOrder) throw new BadRequestException("You need an order with this nursery to review");
      }
      if (rtype === ReviewableType.GARDENER) {
        throw new BadRequestException("booking_id is required for gardener reviews");
      }
      if (rtype === ReviewableType.PLANT) {
        const line = await this.prisma.orderItem.findFirst({
          where: { plantId: body.reviewable_id, order: { userId } },
        });
        if (!line) throw new BadRequestException("You must have purchased or rented this plant to review");
      }
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        reviewableType: body.reviewable_type,
        reviewableId: body.reviewable_id,
        orderId: body.order_id,
        bookingId: body.booking_id,
        rating: body.rating,
        title: body.title,
        comment: body.comment,
        isVerifiedPurchase: !!(body.order_id || body.booking_id),
        images:
          body.images?.length > 0
            ? { create: body.images.map((url: string) => ({ imageUrl: url })) }
            : undefined,
      },
      include: { images: true },
    });

    await this.recalcReviewable(body.reviewable_type, body.reviewable_id);
    return review;
  }

  async listReviewsPublic(q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.ReviewWhereInput = {
      isActive: true,
      ...(q.reviewable_type && { reviewableType: q.reviewable_type as ReviewableType }),
      ...(q.reviewable_id && { reviewableId: q.reviewable_id }),
      ...(q.rating && { rating: Number(q.rating) }),
    };
    const orderBy =
      q.sort_by === "rating"
        ? [{ rating: "desc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }];
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: { select: { id: true, fullName: true, avatarUrl: true } },
          images: true,
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateReview(userId: string, reviewId: string, body: any) {
    const r = await this.prisma.review.findFirst({ where: { id: reviewId, userId } });
    if (!r) throw new NotFoundException("Review not found");
    const data: Prisma.ReviewUpdateInput = {};
    if (body.rating != null) data.rating = body.rating;
    if (body.title !== undefined) data.title = body.title;
    if (body.comment !== undefined) data.comment = body.comment;
    const updated = await this.prisma.review.update({ where: { id: reviewId }, data });
    await this.recalcReviewable(r.reviewableType, r.reviewableId);
    return updated;
  }

  async deleteReview(requesterId: string, requesterRole: UserRole, reviewId: string) {
    const r = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!r) throw new NotFoundException("Review not found");
    if (r.userId !== requesterId && requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException("Cannot delete this review");
    }
    const type = r.reviewableType;
    const rid = r.reviewableId;
    await this.prisma.review.update({ where: { id: reviewId }, data: { isActive: false } });
    await this.recalcReviewable(type, rid);
    return { success: true };
  }

  // --- Disputes (user-facing) ---
  private disputeNumber() {
    return `DSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async createDispute(
    userId: string,
    body: {
      order_id?: string;
      booking_id?: string;
      dispute_type: string;
      subject: string;
      description: string;
      attachments?: string[];
    }
  ) {
    if (!body.subject || !body.description) {
      throw new BadRequestException("subject and description are required");
    }
    const d = await this.prisma.dispute.create({
      data: {
        disputeNumber: this.disputeNumber(),
        raisedBy: userId,
        orderId: body.order_id,
        bookingId: body.booking_id,
        disputeType: body.dispute_type as any,
        subject: body.subject,
        description:
          body.attachments?.length ? `${body.description}\n\nAttachments: ${body.attachments.join(", ")}` : body.description,
      },
    });
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
    });
    for (const a of admins) {
      await this.prisma.notification.create({
        data: {
          userId: a.id,
          title: "New dispute",
          message: `${body.subject} (#${d.disputeNumber})`,
          type: NotificationType.SYSTEM,
          referenceType: "DISPUTE",
          referenceId: d.id,
        },
      });
    }
    return d;
  }

  async listMyDisputes(userId: string, q: any) {
    const page = Number(q.page) || 1;
    const limit = Math.min(Number(q.limit) || 20, 100);
    const where: Prisma.DisputeWhereInput = {
      raisedBy: userId,
      ...(q.status && { status: q.status }),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private async canAccessDispute(userId: string, role: UserRole, disputeId: string) {
    const d = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: true, booking: { include: { gardener: true } } },
    });
    if (!d) throw new NotFoundException("Dispute not found");
    if (role === UserRole.ADMIN) return d;
    if (d.raisedBy === userId) return d;
    if (d.order?.userId === userId) return d;
    if (d.booking?.userId === userId) return d;
    if (d.booking?.gardener?.userId === userId) return d;
    if (d.order?.nurseryId) {
      const n = await this.prisma.nursery.findFirst({
        where: { id: d.order.nurseryId, vendorId: userId },
      });
      if (n) return d;
    }
    throw new ForbiddenException("Access denied");
  }

  async getDisputeUser(userId: string, role: UserRole, disputeId: string) {
    const d = await this.canAccessDispute(userId, role, disputeId);
    return this.prisma.dispute.findUnique({
      where: { id: d.id },
      include: {
        messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { fullName: true } } } },
        order: { select: { id: true, orderNumber: true } },
        booking: { select: { id: true, bookingNumber: true } },
      },
    });
  }

  async addDisputeMessageUser(userId: string, role: UserRole, disputeId: string, body: { message: string; attachments?: string[] }) {
    await this.canAccessDispute(userId, role, disputeId);
    return this.prisma.disputeMessage.create({
      data: {
        disputeId,
        senderId: userId,
        message: body.message,
        attachments: body.attachments || [],
      },
    });
  }
}
