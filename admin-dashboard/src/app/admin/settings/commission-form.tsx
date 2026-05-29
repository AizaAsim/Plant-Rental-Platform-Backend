"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateCommission } from "./actions";

export function CommissionForm({
  vendorPercent,
  gardenerPercent,
}: {
  vendorPercent: number;
  gardenerPercent: number;
}) {
  const toast = useToast();
  const [vendor, setVendor] = React.useState(String(vendorPercent));
  const [gardener, setGardener] = React.useState(String(gardenerPercent));
  const [busy, start] = React.useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            await updateCommission(Number(vendor), Number(gardener));
            toast.push({ title: "Commission rates saved", variant: "success" });
          } catch (err: unknown) {
            toast.push({
              title: "Save failed",
              message: err instanceof Error ? err.message : "Error",
              variant: "error",
            });
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700">Vendor commission (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
          <p className="text-xs text-zinc-500">Platform cut on vendor order revenue</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700">Gardener commission (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={gardener}
            onChange={(e) => setGardener(e.target.value)}
          />
          <p className="text-xs text-zinc-500">Platform cut on gardener earnings</p>
        </div>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save commission rates"}
      </Button>
    </form>
  );
}
