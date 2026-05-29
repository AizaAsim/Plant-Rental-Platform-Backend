"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/page-header";
import { proxyWrite } from "@/lib/proxy-client";

export type CatNode = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  children?: CatNode[];
};

type FlatRow = { node: CatNode; depth: number };

function flatten(nodes: CatNode[], depth = 0): FlatRow[] {
  const out: FlatRow[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.children?.length) out.push(...flatten(n.children, depth + 1));
  }
  return out;
}

export function CategoriesManager({ tree }: { tree: CatNode[] }) {
  const router = useRouter();
  const toast = useToast();
  const allRows = React.useMemo(() => flatten(tree), [tree]);

  const [search, setSearch] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<"all" | "yes" | "no">("all");
  const [newName, setNewName] = React.useState("");
  const [parentId, setParentId] = React.useState("");
  const [busy, start] = React.useTransition();
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const deleteTarget = allRows.find((r) => r.node.id === deleteId)?.node;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(({ node }) => {
      if (activeFilter === "yes" && !node.isActive) return false;
      if (activeFilter === "no" && node.isActive) return false;
      if (!q) return true;
      return (
        node.name.toLowerCase().includes(q) ||
        node.slug.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q)
      );
    });
  }, [allRows, search, activeFilter]);

  function refresh() {
    router.refresh();
  }

  function addCategory() {
    const name = newName.trim();
    if (!name) {
      toast.push({ title: "Name required", variant: "error" });
      return;
    }
    start(async () => {
      try {
        await proxyWrite("POST", "/api/v1/admin/categories", {
          name,
          ...(parentId.trim() ? { parent_id: parentId.trim() } : {}),
        });
        setNewName("");
        setParentId("");
        toast.push({ title: "Category created", variant: "success" });
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

  function toggleActive(id: string, isActive: boolean) {
    start(async () => {
      try {
        await proxyWrite("PUT", `/api/v1/admin/categories/${id}`, { is_active: !isActive });
        toast.push({ title: "Updated", variant: "success" });
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

  function deleteCategory() {
    if (!deleteId) return;
    start(async () => {
      try {
        await proxyWrite("DELETE", `/api/v1/admin/categories/${deleteId}`);
        toast.push({ title: "Category deleted", variant: "success" });
        setDeleteId(null);
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
        title="Categories"
        description="Plant category tree for catalog and browse."
        meta={`${filtered.length} shown · ${allRows.length} total`}
      />

      <div className="space-y-3 rounded-lg border p-4 kiyaari-card">
        <div className="text-sm font-medium">Filters</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px] flex-1 space-y-1">
            <label className="kiyaari-text-muted text-xs font-medium">Search</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, slug, or ID…"
            />
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs font-medium">Active</label>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as "all" | "yes" | "no")}
              className="h-10 min-w-[120px] rounded-md border px-3 text-sm"
              style={{
                borderColor: "var(--card-border)",
                background: "var(--card)",
                color: "var(--foreground)",
              }}
            >
              <option value="all">All</option>
              <option value="yes">Active only</option>
              <option value="no">Inactive only</option>
            </select>
          </div>
          {(search || activeFilter !== "all") && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearch("");
                setActiveFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className="border-t pt-3" style={{ borderColor: "var(--card-border)" }}>
          <div className="mb-2 text-sm font-medium">Add category</div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[160px] flex-1 space-y-1">
              <label className="kiyaari-text-muted text-xs font-medium">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name" />
            </div>
            <div className="min-w-[200px] flex-1 space-y-1">
              <label className="kiyaari-text-muted text-xs font-medium">Parent ID (optional)</label>
              <Input
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                placeholder="UUID of parent category"
              />
            </div>
            <Button type="button" disabled={busy} onClick={addCategory}>
              + Add category
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category tree</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Name</Th>
                <Th>Slug</Th>
                <Th>Active</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filtered.map(({ node, depth }) => (
                <Tr key={node.id}>
                  <Td className="font-medium" style={{ paddingLeft: 12 + depth * 16 }}>
                    {depth > 0 ? "↳ " : ""}
                    {node.name}
                  </Td>
                  <Td className="font-mono text-xs">{node.slug}</Td>
                  <Td>
                    <Badge variant={node.isActive ? "success" : "default"}>
                      {node.isActive ? "YES" : "NO"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => toggleActive(node.id, node.isActive)}
                      >
                        {node.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => setDeleteId(node.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
              {filtered.length === 0 && (
                <Tr>
                  <Td colSpan={4} className="py-10 text-center kiyaari-text-muted">
                    No categories match your filters.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete category"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" — must have no plants or child categories.`
            : ""
        }
        confirmText="Delete"
        variant="danger"
        busy={busy}
        onConfirm={deleteCategory}
      />
    </div>
  );
}
