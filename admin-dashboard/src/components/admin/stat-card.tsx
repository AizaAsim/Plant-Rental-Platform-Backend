import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

function parseTrend(hint?: string): { text: string; up?: boolean } | null {
  if (!hint) return null;
  const m = hint.match(/(-?\d+(?:\.\d+)?)%/);
  if (!m) return { text: hint };
  const n = parseFloat(m[1]);
  return { text: hint, up: n > 0 ? true : n < 0 ? false : undefined };
}

const statIcons: Record<string, string> = {
  Users: "👥",
  Vendors: "🏪",
  Gardeners: "🧑‍🌾",
  "Active rentals": "🪴",
  "Orders (period)": "📦",
  "Revenue (period)": "💵",
  "Commission (period)": "🌱",
};

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  const trend = parseTrend(hint);
  const icon = statIcons[label] ?? "📌";

  return (
    <Card className="kiyaari-stat-card overflow-hidden">
      <CardContent className="relative py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="kiyaari-text-muted text-xs font-medium uppercase tracking-wide">
            {label}
          </div>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
            style={{ background: "var(--accent)" }}
            aria-hidden
          >
            {icon}
          </span>
        </div>
        <div className="kiyaari-page-title mt-2 text-2xl font-semibold tabular-nums">{value}</div>
        {trend && (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              trend.up === true && "kiyaari-trend-up",
              trend.up === false && "kiyaari-trend-down",
              trend.up === undefined && "kiyaari-text-muted"
            )}
          >
            {trend.up === true && <span aria-hidden>↑</span>}
            {trend.up === false && <span aria-hidden>↓</span>}
            {trend.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
