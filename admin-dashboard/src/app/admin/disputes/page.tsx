import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { buildQuery, fetchAdmin, fmtDate, type Paginated } from "@/lib/admin-page";

type DisputeRow = {
  id: string;
  disputeNumber: string;
  status: string;
  disputeType: string;
  createdAt: string;
  raiser?: { fullName: string | null; email: string | null };
};

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const qs = buildQuery({ page: params.page, status: params.status });
  const data = await fetchAdmin<Paginated<DisputeRow>>(
    `/api/v1/admin/disputes?${qs}`,
    "/admin/disputes"
  );

  return (
    <div className="space-y-4">
      <div className="text-xl font-semibold text-zinc-900">Disputes</div>
      <Card>
        <CardHeader>
          <CardTitle>Open & resolved disputes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>#</Th>
                <Th>Raiser</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th />
              </Tr>
            </thead>
            <tbody>
              {data.items.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-medium">{d.disputeNumber}</Td>
                  <Td>
                    <div>{d.raiser?.fullName ?? "—"}</div>
                    <div className="text-xs text-zinc-500">{d.raiser?.email}</div>
                  </Td>
                  <Td>{d.disputeType}</Td>
                  <Td>
                    <Badge variant={d.status === "RESOLVED" ? "success" : "warning"}>{d.status}</Badge>
                  </Td>
                  <Td className="text-xs">{fmtDate(d.createdAt)}</Td>
                  <Td>
                    <Link href={`/admin/disputes/${d.id}`} className="text-sm text-blue-700 hover:underline">
                      View
                    </Link>
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
