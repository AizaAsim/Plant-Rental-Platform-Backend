"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemedSelect } from "@/components/admin/themed-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { useToast } from "@/components/ui/toast";
import { proxyGet, proxyWrite } from "@/lib/proxy-client";

export type Featured = {
  id: string;
  featureType: string;
  displayOrder: number;
  isActive: boolean;
  plant?: { name: string; nursery?: { name: string } };
};

type PlantOption = { id: string; name: string; nursery?: { name: string } };

const FEATURE_TYPES = ["TRENDING", "SEASONAL", "EDITOR_PICK", "NEW_ARRIVAL"];

export function FeaturedManager({ items }: { items: Featured[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = React.useTransition();
  const [removeId, setRemoveId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<"all" | "yes" | "no">("all");

  const [plantSearch, setPlantSearch] = React.useState("");
  const [plantOptions, setPlantOptions] = React.useState<PlantOption[]>([]);
  const [selectedPlantId, setSelectedPlantId] = React.useState("");
  const [featureType, setFeatureType] = React.useState("TRENDING");
  const [displayOrder, setDisplayOrder] = React.useState("1");

  React.useEffect(() => {
    const q = plantSearch.trim();
    if (q.length < 2) {
      setPlantOptions([]);
      return;
    }
    const t = setTimeout(() => {
      proxyGet<PlantOption[]>(`/api/v1/admin/plants?search=${encodeURIComponent(q)}&limit=15`)
        .then(setPlantOptions)
        .catch(() => setPlantOptions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [plantSearch]);

  const filtered = React.useMemo(() => {
    return items.filter((f) => {
      if (activeFilter === "yes" && !f.isActive) return false;
      if (activeFilter === "no" && f.isActive) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        f.plant?.name?.toLowerCase().includes(q) ||
        f.featureType.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
      );
    });
  }, [items, search, activeFilter]);

  function refresh() {
    router.refresh();
  }

  function addFeatured() {
    if (!selectedPlantId) {
      toast.push({ title: "Select a plant", variant: "error" });
      return;
    }
    start(async () => {
      try {
        await proxyWrite("POST", "/api/v1/admin/featured-plants", {
          plant_id: selectedPlantId,
          feature_type: featureType,
          display_order: Number(displayOrder) || 0,
        });
        toast.push({ title: "Featured listing added", variant: "success" });
        setSelectedPlantId("");
        setPlantSearch("");
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
        await proxyWrite("PUT", `/api/v1/admin/featured-plants/${id}`, { is_active: !isActive });
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

  function removeFeatured() {
    if (!removeId) return;
    start(async () => {
      try {
        await proxyWrite("DELETE", `/api/v1/admin/featured-plants/${removeId}`);
        toast.push({ title: "Removed from curated list", variant: "success" });
        setRemoveId(null);
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
        title="Featured plants"
        description="Curated home-screen listings by feature slot."
        meta={`${filtered.length} shown · ${items.length} total`}
      />

      <div className="kiyaari-panel space-y-3 rounded-lg p-4">
        <div className="text-sm font-semibold">Filters</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px] flex-1 space-y-1">
            <label className="kiyaari-text-muted text-xs">Search listings</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Plant name or feature type…"
            />
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Active</label>
            <ThemedSelect
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as "all" | "yes" | "no")}
            >
              <option value="all">All</option>
              <option value="yes">Active</option>
              <option value="no">Inactive</option>
            </ThemedSelect>
          </div>
        </div>
      </div>

      <div className="kiyaari-panel space-y-3 rounded-lg p-4">
        <div className="text-sm font-semibold">Add to curated list</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <label className="kiyaari-text-muted text-xs">Find plant (type 2+ chars)</label>
            <Input
              value={plantSearch}
              onChange={(e) => {
                setPlantSearch(e.target.value);
                setSelectedPlantId("");
              }}
              placeholder="Snake Plant, Monstera…"
            />
            {plantOptions.length > 0 && (
              <ThemedSelect
                className="mt-1 w-full"
                value={selectedPlantId}
                onChange={(e) => setSelectedPlantId(e.target.value)}
              >
                <option value="">Select plant…</option>
                {plantOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.nursery?.name ?? "Nursery"}
                  </option>
                ))}
              </ThemedSelect>
            )}
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Feature slot</label>
            <ThemedSelect value={featureType} onChange={(e) => setFeatureType(e.target.value)}>
              {FEATURE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </ThemedSelect>
          </div>
          <div className="space-y-1">
            <label className="kiyaari-text-muted text-xs">Display order</label>
            <Input
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
          </div>
        </div>
        <Button disabled={busy || !selectedPlantId} onClick={addFeatured}>
          + Add featured plant
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Curated listings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <Tr>
                <Th>Plant</Th>
                <Th>Nursery</Th>
                <Th>Feature</Th>
                <Th>Order</Th>
                <Th>Active</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <Tr key={f.id}>
                  <Td className="font-medium">{f.plant?.name ?? f.id}</Td>
                  <Td>{f.plant?.nursery?.name ?? "—"}</Td>
                  <Td>
                    <Badge>{f.featureType}</Badge>
                  </Td>
                  <Td>{f.displayOrder}</Td>
                  <Td>
                    <Badge variant={f.isActive ? "success" : "default"}>
                      {f.isActive ? "YES" : "NO"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex flex-wrap justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => toggleActive(f.id, f.isActive)}
                      >
                        {f.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="danger" size="sm" disabled={busy} onClick={() => setRemoveId(f.id)}>
                        Remove
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
              {filtered.length === 0 && (
                <Tr>
                  <Td colSpan={6} className="py-10 text-center kiyaari-text-muted">
                    No listings match your filters.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!removeId}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Remove from curated list"
        description="This removes the plant from the featured section."
        confirmText="Remove"
        variant="danger"
        busy={busy}
        onConfirm={removeFeatured}
      />
    </div>
  );
}
