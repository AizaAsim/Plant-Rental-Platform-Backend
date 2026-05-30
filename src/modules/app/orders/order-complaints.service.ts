import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrderComplaintStatus, OrderComplaintType, UserRole } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { resolveOrderId } from "src/common/contract/resolve-entity";
import { DomainNotificationsService } from "../notifications/domain-notifications.service";

@Injectable()
export class OrderComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainNotifications: DomainNotificationsService
  ) {}

  private complaintNumber() {
    return `CMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async create(
    userId: string,
    orderIdOrNum: string,
    body: {
      subject: string;
      description: string;
      complaint_type?: OrderComplaintType;
      attachments?: string[];
    }
  ) {
    if (!body?.subject?.trim() || !body?.description?.trim()) {
      throw new BadRequestException("subject and description are required");
    }

    const complaintType = body.complaint_type ?? OrderComplaintType.OTHER;

    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw new NotFoundException("Order not found");

    const order = await this.prisma.order.findFirst({
      where: { id: oid, userId },
      select: { id: true, orderNumber: true, nurseryId: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    const complaint = await this.prisma.orderComplaint.create({
      data: {
        complaintNumber: this.complaintNumber(),
        orderId: oid,
        userId,
        subject: body.subject.trim(),
        description: body.description.trim(),
        complaintType,
        attachments: body.attachments?.length ? body.attachments : undefined,
      },
    });

    await this.domainNotifications.notifyOrderComplaint({
      orderId: order.id,
      orderNumber: order.orderNumber,
      nurseryId: order.nurseryId,
      complaintId: complaint.id,
      complaintNumber: complaint.complaintNumber,
      subject: complaint.subject,
    });

    return {
      ...complaint,
      admin_dashboard_ready: true,
      vendor_app_notified: true,
      message:
        "Complaint recorded. Admin dashboard can activate GET /api/v1/admin/order-complaints when ready.",
    };
  }

  async listForUser(userId: string, query: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.orderComplaint.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { order: { select: { orderNumber: true } } },
      }),
      this.prisma.orderComplaint.count({ where: { userId } }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listForVendor(vendorUserId: string, query: { page?: number; limit?: number }) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId: vendorUserId },
      select: { id: true },
    });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.orderComplaint.findMany({
        where: { order: { nurseryId: nursery.id } },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { orderNumber: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.orderComplaint.count({
        where: { order: { nurseryId: nursery.id } },
      }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listForAdmin(query: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Number(query.limit) || 50, 100);
    const skip = (page - 1) * limit;
    const where = query.status ? { status: query.status as any } : {};

    const [items, total] = await Promise.all([
      this.prisma.orderComplaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { orderNumber: true, nurseryId: true } },
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.orderComplaint.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getOneForUser(userId: string, complaintId: string) {
    const complaint = await this.prisma.orderComplaint.findFirst({
      where: { id: complaintId, userId },
      include: {
        order: { select: { orderNumber: true, nurseryId: true, status: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });
    if (!complaint) throw new NotFoundException("Complaint not found");
    return complaint;
  }

  private async complaintForVendor(vendorUserId: string, complaintId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId: vendorUserId },
      select: { id: true },
    });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const complaint = await this.prisma.orderComplaint.findFirst({
      where: { id: complaintId, order: { nurseryId: nursery.id } },
      include: {
        order: { select: { orderNumber: true, userId: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!complaint) throw new NotFoundException("Complaint not found");
    return complaint;
  }

  async respond(
    vendorUserId: string,
    complaintId: string,
    body: {
      message: string;
      proposed_resolution: string;
      attachments?: string[];
    }
  ) {
    if (!body?.message?.trim() || body.message.trim().length < 10) {
      throw new BadRequestException("message is required (min 10 characters)");
    }
    if (!body?.proposed_resolution?.trim()) {
      throw new BadRequestException("proposed_resolution is required");
    }

    const complaint = await this.complaintForVendor(vendorUserId, complaintId);

    const msg = await this.prisma.orderComplaintMessage.create({
      data: {
        complaintId: complaint.id,
        authorUserId: vendorUserId,
        authorRole: UserRole.VENDOR,
        message: body.message.trim(),
        proposedResolution: body.proposed_resolution.trim(),
        attachments: body.attachments?.length ? body.attachments : undefined,
      },
    });

    if (complaint.status === OrderComplaintStatus.OPEN) {
      await this.prisma.orderComplaint.update({
        where: { id: complaint.id },
        data: { status: OrderComplaintStatus.UNDER_REVIEW },
      });
    }

    await this.prisma.notification.create({
      data: {
        userId: complaint.user.id,
        title: "Complaint update",
        message: `Vendor responded to complaint ${complaint.complaintNumber}`,
        type: "ORDER",
        referenceType: "ORDER_COMPLAINT",
        referenceId: complaint.id,
      },
    });

    return { complaint_id: complaint.id, message: msg };
  }

  async updateStatus(
    vendorUserId: string,
    complaintId: string,
    body: { status: OrderComplaintStatus; resolution_note?: string }
  ) {
    const allowed: OrderComplaintStatus[] = [
      OrderComplaintStatus.UNDER_REVIEW,
      OrderComplaintStatus.RESOLVED,
      OrderComplaintStatus.CLOSED,
    ];
    if (!body?.status || !allowed.includes(body.status)) {
      throw new BadRequestException(`status must be one of: ${allowed.join(", ")}`);
    }
    if (body.status === OrderComplaintStatus.RESOLVED && !body.resolution_note?.trim()) {
      throw new BadRequestException("resolution_note is required when status is RESOLVED");
    }

    const complaint = await this.complaintForVendor(vendorUserId, complaintId);

    const updated = await this.prisma.orderComplaint.update({
      where: { id: complaint.id },
      data: {
        status: body.status,
        ...(body.resolution_note !== undefined && { resolutionNote: body.resolution_note.trim() }),
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: complaint.user.id,
        title: "Complaint status updated",
        message: `Your complaint ${complaint.complaintNumber} is now ${body.status}`,
        type: "ORDER",
        referenceType: "ORDER_COMPLAINT",
        referenceId: complaint.id,
      },
    });

    return updated;
  }
}
