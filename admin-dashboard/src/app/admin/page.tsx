import Link from "next/link";
import { fetchAdmin, fmtMoney } from "@/lib/admin-page";
import { StatCard } from "@/components/admin/stat-card";
import { QuickLink } from "@/components/admin/quick-link";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Overview = {
  total_users: number;
  total_vendors: number;
  total_gardeners: number;
  total_orders: number;
  total_revenue: number;
  total_commission: number;
  active_rentals: number;
  period_comparison?: {
    users_change: number;
    orders_change: number;
    revenue_change: number;
  };
  period: string;
};

const quickLinks = [
  { href: "/admin/users", label: "Users", icon: "👥", description: "Verify & manage accounts" },
  { href: "/admin/nurseries", label: "Nurseries", icon: "🏪", description: "Vendor onboarding" },
  { href: "/admin/gardeners", label: "Gardeners", icon: "🧑‍🌾", description: "Staff & freelancers" },
  { href: "/admin/orders", label: "Orders", icon: "📦", description: "Rentals & purchases" },
  { href: "/admin/payouts", label: "Payouts", icon: "💰", description: "Vendor settlements" },
  { href: "/admin/disputes", label: "Disputes", icon: "⚖️", description: "Resolve conflicts" },
  { href: "/admin/order-complaints", label: "Complaints", icon: "📣", description: "Customer issues" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈", description: "Charts & trends" },
];

export default async function AdminOverviewPage() {
  const overview = await fetchAdmin<Overview>(
    "/api/v1/admin/analytics/overview?period=month",
    "/admin"
  );
  const cmp = overview.period_comparison;
  const periodLabel =
    overview.period === "month"
      ? "this month"
      : overview.period === "week"
        ? "this week"
        : overview.period;

  return (
    <div className="space-y-6">
      <div className="kiyaari-hero rounded-2xl border px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="kiyaari-text-muted text-sm font-medium">Welcome back</p>
            <h1 className="kiyaari-page-title mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Kiyaari platform overview
            </h1>
            <p className="kiyaari-text-muted mt-2 text-sm">
              Key metrics for <span className="font-medium">{periodLabel}</span> — manage plants,
              people, and orders from one place.
            </p>
          </div>
          <span className="hidden text-5xl opacity-40 sm:block" aria-hidden>
            🌿
          </span>
        </div>
      </div>

      <PageHeader title="Metrics" meta={`Period: ${overview.period}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={overview.total_users}
          hint={cmp ? `${cmp.users_change}% vs prior period` : undefined}
        />
        <StatCard label="Vendors" value={overview.total_vendors} />
        <StatCard label="Gardeners" value={overview.total_gardeners} />
        <StatCard label="Active rentals" value={overview.active_rentals} />
        <StatCard
          label="Orders (period)"
          value={overview.total_orders}
          hint={cmp ? `${cmp.orders_change}% vs prior period` : undefined}
        />
        <StatCard
          label="Revenue (period)"
          value={fmtMoney(overview.total_revenue)}
          hint={cmp ? `${cmp.revenue_change}% vs prior period` : undefined}
        />
        <StatCard label="Commission (period)" value={fmtMoney(overview.total_commission)} />
      </div>

      <div>
        <h2 className="kiyaari-page-title mb-3 text-sm font-semibold uppercase tracking-wide">
          Quick access
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((l) => (
            <QuickLink key={l.href} {...l} />
          ))}
        </div>
      </div>

      <Card className="kiyaari-tip-card">
        <CardHeader>
          <CardTitle>💡 Deeper analytics</CardTitle>
        </CardHeader>
        <CardContent className="kiyaari-text-muted text-sm">
          Open{" "}
          <Link href="/admin/analytics" className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--primary)" }}>
            Analytics
          </Link>{" "}
          for revenue series, top nurseries, and user growth over time.
        </CardContent>
      </Card>
    </div>
  );
}
