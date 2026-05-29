import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchAdmin } from "@/lib/admin-page";
import { ManualResolveButton } from "./resolve-button";

type ManualResp = {
  success: boolean;
  data: {
    items: {
      id: string;
      order_id: string;
      order_number: string;
      status: string;
      priority: string;
      reason: string;
    }[];
    pagination: { page: number; total_pages: number; total: number };
  };
};

export default async function AdminManualOrdersPage() {
  const res = await fetchAdmin<ManualResp>(
    "/api/v1/admin/manual-orders?page=1&limit=50",
    "/admin/manual-orders"
  );
  const items = res.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="text-xl font-semibold text-zinc-900">Manual intervention queue</div>
      <Card>
        <CardHeader>
          <CardTitle>Cases needing admin action ({res.data?.pagination?.total ?? items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Order</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Reason</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <Tr key={row.id}>
                  <Td className="font-medium">{row.order_number}</Td>
                  <Td>
                    <Badge variant={row.priority === "HIGH" ? "danger" : "warning"}>
                      {row.priority}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge>{row.status}</Badge>
                  </Td>
                  <Td className="max-w-md truncate text-sm">{row.reason}</Td>
                  <Td className="text-right">
                    {row.status === "OPEN" ? (
                      <ManualResolveButton orderId={row.order_id} />
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
