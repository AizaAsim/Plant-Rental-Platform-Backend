import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { buildQuery, fetchAdmin, fmtDate, fmtMoney, type Paginated } from "@/lib/admin-page";
import { PayoutRowActions } from "./row-actions";

type PayoutRow = {
  id: string;
  payoutNumber: string;
  status: string;
  recipientType: string;
  amount: unknown;
  createdAt: string;
};

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const qs = buildQuery({ page: params.page, status: params.status });
  const data = await fetchAdmin<Paginated<PayoutRow>>(
    `/api/v1/admin/payouts?${qs}`,
    "/admin/payouts"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xl font-semibold text-zinc-900">Payouts</div>
          <div className="text-sm text-zinc-600">Vendor and gardener payouts.</div>
        </div>
        <div className="text-xs text-zinc-500">Total: {data.pagination.total}</div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Payout #</Th>
                <Th>Recipient</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium">{p.payoutNumber}</Td>
                  <Td>{p.recipientType}</Td>
                  <Td>{fmtMoney(p.amount)}</Td>
                  <Td>
                    <Badge variant={p.status === "COMPLETED" ? "success" : "warning"}>{p.status}</Badge>
                  </Td>
                  <Td className="text-xs">{fmtDate(p.createdAt)}</Td>
                  <Td className="text-right">
                    <PayoutRowActions payoutId={p.id} payoutNumber={p.payoutNumber} status={p.status} />
                  </Td>
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
