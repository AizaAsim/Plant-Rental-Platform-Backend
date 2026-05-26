import { Injectable } from "@nestjs/common";
import { NotificationType, UserRole } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

@Injectable()
export class DomainNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  private async inApp(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    referenceType: string,
    referenceId: string
  ) {
    await this.notifications.sendInternal({
      user_id: userId,
      title,
      message,
      type,
      reference_type: referenceType,
      reference_id: referenceId,
      channels: ["IN_APP"],
    });
  }

  async notifyAdmins(
    title: string,
    message: string,
    referenceType: string,
    referenceId: string
  ) {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN, isActive: true },
      select: { id: true },
    });
    for (const a of admins) {
      await this.inApp(a.id, title, message, NotificationType.SYSTEM, referenceType, referenceId);
    }
  }

  async notifyVendorByNurseryId(
    nurseryId: string,
    title: string,
    message: string,
    type: NotificationType,
    referenceType: string,
    referenceId: string
  ) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { id: nurseryId },
      select: { vendorId: true },
    });
    if (!nursery?.vendorId) return;
    await this.inApp(
      nursery.vendorId,
      title,
      message,
      type,
      referenceType,
      referenceId
    );
  }

  async notifyGardenersForOrderItem(
    orderItemId: string,
    title: string,
    message: string,
    referenceType: string,
    referenceId: string
  ) {
    const tasks = await this.prisma.maintenanceTask.findMany({
      where: { orderItemId, gardenerId: { not: null } },
      select: { gardenerId: true },
      distinct: ["gardenerId"],
    });
    for (const t of tasks) {
      if (!t.gardenerId) continue;
      const gardener = await this.prisma.gardener.findUnique({
        where: { id: t.gardenerId },
        select: { userId: true },
      });
      if (!gardener?.userId) continue;
      await this.inApp(
        gardener.userId,
        title,
        message,
        NotificationType.TASK,
        referenceType,
        referenceId
      );
    }
  }

  async notifyExtensionRejectedByVendor(params: {
    customerUserId: string;
    orderId: string;
    orderNumber: string;
    extensionId: string;
    reason?: string | null;
  }) {
    const r = params.reason?.trim();
    await this.inApp(
      params.customerUserId,
      "Rental extension declined",
      `The nursery did not approve your extension request for order ${params.orderNumber}.${r ? ` Reason: ${r}` : ""}`,
      NotificationType.RENTAL,
      "RENTAL_EXTENSION",
      params.extensionId
    );
  }

  async notifyRentalExtension(params: {
    orderId: string;
    orderNumber: string;
    orderItemId: string;
    nurseryId: string;
    customerUserId: string;
    newEndDate: Date;
    amount: number;
  }) {
    const end = params.newEndDate.toISOString().slice(0, 10);
    await this.inApp(
      params.customerUserId,
      "Rental extended",
      `Your rental on order ${params.orderNumber} is extended to ${end}. Pay ${params.amount} to confirm.`,
      NotificationType.RENTAL,
      "ORDER",
      params.orderId
    );
    await this.notifyVendorByNurseryId(
      params.nurseryId,
      "Customer requested rental extension",
      `Order ${params.orderNumber}: extension to ${end}, payment pending.`,
      NotificationType.RENTAL,
      "ORDER",
      params.orderId
    );
    await this.notifyGardenersForOrderItem(
      params.orderItemId,
      "Maintenance schedule updated",
      `Rental extension on order ${params.orderNumber}; visits were rescheduled through ${end}.`,
      "ORDER_ITEM",
      params.orderItemId
    );
  }

  async notifyRentalOverdue(params: {
    orderId: string;
    orderNumber: string;
    nurseryId: string;
    customerUserId: string;
    overdueDays: number;
    penaltyTotal: number;
  }) {
    await this.inApp(
      params.customerUserId,
      "Rental overdue",
      `Order ${params.orderNumber} is ${params.overdueDays} day(s) overdue. Penalty due: ${params.penaltyTotal}.`,
      NotificationType.RENTAL,
      "ORDER",
      params.orderId
    );
    await this.notifyVendorByNurseryId(
      params.nurseryId,
      "Rental overdue",
      `Order ${params.orderNumber} is overdue (${params.overdueDays} day(s)).`,
      NotificationType.RENTAL,
      "ORDER",
      params.orderId
    );
  }

  async notifyPenaltyPaid(params: {
    orderId: string;
    orderNumber: string;
    nurseryId: string;
    customerUserId: string;
    amount: number;
  }) {
    await this.inApp(
      params.customerUserId,
      "Penalty payment received",
      `Your penalty payment of ${params.amount} for order ${params.orderNumber} was successful.`,
      NotificationType.PAYMENT,
      "ORDER",
      params.orderId
    );
    await this.notifyVendorByNurseryId(
      params.nurseryId,
      "Customer paid overdue penalty",
      `Order ${params.orderNumber}: penalty of ${params.amount} was paid.`,
      NotificationType.PAYMENT,
      "ORDER",
      params.orderId
    );
  }

  async notifyExtensionPaymentPaid(params: {
    orderId: string;
    orderNumber: string;
    customerUserId: string;
    amount: number;
  }) {
    await this.inApp(
      params.customerUserId,
      "Extension payment received",
      `Extension payment of ${params.amount} for order ${params.orderNumber} was successful.`,
      NotificationType.PAYMENT,
      "ORDER",
      params.orderId
    );
  }

  async notifyOrderComplaint(params: {
    orderId: string;
    orderNumber: string;
    nurseryId: string;
    complaintId: string;
    complaintNumber: string;
    subject: string;
  }) {
    await this.notifyVendorByNurseryId(
      params.nurseryId,
      "New customer complaint",
      `${params.subject} on order ${params.orderNumber} (#${params.complaintNumber})`,
      NotificationType.ORDER,
      "ORDER_COMPLAINT",
      params.complaintId
    );
    await this.notifyAdmins(
      "New customer complaint",
      `${params.subject} on order ${params.orderNumber} (#${params.complaintNumber})`,
      "ORDER_COMPLAINT",
      params.complaintId
    );
  }

  async notifyGardenerAssigned(params: {
    orderId: string;
    orderNumber: string;
    customerUserId: string;
    gardenerUserId: string;
    tasksCreated: number;
  }) {
    await this.inApp(
      params.customerUserId,
      "Gardener assigned",
      `A gardener was assigned to order ${params.orderNumber} (${params.tasksCreated} maintenance visit(s) scheduled).`,
      NotificationType.TASK,
      "ORDER",
      params.orderId
    );
    await this.inApp(
      params.gardenerUserId,
      "New maintenance schedule",
      `You were assigned to order ${params.orderNumber} with ${params.tasksCreated} visit(s).`,
      NotificationType.TASK,
      "ORDER",
      params.orderId
    );
  }

  async notifyOrderStatusUpdate(params: {
    orderId: string;
    orderNumber: string;
    customerUserId: string;
    status: string;
  }) {
    await this.inApp(
      params.customerUserId,
      "Order status updated",
      `Your order ${params.orderNumber} is now ${params.status}.`,
      NotificationType.ORDER,
      "ORDER",
      params.orderId
    );
  }
}
