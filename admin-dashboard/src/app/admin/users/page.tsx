import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { ListSearch } from "@/components/admin/list-search";
import { TableFilters } from "@/components/admin/table-filters";
import { buildQuery, fetchAdmin, type Paginated } from "@/lib/admin-page";
import { UserRowActions } from "./row-actions";

type UsersList = {
  items: {
    id: string;
    email: string | null;
    fullName: string | null;
    phone: string | null;
    role: string;
    isVerified: boolean;
    isActive: boolean;
    createdAt: string;
  }[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    role?: string;
    is_active?: string;
    is_verified?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const qs = buildQuery(params);
  const data = await fetchAdmin<UsersList>(`/api/v1/admin/users?${qs}`, "/admin/users");

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold text-zinc-900">Users</div>
          <div className="text-sm text-zinc-600">Search, verify, and activate/deactivate users.</div>
        </div>
        <div className="text-xs text-zinc-500">Total: {data.pagination.total}</div>
      </div>

      <ListSearch placeholder="Search email, name, phone…" defaultValue={params.search} />

      <TableFilters
        fields={[
          {
            name: "role",
            label: "Role",
            type: "select",
            options: [
              { value: "CUSTOMER", label: "Customer" },
              { value: "VENDOR", label: "Vendor" },
              { value: "GARDENER", label: "Gardener" },
              { value: "ADMIN", label: "Admin" },
            ],
          },
          {
            name: "is_active",
            label: "Active",
            type: "select",
            options: [
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ],
          },
          {
            name: "is_verified",
            label: "Verified",
            type: "select",
            options: [
              { value: "true", label: "Verified" },
              { value: "false", label: "Unverified" },
            ],
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Email</Th>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Verified</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <Tr key={u.id}>
                  <Td className="font-medium">{u.email ?? "-"}</Td>
                  <Td>{u.fullName ?? "-"}</Td>
                  <Td>{u.phone ?? "-"}</Td>
                  <Td>
                    <Badge>{u.role}</Badge>
                  </Td>
                  <Td>
                    <Badge variant={u.isActive ? "success" : "danger"}>
                      {u.isActive ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge variant={u.isVerified ? "success" : "warning"}>
                      {u.isVerified ? "VERIFIED" : "UNVERIFIED"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <UserRowActions userId={u.id} isActive={u.isActive} isVerified={u.isVerified} />
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

