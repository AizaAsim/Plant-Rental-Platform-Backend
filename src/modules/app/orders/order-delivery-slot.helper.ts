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
