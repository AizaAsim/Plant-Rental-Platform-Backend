import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { ListSearch } from "@/components/admin/list-search";
import { PageHeader } from "@/components/admin/page-header";
import { TableFilters } from "@/components/admin/table-filters";
import { buildQuery, fetchAdmin, type Paginated } from "@/lib/admin-page";
import { GardenerRowActions } from "./row-actions";

type GardenerRow = {
  id: string;
  isVerified: boolean;
  isAvailable: boolean;
  isFreelancer: boolean;
  user: { fullName: string | null; email: string | null; phone: string | null };
  nursery?: { name: string } | null;
};

export default async function AdminGardenersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    search?: string;
    is_verified?: string;
    is_freelancer?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const qs = buildQuery(params);
  const data = await fetchAdmin<Paginated<GardenerRow>>(
    `/api/v1/admin/gardeners?${qs}`,
    "/admin/gardeners"
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gardeners"
        description="Staff and freelance gardeners."
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
            name: "is_freelancer",
            label: "Type",
            type: "select",
            options: [
              { value: "true", label: "Freelance" },
              { value: "false", label: "Nursery staff" },
            ],
          },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Gardeners</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Nursery</Th>
                <Th>Type</Th>
                <Th>Available</Th>
                <Th>Verified</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {data.items.map((g) => (
                <Tr key={g.id}>
                  <Td className="font-medium">{g.user.fullName ?? "—"}</Td>
                  <Td>{g.user.email ?? "—"}</Td>
                  <Td>{g.user.phone ?? "—"}</Td>
                  <Td>{g.nursery?.name ?? (g.isFreelancer ? "Freelance" : "—")}</Td>
                  <Td>
                    <Badge>{g.isFreelancer ? "FREELANCE" : "NURSERY"}</Badge>
                  </Td>
                  <Td>
                    <Badge variant={g.isAvailable ? "success" : "default"}>
                      {g.isAvailable ? "YES" : "NO"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge variant={g.isVerified ? "success" : "warning"}>
                      {g.isVerified ? "YES" : "NO"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <GardenerRowActions
                      gardenerId={g.id}
                      name={g.user.fullName ?? g.user.email ?? g.id}
                      isVerified={g.isVerified}
                    />
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
