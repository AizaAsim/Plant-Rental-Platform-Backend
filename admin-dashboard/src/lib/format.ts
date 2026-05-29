/** Client-safe format helpers (no server-only imports). */

export type Paginated<T> = {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function fmtMoney(n: unknown): string {
  const v =
    typeof n === "object" && n && "toNumber" in (n as object)
      ? Number((n as { toNumber: () => number }).toNumber())
      : Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(v);
}
