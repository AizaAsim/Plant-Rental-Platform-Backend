"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemedSelect } from "@/components/admin/themed-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { TableFilters } from "@/components/admin/table-filters";
import { useToast } from "@/components/ui/toast";
import { proxyWrite } from "@/lib/proxy-client";
import { fmtDate, type Paginated } from "@/lib/format";

export type CouponRow = {
  id: string;
  code: string;
  discountType: string;
  discountValue: unknown;
  applicableFor: string;
  usageLimit: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultValidRange() {
  const from = new Date();
  const until = new Date();
  until.setMonth(until.getMonth() + 3);
  return { from: toLocalInput(from.toISOString()), until: toLocalInput(until.toISOString()) };
}

export function CouponsManager({ data }: { data: Paginated<CouponRow> }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = React.useTransition();
  const [deactivateId, setDeactivateId] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);

  const defaults = defaultValidRange();
  const [form, setForm] = React.useState({
    code: "",
    discount_type: "FLAT",
    discount_value: "500",
    applicable_for: "ALL",
    usage_limit: "500",
    valid_from: defaults.from,
    valid_until: defaults.until,
  });

  const editing = data.items.find((c) => c.id === editId);
  const [editForm, setEditForm] = React.useState({
    discount_value: "",
    usage_limit: "",
    valid_from: "",
    valid_until: "",
    is_active: true,
  });

  React.useEffect(() => {
    if (!editing) return;
    setEditForm({
      discount_value: String(editing.discountValue),
      usage_limit: editing.usageLimit != null ? String(editing.usageLimit) : "",
      valid_from: toLocalInput(editing.validFrom),
      valid_until: toLocalInput(editing.validUntil),
      is_active: editing.isActive,
    });
  }, [editing]);

  function refresh() {
    router.refresh();
  }

  function createCoupon() {
    start(async () => {
      try {
        await proxyWrite("POST", "/api/v1/admin/coupons", {
          code: form.code.trim().toUpperCase(),
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          applicable_for: form.applicable_for,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          valid_from: new Date(form.valid_from).toISOString(),
          valid_until: new Date(form.valid_until).toISOString(),
        });
        toast.push({ title: "Coupon created", variant: "success" });
        setForm((f) => ({ ...f, code: "" }));
        refresh();
      } catch (e: unknown) {
        toast.push({
          title: "Failed",
          message: e instanceof Error ? e.message : "Error",
          variant: "error",
        });
      }
    });
  }

  function saveEdit() {
    if (!editId) return;
    start(async () => {
      try {
        await proxyWrite("PUT", `/api/v1/admin/coupons/${editId}`, {
          discount_value: Number(editForm.discount_value),
          usage_limit: editForm.usage_limit ? Number(editForm.usage_limit) : null,
          valid_from: new Date(editForm.valid_from).toISOString(),
          valid_until: new Date(editForm.valid_until).toISOString(),
          is_active: editForm.is_active,
        });
        toast.push({ title: "Coupon updated", variant: "success" });
        setEditId(null);
        refresh();
      } catch (e: unknown) {
        toast.push({
          title: "Failed",
          message: e instanceof Error ? e.message : "Error",
          variant: "error",
        });
      }
    });
  }

  function deactivate() {
    if (!deactivateId) return;
    start(async () => {
      try {
        await proxyWrite("DELETE", `/api/v1/admin/coupons/${deactivateId}`);
        toast.push({ title: "Coupon deactivated", variant: "success" });
        setDeactivateId(null);
        refresh();
      } catch (e: unknown) {
        toast.push({
          title: "Failed",
          message: e instanceof Error ? e.message : "Error",
          variant: "error",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Coupons"
        description="Create, edit, and revoke promo codes."
        meta={`Total: ${data.pagination.total}`}
      />

      <TableFilters
        fields={[
          {
            name: "is_active",
            label: "Active",
            type: "select",
            options: [
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ],
          },
        ]}
      />

      <div className="kiyaari-panel space-y-3 rounded-lg p-4">
        <div className="text-sm font-semibold">Create coupon</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Code</label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="WELCOME500"
            />
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Type</label>
            <ThemedSelect
              className="w-full"
              value={form.discount_type}
              onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
            >
              <option value="FLAT">FLAT</option>
              <option value="PERCENTAGE">PERCENTAGE</option>
            </ThemedSelect>
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Value</label>
            <Input
              value={form.discount_value}
              onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Applicable for</label>
            <ThemedSelect
              className="w-full"
              value={form.applicable_for}
              onChange={(e) => setForm({ ...form, applicable_for: e.target.value })}
            >
              <option value="ALL">ALL</option>
              <option value="RENT">RENT</option>
              <option value="BUY">BUY</option>
              <option value="SERVICE">SERVICE</option>
            </ThemedSelect>
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Usage limit</label>
            <Input
              value={form.usage_limit}
              onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Valid from</label>
            <Input
              type="datetime-local"
              value={form.valid_from}
              onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Valid until</label>
            <Input
              type="datetime-local"
              value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            />
          </div>
        </div>
        <Button disabled={busy || !form.code.trim()} onClick={createCoupon}>
          + Create coupon
        </Button>
      </div>

      {editId && editing && (
        <div className="kiyaari-panel space-y-3 rounded-lg p-4 ring-2 ring-[var(--primary)]">
          <div className="text-sm font-semibold">Edit {editing.code}</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="kiyaari-text-muted text-xs">Value</label>
              <Input
                value={editForm.discount_value}
                onChange={(e) => setEditForm({ ...editForm, discount_value: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="kiyaari-text-muted text-xs">Usage limit</label>
              <Input
                value={editForm.usage_limit}
                onChange={(e) => setEditForm({ ...editForm, usage_limit: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="kiyaari-text-muted text-xs">Active</label>
              <ThemedSelect
                className="w-full"
                value={editForm.is_active ? "true" : "false"}
                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === "true" })}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </ThemedSelect>
            </div>
            <div className="space-y-1">
              <label className="kiyaari-text-muted text-xs">Valid from</label>
              <Input
                type="datetime-local"
                value={editForm.valid_from}
                onChange={(e) => setEditForm({ ...editForm, valid_from: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="kiyaari-text-muted text-xs">Valid until</label>
              <Input
                type="datetime-local"
                value={editForm.valid_until}
                onChange={(e) => setEditForm({ ...editForm, valid_until: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={saveEdit}>
              Save changes
            </Button>
            <Button variant="secondary" onClick={() => setEditId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Promo codes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Code</Th>
                <Th>Type</Th>
                <Th>Value</Th>
                <Th>For</Th>
                <Th>Limit</Th>
                <Th>Valid</Th>
                <Th>Active</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-mono font-medium">{c.code}</Td>
                  <Td>{c.discountType}</Td>
                  <Td>{String(c.discountValue)}</Td>
                  <Td>{c.applicableFor}</Td>
                  <Td>{c.usageLimit ?? "∞"}</Td>
                  <Td className="text-xs">
                    {fmtDate(c.validFrom)} → {fmtDate(c.validUntil)}
                  </Td>
                  <Td>
                    <Badge variant={c.isActive ? "success" : "danger"}>
                      {c.isActive ? "YES" : "NO"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditId(c.id)}>
                        Edit
                      </Button>
                      {c.isActive && (
                        <Button variant="danger" size="sm" onClick={() => setDeactivateId(c.id)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deactivateId}
        onOpenChange={(o) => !o && setDeactivateId(null)}
        title="Revoke coupon"
        description="This deactivates the coupon for all users."
        confirmText="Revoke"
        variant="danger"
        busy={busy}
        onConfirm={deactivate}
      />
    </div>
  );
}
