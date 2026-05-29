import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { TableFilters } from "@/components/admin/table-filters";
import { PageHeader } from "@/components/admin/page-header";
import { buildQuery, fmtDate } from "@/lib/admin-page";
import { fetchOrderComplaints } from "@/lib/complaints-list";

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export default async function AdminOrderComplaintsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const page = Number(params.page) || 1;
  const limit = 50;
  const qs = buildQuery({ page: params.page, status: params.status, limit: String(limit) });

  const { data, source, apiError } = await fetchOrderComplaints(
    `/api/v1/admin/order-complaints?${qs}`,
    "/admin/order-complaints",
    { status: params.status, page, limit }
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Order complaints"
        description="Customer complaints filed against orders."
        meta={`${data.pagination.total} total`}
      />

      {source === "database" && (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--card-border)",
            background: "color-mix(in srgb, var(--primary) 12%, var(--card))",
            color: "var(--foreground)",
          }}
        >
          <strong>Loaded from database.</strong> The API at your{" "}
          <code className="rounded px-1 text-xs">NEXT_PUBLIC_API_BASE_URL</code> does not expose{" "}
          <code className="rounded px-1 text-xs">GET /api/v1/admin/order-complaints</code> yet (
          {apiError}). Redeploy the Nest backend to use the API route, or keep using this fallback.
        </div>
      )}

      <TableFilters
        fields={[
          {
            name: "status",
            label: "Status",
            type: "select",
            options: STATUS_OPTIONS,
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Customer complaints ({data.pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <p className="kiyaari-text-muted text-sm">No complaints match your filters.</p>
          ) : (
            <>
              <Table>
                <thead>
                  <Tr>
                    <Th>#</Th>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Subject</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                  </Tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <Tr key={c.id}>
                      <Td className="font-medium">{c.complaintNumber}</Td>
                      <Td>{c.order?.orderNumber ?? "—"}</Td>
                      <Td>
                        <div>{c.user?.fullName ?? "—"}</div>
                        <div className="kiyaari-text-muted text-xs">{c.user?.email}</div>
                      </Td>
                      <Td>{c.subject}</Td>
                      <Td>
                        <Badge>{c.status}</Badge>
                      </Td>
                      <Td className="text-xs">{fmtDate(c.createdAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
