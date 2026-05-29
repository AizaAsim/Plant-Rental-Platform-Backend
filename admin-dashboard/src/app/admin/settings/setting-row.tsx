"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { upsertPlatformSetting } from "./actions";

export function SettingRow({
  settingKey,
  initialValue,
  description,
}: {
  settingKey: string;
  initialValue: string;
  description?: string | null;
}) {
  const toast = useToast();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(initialValue);
  const [busy, start] = React.useTransition();

  const isBool = initialValue === "true" || initialValue === "false";

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="max-w-xs truncate text-sm text-zinc-800">{initialValue}</span>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      {isBool ? (
        <select
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <Input
          className="max-w-md"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
        />
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            start(async () => {
              try {
                await upsertPlatformSetting(settingKey, value);
                toast.push({ title: "Setting saved", variant: "success" });
                setEditing(false);
              } catch (err: unknown) {
                toast.push({
                  title: "Save failed",
                  message: err instanceof Error ? err.message : "Error",
                  variant: "error",
                });
              }
            })
          }
        >
          Save
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => {
            setValue(initialValue);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
      {description && <span className="sr-only">{description}</span>}
    </div>
  );
}
