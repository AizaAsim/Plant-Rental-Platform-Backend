"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateFreelanceMatchConfig } from "./actions";

export function FreelanceMatchForm({
  autoMatchEnabled,
  scoreThreshold,
  acceptWindowMinutes,
}: {
  autoMatchEnabled: boolean;
  scoreThreshold: number;
  acceptWindowMinutes: number;
}) {
  const toast = useToast();
  const [enabled, setEnabled] = React.useState(autoMatchEnabled);
  const [threshold, setThreshold] = React.useState(String(scoreThreshold));
  const [minutes, setMinutes] = React.useState(String(acceptWindowMinutes));
  const [busy, start] = React.useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            await updateFreelanceMatchConfig({
              auto_match_enabled: enabled,
              auto_match_score_threshold: Number(threshold),
              gardener_accept_window_minutes: Number(minutes),
            });
            toast.push({ title: "Freelance match config saved", variant: "success" });
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        Auto-match enabled
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700">Score threshold (0–1)</label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700">Accept window (minutes)</label>
          <Input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save freelance config"}
      </Button>
    </form>
  );
}
