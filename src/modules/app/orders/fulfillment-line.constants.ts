export const FULFILLMENT_LINE_CONDITIONS = [
  "GOOD",
  "DAMAGED",
  "NEEDS_ATTENTION",
  "MISSING",
] as const;

export type FulfillmentLineCondition = (typeof FULFILLMENT_LINE_CONDITIONS)[number];

export function tryFulfillmentLineCondition(raw: unknown): FulfillmentLineCondition | null {
  const s = String(raw ?? "GOOD").trim().toUpperCase();
  if ((FULFILLMENT_LINE_CONDITIONS as readonly string[]).includes(s)) {
    return s as FulfillmentLineCondition;
  }
  return null;
}
