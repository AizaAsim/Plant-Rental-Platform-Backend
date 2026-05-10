import type { ApiBodyOptions } from "@nestjs/swagger";

/**
 * Swagger-only bodies for workflowMeta-driving endpoints (slots, customer replies).
 * Handlers remain `Record<string, unknown>` — no change to ValidationPipe whitelist behaviour.
 */

const deliverySlotProp = {
  type: "object",
  properties: {
    date: { type: "string", description: "Calendar date ISO or YYYY-MM-DD", example: "2026-06-10" },
    time_from: { type: "string", example: "09:00" },
    time_to: { type: "string", example: "12:00" },
  },
  required: ["date", "time_from", "time_to"],
};

const gardenerProposalProp = {
  type: "object",
  properties: {
    gardener_id: { type: "string", format: "uuid", description: "Gardener row id" },
    kind: {
      type: "string",
      enum: ["NURSERY_STAFF", "FREELANCE"],
      description: "Staff must belong to order nursery; FREELANCE requires is_freelancer",
    },
    note: { type: "string" },
  },
  required: ["gardener_id", "kind"],
};

export const proposeDeliverySlotsApiBody: ApiBodyOptions = {
  description:
    "Merges into `order.workflowMeta.delivery`: server assigns each slot an `id` (SLOT-…). " +
    "Sets `status` → SLOT_PROPOSED. Optional `gardener_proposals[]` stored under `workflowMeta.delivery.gardener_proposals` " +
    "with server-generated `proposal_id` (GPROP-…). `slot_ttl_hours` defaults from env ORDER_SLOT_TTL_HOURS.",
  schema: {
    type: "object",
    required: ["delivery_slots"],
    properties: {
      delivery_slots: { type: "array", minItems: 1, items: deliverySlotProp },
      note: { type: "string" },
      slot_ttl_hours: { type: "number", example: 6 },
      gardener_proposals: { type: "array", items: gardenerProposalProp },
    },
  },
  examples: {
    slotsOnly: {
      summary: "Slots only",
      value: {
        delivery_slots: [{ date: "2026-06-10", time_from: "09:00", time_to: "12:00" }],
        note: "Morning preferred",
        slot_ttl_hours: 6,
      },
    },
    withGardenerOptions: {
      summary: "Slots + optional gardener choices",
      value: {
        delivery_slots: [
          { date: "2026-06-10", time_from: "09:00", time_to: "12:00" },
          { date: "2026-06-11", time_from: "14:00", time_to: "17:00" },
        ],
        gardener_proposals: [
          { gardener_id: "00000000-0000-4000-8000-000000000001", kind: "NURSERY_STAFF", note: "Lead" },
        ],
      },
    },
  },
};

export const customerDeliveryResponseApiBody: ApiBodyOptions = {
  description:
    "Reads `workflowMeta.delivery.proposed` from the order. " +
    "CONFIRM: sets selected slot, optional gardener selection, may move to SLOT_CONFIRMED (awaiting payment) or OUT_FOR_DELIVERY depending on payment. " +
    "Other actions merge preference objects into workflowMeta.",
  schema: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: ["CONFIRM", "REQUEST_DIFFERENT_TIME", "REQUEST_DIFFERENT_GARDENER"],
      },
      selected_slot_id: {
        type: "string",
        description: "One of workflowMeta.delivery.proposed[].id (server-generated at propose)",
      },
      selected_gardener_proposal_id: {
        type: "string",
        description: "When gardener_proposals were sent — matches proposal_id (GPROP-…)",
      },
      selected_gardener_id: { type: "string", description: "Alternative if proposal unambiguous by gardener_id" },
      skip_gardener_selection: {
        type: "boolean",
        description: "If true when proposals exist — skip choosing (mutually exclusive with selected_* gardener fields)",
      },
      preferred_date: { type: "string" },
      preferred_time_from: { type: "string" },
      preferred_time_to: { type: "string" },
      note: { type: "string" },
      preferred_freelance_filters: { type: "object", additionalProperties: true },
    },
  },
  examples: {
    confirmSlot: {
      summary: "CONFIRM slot",
      value: { action: "CONFIRM", selected_slot_id: "SLOT-XXXXXXXX" },
    },
    confirmWithGardener: {
      summary: "CONFIRM + gardener proposal",
      value: {
        action: "CONFIRM",
        selected_slot_id: "SLOT-XXXXXXXX",
        selected_gardener_proposal_id: "GPROP-YYYYYYYY",
      },
    },
    differentTime: {
      summary: "REQUEST_DIFFERENT_TIME",
      value: {
        action: "REQUEST_DIFFERENT_TIME",
        preferred_date: "2026-06-15",
        preferred_time_from: "15:00",
        preferred_time_to: "18:00",
        note: "Weekday afternoons only",
      },
    },
    differentGardener: {
      summary: "REQUEST_DIFFERENT_GARDENER",
      value: {
        action: "REQUEST_DIFFERENT_GARDENER",
        note: "Prefer gardener with orchid experience",
        preferred_freelance_filters: { pincode: "560001", min_rating: 4 },
      },
    },
  },
};

export const vendorRejectOrderApiBody: ApiBodyOptions = {
  description:
    "Rejected only in pre-fulfillment states (e.g. PENDING through AWAITING_PAYMENT). Server requires a non-empty reason — " +
    "use **`reason`**, or alternatively **`rejection_reason`** / **`cancellation_reason`** (same rules: 3–2000 trimmed characters).",
  schema: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        minLength: 3,
        maxLength: 2000,
        example: "Out of stock for selected plants until next shipment",
      },
      rejection_reason: { type: "string", description: "Alias of reason" },
      cancellation_reason: { type: "string", description: "Alias of reason" },
    },
    anyOf: [
      { required: ["reason"] },
      { required: ["rejection_reason"] },
      { required: ["cancellation_reason"] },
    ],
  },
  examples: {
    reason: {
      summary: "Primary field",
      value: { reason: "Unable to fulfil delivery window requested" },
    },
    alias: {
      summary: "rejection_reason",
      value: { rejection_reason: "Inventory mismatch after slot confirmation" },
    },
  },
};

export const vendorInitiateReturnApiBody: ApiBodyOptions = {
  description:
    "Merges pickup slot options under `workflowMeta.return` (same slot shape id pattern SLOT-RET-… server-side).",
  schema: {
    type: "object",
    required: ["pickup_slots"],
    properties: {
      pickup_slots: { type: "array", minItems: 1, items: deliverySlotProp },
      assigned_staff_gardener_id: { type: "string", format: "uuid" },
      notes: { type: "string" },
    },
  },
  examples: {
    pickup: {
      summary: "Return pickup options",
      value: {
        pickup_slots: [{ date: "2026-07-01", time_from: "10:00", time_to: "13:00" }],
        notes: "Call customer 30min before",
      },
    },
  },
};

export const assignGardenerApiBody: ApiBodyOptions = {
  description:
    "Creates recurring `MaintenanceTask` rows for the rental line. " +
    "If `delivery_slots[]` is non-empty, merges into `order.workflowMeta.assignGardener` " +
    "(does not replace `workflowMeta.delivery` from propose-delivery-slots).",
  schema: {
    type: "object",
    required: ["gardener_id", "order_item_id", "maintenance_schedule"],
    properties: {
      gardener_id: { type: "string", format: "uuid" },
      order_item_id: { type: "string", format: "uuid" },
      maintenance_schedule: { type: "string", enum: ["WEEKLY", "BIWEEKLY", "MONTHLY"] },
      delivery_slots: {
        type: "array",
        items: deliverySlotProp,
        description: "Optional; merged into workflowMeta.assignGardener",
      },
    },
  },
};

const fulfillmentLineDeliveryProp = {
  type: "object",
  required: ["order_item_id"],
  properties: {
    order_item_id: { type: "string", format: "uuid" },
    condition: {
      type: "string",
      enum: ["GOOD", "DAMAGED", "NEEDS_ATTENTION", "MISSING"],
      default: "GOOD",
      description: "Physical condition observed at drop-off",
    },
    proof_at: {
      type: "string",
      format: "date-time",
      description: "Evidence timestamp per line (defaults to request time)",
    },
    proof_image_urls: {
      type: "array",
      items: { type: "string", format: "uri" },
    },
    notes: { type: "string", description: "Per-line courier / customer-visible notes" },
  },
};

const fulfillmentLineReturnProp = {
  type: "object",
  required: ["order_item_id"],
  properties: {
    order_item_id: { type: "string", format: "uuid" },
    condition: {
      type: "string",
      enum: ["GOOD", "DAMAGED", "NEEDS_ATTENTION", "MISSING"],
      default: "GOOD",
    },
    restock: {
      type: "boolean",
      default: false,
      description: "Increment plant stockQuantity when TRUE (reuse path for salvage/repair stock)",
    },
    proof_at: {
      type: "string",
      format: "date-time",
      description: "Pickup / inspection timestamp (defaults to collection_proof_at or now)",
    },
    proof_image_urls: { type: "array", items: { type: "string", format: "uri" } },
    notes: { type: "string" },
  },
};

export const completeDeliveryFulfillmentApiBody: ApiBodyOptions = {
  description:
    "Order-level proof fields merge into `workflowMeta.deliveryCompletion`. " +
    "Optional **`line_items[]`** persists per-row delivery proof (`delivery_proof_at`, condition, urls, notes) — when present **must cover every rental `OrderItem` once**.",
  schema: {
    type: "object",
    properties: {
      actual_start_date: { type: "string" },
      actual_start_time: { type: "string" },
      delivery_notes: { type: "string" },
      proof_image_urls: { type: "array", items: { type: "string", format: "uri" } },
      line_items: {
        type: "array",
        items: fulfillmentLineDeliveryProp,
        description: "When sent: exactly one row per rental line on the order",
      },
    },
  },
};

export const vendorCompleteReturnApiBody: ApiBodyOptions = {
  description:
    "Confirms pickup for **each pending rental line** in one call. Persisted: `return_*` columns + **`restocked` / `restocked_at`** when `restock: true`. " +
    "Order becomes **`COMPLETED`** only after every rental row is **`RETURNED`**. `collection_proof_at` is the default ISO timestamp applied to rows without `items[].proof_at`.",
  schema: {
    type: "object",
    required: ["collection_date", "items"],
    properties: {
      collection_date: { type: "string", format: "date", description: "Calendar date of pickup" },
      collection_proof_at: { type: "string", format: "date-time", description: "Default line proof time" },
      items: { type: "array", minItems: 1, items: fulfillmentLineReturnProp },
    },
  },
  examples: {
    default: {
      summary: "Two-line return, one restocked",
      value: {
        collection_date: "2026-07-02",
        collection_proof_at: "2026-07-02T11:30:00.000Z",
        items: [
          {
            order_item_id: "00000000-0000-4000-8000-000000000001",
            condition: "GOOD",
            restock: true,
            proof_image_urls: [],
            notes: "Clean return",
          },
          {
            order_item_id: "00000000-0000-4000-8000-000000000002",
            condition: "DAMAGED",
            restock: false,
            notes: "Pot cracked — hold for QC",
          },
        ],
      },
    },
  },
};

export const customerReturnResponseApiBody: ApiBodyOptions = {
  description: "Uses `workflowMeta.return.proposed` for CONFIRM pickup slot id.",
  schema: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["CONFIRM", "REQUEST_DIFFERENT_TIME"] },
      pickup_slot_id: { type: "string", description: "Matches proposed[].id after initiate-return" },
      preferred_date: { type: "string" },
      preferred_time_from: { type: "string" },
      preferred_time_to: { type: "string" },
      note: { type: "string" },
    },
  },
  examples: {
    confirm: { summary: "CONFIRM pickup", value: { action: "CONFIRM", pickup_slot_id: "SLOT-RET-XXXXXXXX" } },
    reschedule: {
      summary: "REQUEST_DIFFERENT_TIME",
      value: {
        action: "REQUEST_DIFFERENT_TIME",
        preferred_date: "2026-07-05",
        note: "Away until Friday",
      },
    },
  },
};
