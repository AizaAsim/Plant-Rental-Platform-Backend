import { BadRequestException } from "@nestjs/common";
import { OrderStatus, PrismaClient } from "@prisma/client";
import type { ParsedTimeSlot } from "../orders/order-delivery-slot.helper";

export type PackageDeliverySlot = {
  date: string;
  time_from: string;
  time_to: string;
  capacity: number;
};

export type PackageDeliverySlotWithAvailability = PackageDeliverySlot & {
  booked_count: number;
  remaining_capacity: number;
  is_full: boolean;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CAPACITY_CONSUMING_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.SLOT_PROPOSED,
  OrderStatus.SLOT_CONFIRMED,
  OrderStatus.AWAITING_PAYMENT,
  OrderStatus.PROCESSING,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

function normTime(t: string) {
  return String(t).trim().slice(0, 5);
}

export function startOfTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDateOnly(dateStr: string): string {
  const s = String(dateStr).trim().slice(0, 10);
  if (!DATE_RE.test(s)) {
    throw new BadRequestException(`Invalid date "${dateStr}" — use YYYY-MM-DD`);
  }
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date "${dateStr}"`);
  }
  return s;
}

function parseTimeField(raw: unknown, field: string, index: number): string {
  const s = String(raw ?? "").trim();
  if (!TIME_RE.test(s)) {
    throw new BadRequestException(
      `delivery_slots[${index}].${field} must be HH:MM (24h), received "${s}"`
    );
  }
  return s;
}

/** Validate vendor input and normalize to date-specific slots (rejects day_of_week-only rows). */
export function validateAndNormalizeDeliverySlots(raw: unknown): PackageDeliverySlot[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestException("delivery_slots must be an array");
  }

  const today = startOfTodayUtc();
  const seen = new Set<string>();
  const out: PackageDeliverySlot[] = [];

  raw.forEach((row, idx) => {
    if (!row || typeof row !== "object") {
      throw new BadRequestException(`delivery_slots[${idx}] must be an object`);
    }
    const r = row as Record<string, unknown>;

    if (r.day_of_week != null && r.date == null) {
      throw new BadRequestException(
        `delivery_slots[${idx}]: use date (YYYY-MM-DD) instead of day_of_week. ` +
          "Package delivery windows are date-specific, not recurring weekly."
      );
    }
    if (r.date == null || String(r.date).trim() === "") {
      throw new BadRequestException(`delivery_slots[${idx}].date is required (YYYY-MM-DD)`);
    }

    const date = parseDateOnly(String(r.date));
    if (date < today) {
      throw new BadRequestException(`delivery_slots[${idx}].date cannot be in the past (${date})`);
    }

    const time_from = parseTimeField(r.time_from, "time_from", idx);
    const time_to = parseTimeField(r.time_to, "time_to", idx);
    if (time_from >= time_to) {
      throw new BadRequestException(
        `delivery_slots[${idx}]: time_from must be before time_to`
      );
    }

    const capacity = Number(r.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new BadRequestException(`delivery_slots[${idx}].capacity must be an integer >= 1`);
    }

    const key = `${date}|${time_from}|${time_to}`;
    if (seen.has(key)) {
      throw new BadRequestException(`delivery_slots[${idx}]: duplicate slot ${key}`);
    }
    seen.add(key);

    out.push({ date, time_from, time_to, capacity });
  });

  return out.sort((a, b) =>
    a.date === b.date ? a.time_from.localeCompare(b.time_from) : a.date.localeCompare(b.date)
  );
}

/** Omit past dates from API responses (does not write to DB until vendor updates). */
export function filterFutureDeliverySlots(slots: PackageDeliverySlot[]): PackageDeliverySlot[] {
  const today = startOfTodayUtc();
  return slots.filter((s) => s.date >= today);
}

export function parseStoredDeliverySlots(raw: unknown): PackageDeliverySlot[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: PackageDeliverySlot[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (r.date == null) continue;
    try {
      const date = parseDateOnly(String(r.date));
      const time_from = parseTimeField(r.time_from, "time_from", 0);
      const time_to = parseTimeField(r.time_to, "time_to", 0);
      const capacity = Number(r.capacity);
      if (!Number.isInteger(capacity) || capacity < 1) continue;
      out.push({ date, time_from, time_to, capacity });
    } catch {
      continue;
    }
  }
  return out;
}

function orderSlotFromMeta(
  bookingMeta: unknown,
  workflowMeta: unknown
): { date: string; time_from: string; time_to: string } | null {
  const booking =
    bookingMeta && typeof bookingMeta === "object"
      ? (bookingMeta as Record<string, unknown>)
      : {};
  const wf =
    workflowMeta && typeof workflowMeta === "object"
      ? (workflowMeta as Record<string, unknown>)
      : {};

  const confirmed =
    wf.delivery && typeof wf.delivery === "object"
      ? (wf.delivery as Record<string, unknown>).confirmed
      : null;
  if (confirmed && typeof confirmed === "object") {
    const c = confirmed as Record<string, unknown>;
    if (c.date && c.time_from && c.time_to) {
      return {
        date: String(c.date).slice(0, 10),
        time_from: normTime(String(c.time_from)),
        time_to: normTime(String(c.time_to)),
      };
    }
  }

  const prefDate = booking.preferred_delivery_date;
  const prefSlot = booking.preferred_time_slot;
  if (prefDate == null || prefSlot == null) return null;

  const slotStr = String(prefSlot).trim();
  let time_from: string;
  let time_to: string;
  if (slotStr.includes("-")) {
    const [from, to] = slotStr.split("-").map((x) => x.trim());
    if (!from || !to) return null;
    time_from = normTime(from);
    time_to = normTime(to);
  } else {
    time_from = normTime(slotStr);
    time_to = time_from;
  }

  return {
    date: String(prefDate).slice(0, 10),
    time_from,
    time_to,
  };
}

export async function countBookingsForPackageSlot(
  prisma: PrismaClient,
  packageId: string,
  slot: PackageDeliverySlot,
  excludeOrderId?: string
): Promise<number> {
  const orders = await prisma.order.findMany({
    where: {
      vendorPackageId: packageId,
      status: { in: CAPACITY_CONSUMING_STATUSES },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
    select: { id: true, bookingMeta: true, workflowMeta: true },
  });

  let count = 0;
  for (const o of orders) {
    const picked = orderSlotFromMeta(o.bookingMeta, o.workflowMeta);
    if (!picked) continue;
    if (
      picked.date === slot.date &&
      normTime(picked.time_from) === normTime(slot.time_from) &&
      normTime(picked.time_to) === normTime(slot.time_to)
    ) {
      count += 1;
    }
  }
  return count;
}

export async function enrichSlotsWithAvailability(
  prisma: PrismaClient,
  packageId: string,
  slots: PackageDeliverySlot[],
  excludeOrderId?: string
): Promise<PackageDeliverySlotWithAvailability[]> {
  const future = filterFutureDeliverySlots(slots);
  const rows: PackageDeliverySlotWithAvailability[] = [];
  for (const slot of future) {
    const booked_count = await countBookingsForPackageSlot(
      prisma,
      packageId,
      slot,
      excludeOrderId
    );
    const remaining_capacity = Math.max(0, slot.capacity - booked_count);
    rows.push({
      ...slot,
      booked_count,
      remaining_capacity,
      is_full: remaining_capacity <= 0,
    });
  }
  return rows;
}

export function findPackageSlot(
  preferredDate: string,
  timeSlot: ParsedTimeSlot,
  packageDeliverySlots: unknown
): PackageDeliverySlot | null {
  const date = parseDateOnly(preferredDate);
  const slots = parseStoredDeliverySlots(packageDeliverySlots);
  return (
    slots.find(
      (row) =>
        row.date === date &&
        normTime(row.time_from) === normTime(timeSlot.time_from) &&
        normTime(row.time_to) === normTime(timeSlot.time_to)
    ) ?? null
  );
}

/** Legacy packages may still have day_of_week rows — date-based match preferred. */
function findLegacyWeeklySlot(
  preferredDate: string,
  timeSlot: ParsedTimeSlot,
  packageDeliverySlots: unknown
): boolean {
  if (!Array.isArray(packageDeliverySlots)) return false;
  const date = new Date(`${parseDateOnly(preferredDate)}T00:00:00.000Z`);
  const dow = date.getUTCDay();
  return (packageDeliverySlots as Record<string, unknown>[]).some((row) => {
    if (row.date != null) return false;
    if (row.day_of_week != null && Number(row.day_of_week) !== dow) return false;
    if (row.time_from && normTime(String(row.time_from)) !== normTime(timeSlot.time_from)) {
      return false;
    }
    if (row.time_to && normTime(String(row.time_to)) !== normTime(timeSlot.time_to)) {
      return false;
    }
    return true;
  });
}

export async function assertDeliverySlotBookable(
  prisma: PrismaClient,
  packageId: string,
  preferredDate: string,
  timeSlot: ParsedTimeSlot,
  packageDeliverySlots: unknown,
  excludeOrderId?: string
) {
  if (!packageDeliverySlots) return;
  if (!Array.isArray(packageDeliverySlots) || packageDeliverySlots.length === 0) return;

  const date = parseDateOnly(preferredDate);
  const today = startOfTodayUtc();
  if (date < today) {
    throw new BadRequestException("preferred_delivery_date cannot be in the past");
  }

  const dated = findPackageSlot(preferredDate, timeSlot, packageDeliverySlots);
  if (dated) {
    const booked = await countBookingsForPackageSlot(
      prisma,
      packageId,
      dated,
      excludeOrderId
    );
    if (booked >= dated.capacity) {
      throw new BadRequestException(
        "This delivery slot is fully booked. Choose another date or time."
      );
    }
    return;
  }

  if (findLegacyWeeklySlot(preferredDate, timeSlot, packageDeliverySlots)) {
    return;
  }

  throw new BadRequestException(
    "Selected delivery date/time is not available for this package. Choose a slot from the package delivery schedule."
  );
}
