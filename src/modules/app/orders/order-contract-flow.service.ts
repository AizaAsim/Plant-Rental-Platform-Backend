import { HttpStatus, Injectable } from "@nestjs/common";
import { OrderStatus, PaymentStatus, RentalStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk, contractPublicId, contractFail } from "src/common/contract/response";
import { ContractErrorCode } from "src/common/contract/error-codes";
import { resolveOrderId } from "src/common/contract/resolve-entity";

type Slot = { id: string; date: string; time_from: string; time_to: string };

@Injectable()
export class OrderContractFlowService {
  constructor(private readonly prisma: PrismaService) {}

  private getMeta(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
    return {};
  }

  async customerDeliveryResponse(userId: string, orderIdOrNum: string, body: Record<string, unknown>) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const order = await this.prisma.order.findFirst({ where: { id: oid, userId } });
    if (!order) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);

    const meta = this.getMeta(order.workflowMeta);
    const action = String(body.action ?? "");
    if (action === "CONFIRM") {
      const slotId = String(body.selected_slot_id ?? "");
      const proposed = (((meta.delivery as Record<string, unknown>)?.proposed as Slot[]) ?? []) as Slot[];
      const found = proposed.find((s) => s.id === slotId);
      if (!found) {
        throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Unknown selected_slot_id", HttpStatus.BAD_REQUEST);
      }
      meta.selectedDeliverySlotId = slotId;
      (meta.delivery as Record<string, unknown>) = { ...(meta.delivery as object as Record<string, unknown>), selected: found };
      const paymentDone = order.paymentStatus === PaymentStatus.PAID;
      const awaitingPayAfterSlot =
        (order.status === OrderStatus.SLOT_PROPOSED || order.status === OrderStatus.PROCESSING) && !paymentDone;
      if (awaitingPayAfterSlot) {
        const updated = await this.prisma.order.update({
          where: { id: oid },
          data: { workflowMeta: meta as object, status: OrderStatus.CONFIRMED },
        });
        return contractOk({
          order_id: updated.orderNumber,
          status: "SLOT_CONFIRMED",
          selected_slot_id: slotId,
          order_status: OrderStatus.CONFIRMED,
          awaits_payment: true,
        });
      }
      const updated = await this.prisma.order.update({
        where: { id: oid },
        data: { workflowMeta: meta as object, status: OrderStatus.OUT_FOR_DELIVERY },
      });
      return contractOk({
        order_id: updated.orderNumber,
        status: "SLOT_CONFIRMED",
        selected_slot_id: slotId,
        order_status: OrderStatus.OUT_FOR_DELIVERY,
      });
    }
    if (action === "REQUEST_DIFFERENT_TIME") {
      meta.customerDeliveryPreference = {
        preferred_date: body.preferred_date,
        preferred_time_from: body.preferred_time_from,
        preferred_time_to: body.preferred_time_to,
        note: body.note,
      };
      await this.prisma.order.update({ where: { id: oid }, data: { workflowMeta: meta as object } });
      return contractOk({ order_id: order.orderNumber, status: "RESCHEDULE_REQUESTED" });
    }
    throw contractFail(ContractErrorCode.VALIDATION_ERROR, "Invalid action", HttpStatus.BAD_REQUEST);
  }

  async vendorProposeDeliverySlots(vendorUserId: string, orderIdOrNum: string, body: Record<string, unknown>) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const order = await this.ordersForVendor(vendorUserId, oid);
    if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.SLOT_PROPOSED) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "Order must be CONFIRMED (vendor-approved) or SLOT_PROPOSED to propose or update delivery slots",
        HttpStatus.BAD_REQUEST
      );
    }
    const slots = (Array.isArray(body.delivery_slots) ? body.delivery_slots : []) as Record<string, unknown>[];
    const proposed: Slot[] = slots.map((s) => ({
      id: contractPublicId("SLOT"),
      date: String(s.date ?? ""),
      time_from: String(s.time_from ?? ""),
      time_to: String(s.time_to ?? ""),
    }));
    if (proposed.length === 0) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "delivery_slots must contain at least one slot",
        HttpStatus.BAD_REQUEST
      );
    }
    const meta = this.getMeta(order.workflowMeta);
    meta.delivery = { proposed, note: body.note != null ? String(body.note) : undefined };
    await this.prisma.order.update({
      where: { id: oid },
      data: { workflowMeta: meta as object, status: OrderStatus.SLOT_PROPOSED },
    });
    return contractOk({
      order_id: order.orderNumber,
      status: OrderStatus.SLOT_PROPOSED,
      proposed_slots: proposed,
    });
  }

  async vendorInitiateReturn(vendorUserId: string, orderIdOrNum: string, body: Record<string, unknown>) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const order = await this.ordersForVendor(vendorUserId, oid);
    const slots = (Array.isArray(body.pickup_slots) ? body.pickup_slots : []) as Record<string, unknown>[];
    const proposed: Slot[] = slots.map((s) => ({
      id: contractPublicId("SLOT-RET"),
      date: String(s.date ?? ""),
      time_from: String(s.time_from ?? ""),
      time_to: String(s.time_to ?? ""),
    }));
    const meta = this.getMeta(order.workflowMeta);
    meta.return = {
      proposed,
      assigned_staff_gardener_id: body.assigned_staff_gardener_id,
      notes: body.notes != null ? String(body.notes) : undefined,
    };
    await this.prisma.order.update({ where: { id: oid }, data: { workflowMeta: meta as object } });
    return contractOk({ order_id: order.orderNumber, pickup_slots: proposed });
  }

  async customerReturnResponse(userId: string, orderIdOrNum: string, body: Record<string, unknown>) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const order = await this.prisma.order.findFirst({ where: { id: oid, userId } });
    if (!order) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const meta = this.getMeta(order.workflowMeta);
    const action = String(body.action ?? "");
    if (action === "CONFIRM") {
      const slotId = String(body.pickup_slot_id ?? "");
      const proposed = (((meta.return as Record<string, unknown>)?.proposed as Slot[]) ?? []) as Slot[];
      const found = proposed.find((s) => s.id === slotId);
      if (!found) {
        throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Unknown pickup_slot_id", HttpStatus.BAD_REQUEST);
      }
      (meta.return as Record<string, unknown>) = { ...(meta.return as object as Record<string, unknown>), selected: found };
      meta.selectedReturnSlotId = slotId;
      await this.prisma.order.update({ where: { id: oid }, data: { workflowMeta: meta as object } });
      return contractOk({ order_id: order.orderNumber, pickup_slot_id: slotId, status: "RETURN_SLOT_CONFIRMED" });
    }
    if (action === "REQUEST_DIFFERENT_TIME") {
      meta.customerReturnPreference = {
        preferred_date: body.preferred_date,
        preferred_time_from: body.preferred_time_from,
        preferred_time_to: body.preferred_time_to,
        note: body.note,
      };
      await this.prisma.order.update({ where: { id: oid }, data: { workflowMeta: meta as object } });
      return contractOk({ order_id: order.orderNumber, status: "RETURN_RESCHEDULE_REQUESTED" });
    }
    throw contractFail(ContractErrorCode.VALIDATION_ERROR, "Invalid action", HttpStatus.BAD_REQUEST);
  }

  async vendorCompleteReturn(
    vendorUserId: string,
    orderIdOrNum: string,
    body: Record<string, unknown>
  ) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const order = await this.ordersForVendor(vendorUserId, oid);
    const items = (Array.isArray(body.items) ? body.items : []) as Record<string, unknown>[];
    let restocked = 0;
    let damaged = 0;
    for (const it of items) {
      const itemId = String(it.order_item_id ?? "");
      const restock = Boolean(it.restock);
      const condition = String(it.condition ?? "GOOD");
      if (condition !== "GOOD") damaged += 1;
      else if (restock) restocked += 1;
      const oi = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId: oid } });
      if (oi) {
        await this.prisma.orderItem.update({
          where: { id: oi.id },
          data: {
            rentalStatus: RentalStatus.RETURNED,
            actualReturnDate: new Date(String(body.collection_date ?? new Date().toISOString().slice(0, 10))),
          },
        });
        if (restock) {
          await this.prisma.plant.update({
            where: { id: oi.plantId },
            data: { stockQuantity: { increment: oi.quantity } },
          });
        }
      }
    }
    await this.prisma.order.update({
      where: { id: oid },
      data: { status: OrderStatus.COMPLETED },
    });
    return contractOk({
      order_id: order.orderNumber,
      status: "COMPLETED",
      restocked_items: restocked,
      damaged_items: damaged,
    });
  }

  async getPenalty(userId: string, orderIdOrNum: string) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const order = await this.prisma.order.findFirst({ where: { id: oid, userId } });
    if (!order) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    let row = await this.prisma.orderPenalty.findUnique({ where: { orderId: oid } });
    if (!row) {
      row = await this.prisma.orderPenalty.create({
        data: {
          orderId: oid,
          overdueDays: 0,
          runningTotal: new Decimal(0),
        },
      });
    }
    return contractOk({
      order_id: order.orderNumber,
      overdue_days: row.overdueDays,
      avg_daily_rate: row.avgDailyRate != null ? Number(row.avgDailyRate) : null,
      penalty_multiplier: row.penaltyMultiplier != null ? Number(row.penaltyMultiplier) : null,
      running_penalty_total: Number(row.runningTotal),
      penalty_payment_status: row.payStatus,
    });
  }

  async finalizePenalty(userId: string, orderIdOrNum: string, body: Record<string, unknown>) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const order = await this.prisma.order.findFirst({ where: { id: oid, userId } });
    if (!order) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const row = await this.prisma.orderPenalty.upsert({
      where: { orderId: oid },
      create: {
        orderId: oid,
        overdueDays: 0,
        runningTotal: new Decimal(0),
        meta: body as object,
      },
      update: {
        meta: body as object,
        payStatus: "PENDING",
      },
    });
    return contractOk({
      order_id: order.orderNumber,
      overdue_days: row.overdueDays,
      penalty_total: Number(row.runningTotal),
      penalty_payment_status: row.payStatus,
    });
  }

  private async ordersForVendor(vendorUserId: string, orderId: string) {
    const nursery = await this.prisma.nursery.findUnique({ where: { vendorId: vendorUserId } });
    if (!nursery) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Nursery not found", HttpStatus.NOT_FOUND);
    const order = await this.prisma.order.findFirst({ where: { id: orderId, nurseryId: nursery.id } });
    if (!order) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    return order;
  }
}
