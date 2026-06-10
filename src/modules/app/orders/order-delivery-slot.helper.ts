import { BadRequestException } from "@nestjs/common";
import { contractPublicId } from "src/common/contract/response";

export type ParsedTimeSlot = { time_from: string; time_to: string };

/** Parse `09:00-17:00` or `09:00` (1h default window). */
export function parsePreferredTimeSlot(raw: unknown): ParsedTimeSlot | null {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim();
  if (s.includes("-")) {
    const [from, to] = s.split("-").map((x) => x.trim());
    if (!from || !to) throw new BadRequestException("preferred_time_slot must be like 09:00-17:00");
    return { time_from: from, time_to: to };
  }
  return { time_from: s, time_to: s };
}

type PackageSlotRow = {
  day_of_week?: number;
  time_from?: string;
  time_to?: string;
};

function normTime(t: string) {
  return t.trim().slice(0, 5);
}

/** Validate customer-selected date/time against package `delivery_slots` JSON (if configured). */
export function assertSlotAllowedByPackage(
  preferredDate: string,
  timeSlot: ParsedTimeSlot,
  packageDeliverySlots: unknown
) {
  if (!packageDeliverySlots) return;
  if (!Array.isArray(packageDeliverySlots) || packageDeliverySlots.length === 0) return;

  const date = new Date(preferredDate);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("Invalid preferred_delivery_date");
  }
  const dow = date.getUTCDay();
  const rows = packageDeliverySlots as PackageSlotRow[];
  const match = rows.some((row) => {
    if (row.day_of_week != null && row.day_of_week !== dow) return false;
    if (row.time_from && normTime(row.time_from) !== normTime(timeSlot.time_from)) return false;
    if (row.time_to && normTime(row.time_to) !== normTime(timeSlot.time_to)) return false;
    return true;
  });
  if (!match) {
    throw new BadRequestException(
      "Selected delivery date/time is not available for this package. Choose a slot from the package delivery schedule."
    );
  }
}

export function buildConfirmedDeliveryMeta(
  preferredDate: string,
  timeSlot: ParsedTimeSlot,
  note?: string
) {
  const slotId = contractPublicId("SLOT");
  return {
    confirmed: {
      id: slotId,
      date: preferredDate.slice(0, 10),
      time_from: timeSlot.time_from,
      time_to: timeSlot.time_to,
    },
    proposed: [
      {
        id: slotId,
        date: preferredDate.slice(0, 10),
        time_from: timeSlot.time_from,
        time_to: timeSlot.time_to,
      },
    ],
    note: note ?? undefined,
    source: "rental_booking_preferred_slot",
  };
}
