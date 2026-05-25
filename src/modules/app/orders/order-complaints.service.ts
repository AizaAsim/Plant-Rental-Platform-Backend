import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
      attachments?: string[];
    }
  ) {
    if (!body?.subject?.trim() || !body?.description?.trim()) {
      throw new BadRequestException("subject and description are required");
    }

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
}
