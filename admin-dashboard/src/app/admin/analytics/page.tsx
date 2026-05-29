import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { fetchAdmin, fmtMoney } from "@/lib/admin-page";
import { StatCard } from "@/components/admin/stat-card";

type Overview = {
  total_users: number;
  total_orders: number;
  total_revenue: number;
  active_rentals: number;
};

type TopNurseryRow = {
  nursery?: { id: string; name: string; city?: string };
  orders: number;
  revenue: number;
};

export default async function AdminAnalyticsPage() {
  const [overview, top] = await Promise.all([
    fetchAdmin<Overview>("/api/v1/admin/analytics/overview?period=month", "/admin/analytics"),
    fetchAdmin<TopNurseryRow[]>(
      "/api/v1/admin/analytics/top-nurseries?period=month&limit=10&metric=revenue",
      "/admin/analytics"
    ),
  ]);

  return (
    <div className="space-y-6">
      <div className="text-xl font-semibold text-zinc-900">Analytics</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={overview.total_users} />
        <StatCard label="Orders (month)" value={overview.total_orders} />
        <StatCard label="Revenue (month)" value={fmtMoney(overview.total_revenue)} />
        <StatCard label="Active rentals" value={overview.active_rentals} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Top nurseries (month)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Nursery</Th>
                <Th>City</Th>
                <Th>Orders</Th>
                <Th>Revenue</Th>
              </Tr>
            </thead>
            <tbody>
              {top.map((row, i) => (
                <Tr key={row.nursery?.id ?? i}>
                  <Td className="font-medium">{row.nursery?.name ?? "—"}</Td>
                  <Td>{row.nursery?.city ?? "—"}</Td>
                  <Td>{row.orders}</Td>
                  <Td>{fmtMoney(row.revenue)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
