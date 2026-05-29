import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { ListSearch } from "@/components/admin/list-search";
import { PageHeader } from "@/components/admin/page-header";
import { TableFilters } from "@/components/admin/table-filters";
import { buildQuery, fetchAdmin, fmtDate, type Paginated } from "@/lib/admin-page";
import { NurseryRowActions } from "./row-actions";

type NurseryRow = {
  id: string;
  name: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  vendor?: { fullName: string | null; email: string | null };
};

export default async function AdminNurseriesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    is_verified?: string;
    is_active?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const qs = buildQuery(params);
  const data = await fetchAdmin<Paginated<NurseryRow>>(
    `/api/v1/admin/nurseries?${qs}`,
    "/admin/nurseries"
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nurseries (vendors)"
        description="Vendor businesses — verify and activate."
        meta={`Total: ${data.pagination.total}`}
      />

      <ListSearch placeholder="Search name or email…" defaultValue={params.search} />
      <TableFilters
        fields={[
          {
            name: "is_verified",
            label: "Verified",
            type: "select",
            options: [
              { value: "true", label: "Verified" },
              { value: "false", label: "Unverified" },
            ],
          },
          {
            name: "is_active",
            label: "Status",
            type: "select",
            options: [
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>All nurseries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Nursery</Th>
                <Th>Vendor</Th>
                <Th>City</Th>
                <Th>Contact</Th>
                <Th>Verified</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {data.items.map((n) => (
                <Tr key={n.id}>
                  <Td className="font-medium">{n.name}</Td>
                  <Td>
                    <div>{n.vendor?.fullName ?? "—"}</div>
                    <div className="text-xs text-zinc-500">{n.vendor?.email ?? ""}</div>
                  </Td>
                  <Td>{n.city ?? "—"}</Td>
                  <Td>
                    <div className="text-xs">{n.email ?? "—"}</div>
                    <div className="text-xs text-zinc-500">{n.phone ?? ""}</div>
                  </Td>
                  <Td>
                    <Badge variant={n.isVerified ? "success" : "warning"}>
                      {n.isVerified ? "YES" : "NO"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge variant={n.isActive ? "success" : "danger"}>
                      {n.isActive ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-zinc-600">{fmtDate(n.createdAt)}</Td>
                  <Td className="text-right">
                    <NurseryRowActions
                      nurseryId={n.id}
                      name={n.name}
                      isActive={n.isActive}
                      isVerified={n.isVerified}
                    />
                  </Td>
                </Tr>
              ))}
              {data.items.length === 0 && (
                <Tr>
                  <Td colSpan={8} className="py-8 text-center text-zinc-500">
                    No nurseries found.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} />
        </CardContent>
      </Card>
    </div>
  );
}
