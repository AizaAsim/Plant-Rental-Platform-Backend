import type { ApiBodyOptions } from "@nestjs/swagger";

export const freelanceJobCreateApiBody: ApiBodyOptions = {
  description:
    "Creates a `FreelanceJob` row (status OPEN). Copies `city`/`pincode` from the customer's address. Requires a saved delivery address belonging to the user.",
  schema: {
    type: "object",
    required: ["delivery_address_id", "preferred_date"],
    properties: {
      delivery_address_id: { type: "string", format: "uuid", description: "Must belong to JWT user" },
      order_id: { type: "string", description: "Optional Order UUID / order number to link booking" },
      care_types: { type: "array", items: { type: "string" }, example: ["WATERING", "PRUNE"] },
      preferred_date: { type: "string", format: "date", example: "2026-06-15" },
      preferred_time_from: { type: "string", example: "09:00", default: "09:00" },
      preferred_time_to: { type: "string", example: "13:00", default: "17:00" },
      plant_details: { type: "string" },
      special_instructions: { type: "string" },
      budget_amount: {
        type: "string",
        description: "Optional max offer (decimal). Required for `payments/initiate` with `payment_for: FREELANCE_JOB` after ACCEPTED.",
      },
    },
  },
};

export const freelanceJobCancelApiBody: ApiBodyOptions = {
  description: "Optional note. Persisted as `cancellation_reason` on customer cancel; ignored on gardener withdraw.",
  schema: {
    type: "object",
    properties: {
      reason: { type: "string" },
    },
  },
};

export const freelanceJobCompleteApiBody: ApiBodyOptions = {
  description: "Gardener marks job done (must be IN_PROGRESS).",
  schema: {
    type: "object",
    properties: {
      completion_notes: { type: "string" },
      photo_urls: { type: "array", items: { type: "string", format: "uri" }, description: "Stored as JSON on the job row" },
    },
  },
  examples: {
    default: { value: { completion_notes: "All plants watered", photo_urls: [] } },
  },
};

export const freelanceJobReviewApiBody: ApiBodyOptions = {
  description: "Customer rates job after COMPLETED.",
  schema: {
    type: "object",
    required: ["rating"],
    properties: {
      rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
      comment: { type: "string" },
    },
  },
};
