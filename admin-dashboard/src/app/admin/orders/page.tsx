import Link from "next/link";
import { TableFilters } from "@/components/admin/table-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { buildQuery, fetchAdmin, fmtDate, fmtMoney, type Paginated } from "@/lib/admin-page";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  paymentStatus: string;
  totalAmount: unknown;
  createdAt: string;
  user?: { fullName: string | null; email: string | null };
  nursery?: { name: string };
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; status?: string; order_type?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const qs = buildQuery({ page: params.page, limit: "20", status: params.status, order_type: params.order_type });
  const data = await fetchAdmin<Paginated<OrderRow>>(`/api/v1/admin/orders?${qs}`, "/admin/orders");

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xl font-semibold text-zinc-900">Orders</div>
          <div className="text-sm text-zinc-600">All platform orders.</div>
        </div>
        <div className="text-xs text-zinc-500">Total: {data.pagination.total}</div>
      </div>

      <TableFilters
        fields={[
          { name: "status", label: "Status", placeholder: "e.g. PENDING, DELIVERED" },
          {
            name: "order_type",
            label: "Order type",
            type: "select",
            options: [
              { value: "RENT", label: "Rent" },
              { value: "BUY", label: "Buy" },
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Order #</Th>
                <Th>Customer</Th>
                <Th>Nursery</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Total</Th>
                <Th>Created</Th>
              </Tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-blue-700 hover:underline">
                      {o.orderNumber}
                    </Link>
                  </Td>
                  <Td>
                    <div>{o.user?.fullName ?? "—"}</div>
                    <div className="text-xs text-zinc-500">{o.user?.email}</div>
                  </Td>
                  <Td>{o.nursery?.name ?? "—"}</Td>
                  <Td>
                    <Badge>{o.orderType}</Badge>
                  </Td>
                  <Td>
                    <Badge>{o.status}</Badge>
                  </Td>
                  <Td>
                    <Badge variant={o.paymentStatus === "PAID" ? "success" : "warning"}>
                      {o.paymentStatus}
                    </Badge>
                  </Td>
                  <Td>{fmtMoney(o.totalAmount)}</Td>
                  <Td className="text-xs">{fmtDate(o.createdAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} />
        </CardContent>
      </Card>
    </div>
  );
}
