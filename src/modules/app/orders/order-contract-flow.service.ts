import { HttpStatus, Injectable } from "@nestjs/common";
import { OrderStatus, OrderType, PaymentStatus, Prisma, RentalStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk, contractPublicId, contractFail } from "src/common/contract/response";
import { ContractErrorCode } from "src/common/contract/error-codes";
import { resolveOrderId } from "src/common/contract/resolve-entity";
import {
  FULFILLMENT_LINE_CONDITIONS,
  tryFulfillmentLineCondition,
} from "./fulfillment-line.constants";
import { PenaltyService } from "./penalty.service";
import { PlantInventoryService } from "../inventory/plant-inventory.service";

type Slot = { id: string; date: string; time_from: string; time_to: string };

export type GardenerProposalStored = {
  proposal_id: string;
  gardener_id: string;
  kind: "NURSERY_STAFF" | "FREELANCE";
  note?: string;
};

@Injectable()
export class OrderContractFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly penaltyService: PenaltyService,
    private readonly plantInventory: PlantInventoryService
  ) {}

  private getMeta(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
    return {};
  }

  /** Validates optional gardener hints: nursery staff must belong to order nursery; freelancers must have isFreelancer. */
  private async buildGardenerProposals(
    nurseryId: string,
    raw: unknown
  ): Promise<GardenerProposalStored[]> {
    if (raw == null) return [];
    if (!Array.isArray(raw)) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "gardener_proposals must be an array when provided",
        HttpStatus.BAD_REQUEST
      );
    }
    const out: GardenerProposalStored[] = [];
    for (const row of raw as Record<string, unknown>[]) {
      const gardenerId = String(row.gardener_id ?? "").trim();
      if (!gardenerId) {
        throw contractFail(ContractErrorCode.VALIDATION_ERROR, "gardener_id required in gardener_proposals", HttpStatus.BAD_REQUEST);
      }
      const kindRaw = String(row.kind ?? "NURSERY_STAFF").toUpperCase().replace(/-/g, "_");
      let kind: "NURSERY_STAFF" | "FREELANCE" = "NURSERY_STAFF";
      if (kindRaw === "FREELANCE" || kindRaw === "FREELANCER") kind = "FREELANCE";
      else if (kindRaw === "NURSERY_STAFF" || kindRaw === "STAFF" || kindRaw === "NURSERY") kind = "NURSERY_STAFF";
      else {
        throw contractFail(
          ContractErrorCode.VALIDATION_ERROR,
          "kind must be NURSERY_STAFF or FREELANCE",
          HttpStatus.BAD_REQUEST
        );
      }

      const g = await this.prisma.gardener.findUnique({ where: { id: gardenerId } });
      if (!g || g.deactivatedAt) {
        throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, `Gardener not found: ${gardenerId}`, HttpStatus.BAD_REQUEST);
      }
      if (kind === "NURSERY_STAFF") {
        if (g.nurseryId !== nurseryId) {
          throw contractFail(
            ContractErrorCode.VALIDATION_ERROR,
            "NURSERY_STAFF gardener must belong to this order's nursery",
            HttpStatus.BAD_REQUEST
          );
        }
      } else {
        if (!g.isFreelancer) {
          throw contractFail(
            ContractErrorCode.VALIDATION_ERROR,
            "FREELANCE proposals require a freelancer gardener (is_freelancer)",
            HttpStatus.BAD_REQUEST
          );
        }
      }
      out.push({
        proposal_id: contractPublicId("GPROP"),
        gardener_id: gardenerId,
        kind,
        note: row.note != null ? String(row.note) : undefined,
      });
    }
    return out;
  }

  private applyGardenerSelectionToMeta(
    meta: Record<string, unknown>,
    body: Record<string, unknown>
  ): void {
    const delivery = meta.delivery as Record<string, unknown> | undefined;
    const gprops = (delivery?.gardener_proposals as GardenerProposalStored[]) ?? [];
    if (gprops.length === 0) return;

    const skip = body.skip_gardener_selection === true;
    let proposalId = String(body.selected_gardener_proposal_id ?? "").trim();
    if (!proposalId && body.selected_gardener_id != null) {
      const gid = String(body.selected_gardener_id).trim();
      const matches = gprops.filter((p) => p.gardener_id === gid);
      if (matches.length === 1) proposalId = matches[0].proposal_id;
      else if (matches.length > 1) {
        throw contractFail(
          ContractErrorCode.VALIDATION_ERROR,
          "Ambiguous selected_gardener_id; use selected_gardener_proposal_id",
          HttpStatus.BAD_REQUEST
        );
      }
    }

    if (!skip && !proposalId) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "When gardener_proposals are present: send selected_gardener_proposal_id (or selected_gardener_id if unique), or skip_gardener_selection: true",
        HttpStatus.BAD_REQUEST
      );
    }
    if (skip && proposalId) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "Do not send selected_gardener_proposal_id when skip_gardener_selection is true",
        HttpStatus.BAD_REQUEST
      );
    }

    if (skip) {
      meta.gardenerSelectionSkipped = true;
      return;
    }
    const chosen = gprops.find((p) => p.proposal_id === proposalId);
    if (!chosen) {
      throw contractFail(
        ContractErrorCode.RESOURCE_NOT_FOUND,
        "selected_gardener_proposal_id does not match vendor proposals",
        HttpStatus.BAD_REQUEST
      );
    }
    meta.selectedGardenerProposalId = chosen.proposal_id;
    meta.selectedGardenerId = chosen.gardener_id;
    if (delivery) {
      delivery.selected_gardener = chosen;
      meta.delivery = delivery;
    }
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
      this.applyGardenerSelectionToMeta(meta, body);
      const paymentDone = order.paymentStatus === PaymentStatus.PAID;
      const awaitingPayAfterSlot = order.status === OrderStatus.SLOT_PROPOSED && !paymentDone;
      if (awaitingPayAfterSlot) {
        const payHours = Number(process.env.ORDER_PAYMENT_WINDOW_TTL_HOURS ?? 6);
        meta.paymentWindowExpiresAt = new Date(Date.now() + payHours * 3600000).toISOString();
        const updated = await this.prisma.order.update({
          where: { id: oid },
          data: { workflowMeta: meta as object, status: OrderStatus.SLOT_CONFIRMED },
        });
        return contractOk({
          order_id: updated.orderNumber,
          status: "SLOT_CONFIRMED",
          selected_slot_id: slotId,
          order_status: OrderStatus.SLOT_CONFIRMED,
          slot_lifecycle: { current: "SLOT_CONFIRMED", next: "AWAITING_PAYMENT" },
          payment_window_expires_at: meta.paymentWindowExpiresAt,
          awaits_payment: true,
          selected_gardener_proposal_id: (meta.selectedGardenerProposalId as string) ?? undefined,
          selected_gardener_id: (meta.selectedGardenerId as string) ?? undefined,
          gardener_selection_skipped: meta.gardenerSelectionSkipped === true,
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
        selected_gardener_proposal_id: (meta.selectedGardenerProposalId as string) ?? undefined,
        selected_gardener_id: (meta.selectedGardenerId as string) ?? undefined,
        gardener_selection_skipped: meta.gardenerSelectionSkipped === true,
      });
    }
    if (action === "REQUEST_DIFFERENT_GARDENER") {
      const meta = this.getMeta(order.workflowMeta);
      meta.customerGardenerPreference = {
        note: body.note,
        preferred_freelance_filters: body.preferred_freelance_filters,
      };
      await this.prisma.order.update({ where: { id: oid }, data: { workflowMeta: meta as object } });
      return contractOk({
        order_id: order.orderNumber,
        status: "GARDENER_PREFERENCE_RECORDED",
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
    const slotTtlHours = Number(
      body.slot_ttl_hours ?? process.env.ORDER_SLOT_TTL_HOURS ?? 6
    );
    const slotExpiresAt = new Date(Date.now() + slotTtlHours * 3600000).toISOString();
    const gardenerProposals = await this.buildGardenerProposals(order.nurseryId, body.gardener_proposals);
    meta.delivery = {
      proposed,
      note: body.note != null ? String(body.note) : undefined,
      slotExpiresAt,
      ...(gardenerProposals.length > 0 ? { gardener_proposals: gardenerProposals } : {}),
    };
    await this.prisma.order.update({
      where: { id: oid },
      data: { workflowMeta: meta as object, status: OrderStatus.SLOT_PROPOSED },
    });
    return contractOk({
      order_id: order.orderNumber,
      status: OrderStatus.SLOT_PROPOSED,
      proposed_slots: proposed,
      gardener_proposals: gardenerProposals,
      slot_expires_at: slotExpiresAt,
      slot_ttl_hours: slotTtlHours,
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
    const bodyItems = (Array.isArray(body.items) ? body.items : []) as Record<string, unknown>[];
    if (bodyItems.length === 0) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "items[] is required with one object per pending rental line",
        HttpStatus.BAD_REQUEST
      );
    }

    const pending = await this.prisma.orderItem.findMany({
      where: {
        orderId: oid,
        orderType: OrderType.RENT,
        rentalStatus: { not: RentalStatus.RETURNED },
      },
    });
    if (pending.length === 0) {
      throw contractFail(
        ContractErrorCode.INVALID_STATE_TRANSITION,
        "No rental lines are pending return for this order",
        HttpStatus.BAD_REQUEST
      );
    }
    if (bodyItems.length !== pending.length) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        `items[] must contain exactly ${pending.length} pending rental line(s)`,
        HttpStatus.BAD_REQUEST
      );
    }

    const pendingIds = new Set(pending.map((p) => p.id));
    const seenIds = new Set<string>();
    for (const row of bodyItems) {
      const id = String(row.order_item_id ?? "");
      if (!pendingIds.has(id) || seenIds.has(id)) {
        throw contractFail(
          ContractErrorCode.VALIDATION_ERROR,
          "Each items[].order_item_id must identify a pending rental line exactly once",
          HttpStatus.BAD_REQUEST
        );
      }
      seenIds.add(id);
    }

    const rawCollectionDate = body.collection_date;
    if (rawCollectionDate == null || String(rawCollectionDate).trim() === "") {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "collection_date is required (YYYY-MM-DD or ISO date)",
        HttpStatus.BAD_REQUEST
      );
    }
    const collectionDay = new Date(String(rawCollectionDate));
    if (Number.isNaN(collectionDay.getTime())) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "collection_date is not a valid calendar date",
        HttpStatus.BAD_REQUEST
      );
    }

    const defaultProofAt = ((): Date => {
      const raw = body.collection_proof_at;
      if (raw == null || String(raw).trim() === "") return new Date();
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) {
        throw contractFail(
          ContractErrorCode.VALIDATION_ERROR,
          "collection_proof_at must be a valid ISO date-time when provided",
          HttpStatus.BAD_REQUEST
        );
      }
      return d;
    })();

    const coerceProofUrls = (raw: unknown): Prisma.InputJsonValue | undefined => {
      if (raw == null) return undefined;
      if (!Array.isArray(raw)) {
        throw contractFail(
          ContractErrorCode.VALIDATION_ERROR,
          "proof_image_urls must be an array when provided",
          HttpStatus.BAD_REQUEST
        );
      }
      return raw as Prisma.InputJsonValue;
    };

    const parseLineProofAt = (raw: unknown): Date | undefined => {
      if (raw == null || String(raw).trim() === "") return undefined;
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) {
        throw contractFail(
          ContractErrorCode.VALIDATION_ERROR,
          "items[].proof_at must be ISO date-time when provided",
          HttpStatus.BAD_REQUEST
        );
      }
      return d;
    };

    let restockedLines = 0;
    let damagedLines = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const it of bodyItems) {
        const itemId = String(it.order_item_id ?? "");
        const oi = await tx.orderItem.findFirst({
          where: { id: itemId, orderId: oid, orderType: OrderType.RENT },
        });
        if (!oi) {
          throw contractFail(
            ContractErrorCode.RESOURCE_NOT_FOUND,
            `Order item not found: ${itemId}`,
            HttpStatus.NOT_FOUND
          );
        }
        if (oi.rentalStatus === RentalStatus.RETURNED) {
          throw contractFail(
            ContractErrorCode.INVALID_STATE_TRANSITION,
            `Line ${itemId} already returned`,
            HttpStatus.BAD_REQUEST
          );
        }

        const conditionRaw = tryFulfillmentLineCondition(it.condition);
        if (!conditionRaw) {
          throw contractFail(
            ContractErrorCode.VALIDATION_ERROR,
            `condition must be one of: ${FULFILLMENT_LINE_CONDITIONS.join(", ")}`,
            HttpStatus.BAD_REQUEST
          );
        }
        if (conditionRaw !== "GOOD") damagedLines += 1;

        const restock =
          order.inventoryDeliveredAt != null
            ? conditionRaw === "GOOD" || Boolean(it.restock)
            : Boolean(it.restock);
        if (restock) restockedLines += 1;

        const proofAt = parseLineProofAt(it.proof_at) ?? defaultProofAt;

        await tx.orderItem.update({
          where: { id: oi.id },
          data: {
            rentalStatus: RentalStatus.RETURNED,
            actualReturnDate: collectionDay,
            returnProofAt: proofAt,
            returnCondition: conditionRaw,
            returnProofUrls: coerceProofUrls(it.proof_image_urls),
            returnLineNotes: it.notes != null ? String(it.notes) : null,
            restocked: restock,
            restockedAt: restock ? new Date() : null,
          },
        });

        if (restock) {
          if (order.inventoryDeliveredAt) {
            await this.plantInventory.returnDeliveredToAvailable(tx, [
              { plantId: oi.plantId, quantity: oi.quantity, orderType: OrderType.RENT },
            ]);
          } else {
            await tx.plant.update({
              where: { id: oi.plantId },
              data: { stockQuantity: { increment: oi.quantity } },
            });
          }
        }
      }

      const stillOpen = await tx.orderItem.count({
        where: {
          orderId: oid,
          orderType: OrderType.RENT,
          rentalStatus: { not: RentalStatus.RETURNED },
        },
      });
      if (stillOpen === 0) {
        await tx.order.update({
          where: { id: oid },
          data: { status: OrderStatus.COMPLETED },
        });
      }
    });

    const refreshed = await this.prisma.order.findUnique({
      where: { id: oid },
      select: { status: true },
    });

    return contractOk({
      order_id: order.orderNumber,
      order_uuid: oid,
      order_status: refreshed?.status,
      lifecycle: refreshed?.status === OrderStatus.COMPLETED ? "FULLY_RETURNED" : "PARTIAL_RETURN",
      restocked_lines: restockedLines,
      damaged_or_flagged_lines: damagedLines,
    });
  }

  async getPenalty(userId: string, orderIdOrNum: string) {
    const data = await this.penaltyService.getPenaltyForUser(userId, orderIdOrNum);
    return contractOk(data);
  }

  async finalizePenalty(userId: string, orderIdOrNum: string, body: Record<string, unknown>) {
    const oid = await resolveOrderId(this.prisma, orderIdOrNum);
    if (!oid) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    const order = await this.prisma.order.findFirst({ where: { id: oid, userId } });
    if (!order) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Order not found", HttpStatus.NOT_FOUND);
    await this.penaltyService.syncPenaltyForOrder(oid, false);
    const row = await this.prisma.orderPenalty.upsert({
      where: { orderId: oid },
      create: {
        orderId: oid,
        meta: body as object,
      },
      update: { meta: body as object },
    });
    return contractOk({
      order_id: order.orderNumber,
      overdue_days: row.overdueDays,
      penalty_total: Number(row.runningTotal),
      penalty_payment_status: row.payStatus,
      payment_for: "PENALTY",
      reference_id: oid,
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
