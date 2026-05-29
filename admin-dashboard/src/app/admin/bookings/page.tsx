import { TableFilters } from "@/components/admin/table-filters";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { buildQuery, fetchAdmin, fmtDate, type Paginated } from "@/lib/admin-page";

type BookingRow = {
  id: string;
  bookingNumber: string;
  status: string;
  serviceType: string;
  serviceDate: string;
  user?: { fullName: string | null };
  gardener?: { user?: { fullName: string | null } };
};

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const qs = buildQuery({ page: params.page, status: params.status });
  const data = await fetchAdmin<Paginated<BookingRow>>(
    `/api/v1/admin/bookings?${qs}`,
    "/admin/bookings"
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bookings"
        description="Service bookings."
        meta={`Total: ${data.pagination.total}`}
      />
      <TableFilters
        fields={[
          { name: "status", label: "Status", placeholder: "e.g. PENDING, COMPLETED" },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Booking #</Th>
                <Th>Customer</Th>
                <Th>Gardener</Th>
                <Th>Service</Th>
                <Th>Status</Th>
                <Th>Date</Th>
              </Tr>
            </thead>
            <tbody>
              {data.items.map((b) => (
                <Tr key={b.id}>
                  <Td className="font-medium">{b.bookingNumber}</Td>
                  <Td>{b.user?.fullName ?? "—"}</Td>
                  <Td>{b.gardener?.user?.fullName ?? "—"}</Td>
                  <Td>{b.serviceType}</Td>
                  <Td>
                    <Badge>{b.status}</Badge>
                  </Td>
                  <Td className="text-xs">{fmtDate(b.serviceDate)}</Td>
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
