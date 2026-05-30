import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  NotificationType,
  OrderStatus,
  OrderType,
  PickupRequestStatus,
  RentalStatus,
  TaskStatus,
  TaskType,
  UserRole,
} from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { resolveOrderId } from "src/common/contract/resolve-entity";
import {
  FULFILLMENT_LINE_CONDITIONS,
  tryFulfillmentLineCondition,
} from "./fulfillment-line.constants";

@Injectable()
export class PickupFlowService {
  constructor(private readonly prisma: PrismaService) {}

  private coerceProofUrls(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((u) => String(u)).filter(Boolean);
  }

  /** POST /orders/:order_id/pickup-request */
  async createPickupRequest(
    userId: string,
    orderIdOrNum: string,
    body: {
      order_item_id: string;
      requested_pickup_date: string;
      preferred_time_from: string;
      preferred_time_to: string;
      notes?: string;
    }
  ) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw new NotFoundException("Order not found");

    const order = await this.prisma.order.findFirst({
      where: { id: oid, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    const item = order.items.find((i) => i.id === body.order_item_id);
    if (!item || item.orderType !== OrderType.RENT) {
      throw new BadRequestException("Invalid rental order item");
    }

    const eligible: RentalStatus[] = [
      RentalStatus.ACTIVE,
      RentalStatus.EXTENDED,
      RentalStatus.OVERDUE,
    ];
    if (!item.rentalStatus || !eligible.includes(item.rentalStatus)) {
      throw new BadRequestException(
        "Pickup can only be requested for ACTIVE, EXTENDED, or OVERDUE rentals"
      );
    }

    const pickupDate = new Date(body.requested_pickup_date);
    if (Number.isNaN(pickupDate.getTime())) {
      throw new BadRequestException("requested_pickup_date must be a valid date");
    }

    const existing = await this.prisma.pickupRequest.findFirst({
      where: {
        orderItemId: item.id,
        status: { in: [PickupRequestStatus.REQUESTED, PickupRequestStatus.SCHEDULED] },
      },
    });
    if (existing) {
      throw new BadRequestException("A pickup request is already open for this rental line");
    }

    const [pickupRequest, updatedItem] = await this.prisma.$transaction(async (tx) => {
      const pr = await tx.pickupRequest.create({
        data: {
          orderId: oid,
          orderItemId: item.id,
          userId,
          requestedPickupDate: pickupDate,
          preferredTimeFrom: body.preferred_time_from,
          preferredTimeTo: body.preferred_time_to,
          notes: body.notes?.trim() || null,
        },
      });
      const oi = await tx.orderItem.update({
        where: { id: item.id },
        data: { rentalStatus: RentalStatus.PICKUP_PENDING },
      });
      return [pr, oi] as const;
    });

    const nursery = await this.prisma.nursery.findUnique({
      where: { id: order.nurseryId },
      select: { vendorId: true },
    });
    if (nursery?.vendorId) {
      await this.prisma.notification.create({
        data: {
          userId: nursery.vendorId,
          title: "Pickup requested",
          message: `Customer requested pickup for order ${order.orderNumber}.`,
          type: NotificationType.ORDER,
          referenceType: "ORDER",
          referenceId: order.id,
        },
      });
    }

    return {
      order_id: order.id,
      order_item_id: updatedItem.id,
      rental_status: RentalStatus.PICKUP_PENDING,
      pickup_request_id: pickupRequest.id,
    };
  }

  /** POST /orders/vendor/orders/:order_id/assign-pickup */
  async assignPickup(
    vendorUserId: string,
    orderIdOrNum: string,
    body: {
      assigned_gardener_ids: string[];
      pickup_date: string;
      time_from: string;
      time_to: string;
      instructions?: string;
    }
  ) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId: vendorUserId } });
    if (!nursery) throw new NotFoundException("Nursery not found");

    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw new NotFoundException("Order not found");

    const order = await this.prisma.order.findFirst({
      where: { id: oid, nurseryId: nursery.id },
      include: { items: true, deliveryAddress: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    const gardenerIds = body.assigned_gardener_ids ?? [];
    if (!Array.isArray(gardenerIds) || gardenerIds.length === 0) {
      throw new BadRequestException("assigned_gardener_ids must contain at least one gardener");
    }

    const gardeners = await this.prisma.gardener.findMany({
      where: { id: { in: gardenerIds }, nurseryId: nursery.id, deactivatedAt: null },
      include: { user: { select: { id: true } } },
    });
    if (gardeners.length !== gardenerIds.length) {
      throw new BadRequestException("One or more gardeners are invalid for this nursery");
    }

    const pickupDate = new Date(body.pickup_date);
    if (Number.isNaN(pickupDate.getTime())) {
      throw new BadRequestException("pickup_date must be a valid date");
    }

    const pendingLines = order.items.filter(
      (i) => i.orderType === OrderType.RENT && i.rentalStatus === RentalStatus.PICKUP_PENDING
    );
    if (pendingLines.length === 0) {
      throw new BadRequestException("No rental lines are in PICKUP_PENDING state");
    }

    const primaryGardener = gardeners[0];
    const taskNumber = `TSK-PICK-${Date.now()}`;

    const task = await this.prisma.maintenanceTask.create({
      data: {
        taskNumber,
        orderItemId: pendingLines[0].id,
        nurseryId: nursery.id,
        gardenerId: primaryGardener.id,
        userId: order.userId,
        taskType: TaskType.PICKUP,
        scheduledDate: pickupDate,
        scheduledTime: `${body.time_from}-${body.time_to}`,
        addressId: order.deliveryAddressId,
        status: TaskStatus.ASSIGNED,
        description: body.instructions?.trim() || "Pickup assigned by vendor",
      },
    });

    await this.prisma.pickupRequest.updateMany({
      where: {
        orderId: oid,
        status: { in: [PickupRequestStatus.REQUESTED, PickupRequestStatus.SCHEDULED] },
      },
      data: {
        status: PickupRequestStatus.SCHEDULED,
        assignedGardenerIds: gardenerIds,
        pickupTaskId: task.id,
      },
    });

    for (const g of gardeners) {
      await this.prisma.notification.create({
        data: {
          userId: g.user.id,
          title: "Pickup task assigned",
          message: `Pickup scheduled for order ${order.orderNumber} on ${body.pickup_date}.`,
          type: NotificationType.TASK,
          referenceType: "TASK",
          referenceId: task.id,
        },
      });
    }

    return {
      order_id: order.id,
      pickup_task_id: task.id,
      rental_status: RentalStatus.PICKUP_PENDING,
      assigned_gardener_ids: gardenerIds,
    };
  }

  /** POST /orders/vendor/orders/:order_id/complete-pickup */
  async completePickup(
    actorUserId: string,
    actorRole: UserRole,
    orderIdOrNum: string,
    body: {
      gardener_id?: string;
      collection_date: string;
      notes?: string;
      items: {
        order_item_id: string;
        condition: string;
        restock_inventory?: boolean;
        proof_image_urls?: string[];
      }[];
    }
  ) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw new NotFoundException("Order not found");

    let nurseryId: string | null = null;
    if (actorRole === UserRole.VENDOR) {
      const nursery = await this.prisma.nursery.findUnique({ where: { vendorId: actorUserId } });
      if (!nursery) throw new NotFoundException("Nursery not found");
      nurseryId = nursery.id;
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: oid,
        ...(nurseryId ? { nurseryId } : {}),
      },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    if (actorRole === UserRole.GARDENER) {
      const gardener = await this.prisma.gardener.findUnique({ where: { userId: actorUserId } });
      if (!gardener || body.gardener_id !== gardener.id) {
        throw new ForbiddenException("Gardener can only complete assigned pickup");
      }
    }

    const pending = order.items.filter(
      (i) =>
        i.orderType === OrderType.RENT &&
        (i.rentalStatus === RentalStatus.PICKUP_PENDING || i.rentalStatus === RentalStatus.ACTIVE)
    );
    if (body.items.length !== pending.length) {
      throw new BadRequestException(
        `items[] must include exactly ${pending.length} pending rental line(s)`
      );
    }

    const collectionDay = new Date(body.collection_date);
    if (Number.isNaN(collectionDay.getTime())) {
      throw new BadRequestException("collection_date must be a valid date");
    }

    const restocked: { plant_id: string; quantity: number }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const it of body.items) {
        const oi = order.items.find((x) => x.id === it.order_item_id);
        if (!oi) throw new BadRequestException(`Unknown order_item_id: ${it.order_item_id}`);

        const cond = tryFulfillmentLineCondition(it.condition);
        if (!cond) {
          throw new BadRequestException(
            `condition must be one of: ${FULFILLMENT_LINE_CONDITIONS.join(", ")}`
          );
        }

        const restock =
          it.restock_inventory !== false && (cond === "GOOD" || Boolean(it.restock_inventory));

        await tx.orderItem.update({
          where: { id: oi.id },
          data: {
            rentalStatus: RentalStatus.RETURNED,
            actualReturnDate: collectionDay,
            returnCondition: cond,
            returnProofUrls: this.coerceProofUrls(it.proof_image_urls),
            returnLineNotes: body.notes ?? null,
            restocked: restock,
            restockedAt: restock ? new Date() : null,
          },
        });

        if (restock) {
          await tx.plant.update({
            where: { id: oi.plantId },
            data: { stockQuantity: { increment: oi.quantity } },
          });
          restocked.push({ plant_id: oi.plantId, quantity: oi.quantity });
        }
      }

      await tx.pickupRequest.updateMany({
        where: { orderId: oid, status: { not: PickupRequestStatus.COMPLETED } },
        data: { status: PickupRequestStatus.COMPLETED },
      });

      await tx.order.update({
        where: { id: oid },
        data: { status: OrderStatus.COMPLETED },
      });

      await tx.maintenanceTask.updateMany({
        where: { orderItemId: { in: pending.map((p) => p.id) }, status: { not: TaskStatus.COMPLETED } },
        data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
      });
    });

    await this.prisma.notification.create({
      data: {
        userId: order.userId,
        title: "Pickup completed",
        message: `Your rental order ${order.orderNumber} has been completed.`,
        type: NotificationType.RENTAL,
        referenceType: "ORDER",
        referenceId: order.id,
      },
    });

    if (nurseryId) {
      const nursery = await this.prisma.nursery.findUnique({
        where: { id: nurseryId },
        select: { vendorId: true },
      });
      if (nursery?.vendorId) {
        await this.prisma.notification.create({
          data: {
            userId: nursery.vendorId,
            title: "Pickup completed",
            message: `Pickup completed for order ${order.orderNumber}.`,
            type: NotificationType.ORDER,
            referenceType: "ORDER",
            referenceId: order.id,
          },
        });
      }
    }

    return {
      order_id: order.id,
      status: OrderStatus.COMPLETED,
      restocked_items: restocked,
      moved_to_order_history: true,
    };
  }
}
