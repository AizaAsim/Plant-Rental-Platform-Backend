"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { upsertPlatformSetting } from "./actions";

export function AddSettingForm() {
  const toast = useToast();
  const [key, setKey] = React.useState("");
  const [value, setValue] = React.useState("");
  const [busy, start] = React.useTransition();

  return (
    <form
      className="flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            await upsertPlatformSetting(key.trim(), value);
            toast.push({ title: "Setting created", variant: "success" });
            setKey("");
            setValue("");
          } catch (err: unknown) {
            toast.push({
              title: "Failed",
              message: err instanceof Error ? err.message : "Error",
              variant: "error",
            });
          }
        });
      }}
    >
      <div className="flex-1 space-y-1">
        <label className="text-xs font-medium text-zinc-700">New key</label>
        <Input placeholder="e.g. feature.xyz_enabled" value={key} onChange={(e) => setKey(e.target.value)} />
      </div>
      <div className="flex-1 space-y-1">
        <label className="text-xs font-medium text-zinc-700">Value</label>
        <Input placeholder="true / 123 / JSON string" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy || !key.trim()}>
        Add / update
      </Button>
    </form>
  );
}
