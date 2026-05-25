import { Injectable, NotFoundException } from "@nestjs/common";
import {
  PaymentStatus,
  PaymentType,
  Prisma,
  RentalStatus,
  TaskStatus,
  TaskType,
  TransactionStatus,
} from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { resolveOrderId } from "src/common/contract/resolve-entity";
import {
  ExtensionInput,
  RentalExtensionPolicyService,
} from "./rental-extension-policy.service";
import { DomainNotificationsService } from "../notifications/domain-notifications.service";

@Injectable()
export class RentalExtensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: RentalExtensionPolicyService,
    private readonly domainNotifications: DomainNotificationsService
  ) {}

  async extendForUser(
    userId: string,
    orderIdOrNum: string,
    orderItemId: string,
    input: ExtensionInput
  ) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw new NotFoundException("Order not found");

    const { order, orderItem, validated } = await this.policy.validateExtension({
      userId,
      orderId: oid,
      orderItemId,
      input,
    });

    const extension = await this.prisma.$transaction(async (tx) => {
      const ext = await tx.rentalExtension.create({
        data: {
          orderItemId: orderItem.id,
          originalEndDate: validated.originalEndDate,
          newEndDate: validated.newEndDate,
          extensionPrice: validated.extensionPrice,
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: {
          rentEndDate: validated.newEndDate,
          rentalStatus: RentalStatus.EXTENDED,
          extensionCount: { increment: 1 },
        },
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          userId,
          amount: validated.extensionPrice,
          paymentType: PaymentType.RENTAL_EXTENSION,
          paymentMethod: order.paymentMethod || "ONLINE",
          status: TransactionStatus.PENDING,
          metadata: {
            rental_extension_id: ext.id,
            parent_order_id: order.id,
            order_item_id: orderItem.id,
          },
        },
      });

      await this.rescheduleMaintenanceInTx(
        tx,
        orderItem.id,
        validated.originalEndDate,
        validated.newEndDate
      );

      return ext;
    });

    await this.domainNotifications.notifyRentalExtension({
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderItemId: orderItem.id,
      nurseryId: order.nurseryId,
      customerUserId: userId,
      newEndDate: validated.newEndDate,
      amount: Number(validated.extensionPrice),
    });

    return {
      extension,
      payment_required: true,
      amount: Number(validated.extensionPrice),
      rental_extension_id: extension.id,
      new_end_date: validated.newEndDate.toISOString().slice(0, 10),
      message:
        "Pay via POST /api/v1/payments/initiate with payment_for RENTAL_EXTENSION and reference_id = rental_extension_id",
    };
  }

  /** Legacy rentals route: order item id is the path :id param. */
  async extendByOrderItemId(
    orderItemId: string,
    userId: string,
    input: ExtensionInput
  ) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: orderItemId, order: { userId } },
      select: { orderId: true, order: { select: { orderNumber: true } } },
    });
    if (!item) throw new NotFoundException("Rental not found");
    return this.extendForUser(userId, item.orderId, orderItemId, input);
  }

  private async rescheduleMaintenanceInTx(
    tx: Prisma.TransactionClient,
    orderItemId: string,
    originalEndDate: Date,
    newEndDate: Date
  ) {
    const tasks = await tx.maintenanceTask.findMany({
      where: {
        orderItemId,
        taskType: TaskType.SCHEDULED_MAINTENANCE,
      },
      orderBy: { scheduledDate: "asc" },
    });
    if (tasks.length === 0) return;

    const dates = tasks.map((t) => new Date(t.scheduledDate).getTime());
    let intervalDays = 7;
    if (dates.length >= 2) {
      intervalDays = Math.max(
        1,
        Math.round((dates[1] - dates[0]) / (1000 * 60 * 60 * 24))
      );
    }

    const origEnd = new Date(originalEndDate);
    origEnd.setUTCHours(0, 0, 0, 0);

    await tx.maintenanceTask.deleteMany({
      where: {
        orderItemId,
        taskType: TaskType.SCHEDULED_MAINTENANCE,
        status: TaskStatus.PENDING,
        scheduledDate: { gt: origEnd },
      },
    });

    const template = tasks[0];
    let cursor = new Date(origEnd);
    cursor.setUTCDate(cursor.getUTCDate() + intervalDays);
    const end = new Date(newEndDate);
    end.setUTCHours(0, 0, 0, 0);
    let counter = tasks.length + 1;

    const newTasks: Parameters<typeof tx.maintenanceTask.createMany>[0]["data"] = [];
    while (cursor <= end) {
      newTasks.push({
        taskNumber: `TASK-${Date.now()}-${counter++}`,
        orderItemId,
        gardenerId: template.gardenerId,
        nurseryId: template.nurseryId,
        userId: template.userId,
        addressId: template.addressId,
        taskType: TaskType.SCHEDULED_MAINTENANCE,
        description: template.description,
        scheduledDate: new Date(cursor),
        scheduledTime: template.scheduledTime,
        status: TaskStatus.PENDING,
        priority: template.priority,
      });
      cursor.setUTCDate(cursor.getUTCDate() + intervalDays);
    }

    if (newTasks.length > 0) {
      await tx.maintenanceTask.createMany({ data: newTasks });
    }
  }
}
