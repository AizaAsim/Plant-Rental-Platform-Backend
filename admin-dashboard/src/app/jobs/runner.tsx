"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JsonView } from "@/components/ui/json-view";
import { ThemedSelect } from "@/components/admin/themed-select";
import { useToast } from "@/components/ui/toast";

type JobDef = {
  key: string;
  label: string;
  path: string;
  defaultBody: Record<string, unknown>;
  danger?: boolean;
};

const jobs: JobDef[] = [
  {
    key: "expire_unpaid",
    label: "Expire unpaid (PENDING) orders",
    path: "/api/v1/internal/jobs/orders/expire-unpaid",
    defaultBody: { dry_run: true, window_hours: 6 },
    danger: true,
  },
  {
    key: "expire_slots",
    label: "Expire stale slot proposals",
    path: "/api/v1/internal/jobs/orders/expire-stale-slot-proposals",
    defaultBody: { dry_run: true, fallback_ttl_hours: 6 },
    danger: true,
  },
  {
    key: "expire_payment_windows",
    label: "Expire stale payment windows",
    path: "/api/v1/internal/jobs/orders/expire-stale-payment-windows",
    defaultBody: { dry_run: true },
    danger: true,
  },
  {
    key: "expire_sweep",
    label: "Run expiry sweep (cron equivalent)",
    path: "/api/v1/internal/jobs/orders/expire-sweep",
    defaultBody: {},
    danger: true,
  },
  {
    key: "due_reminders",
    label: "Due reminders (stub)",
    path: "/api/v1/internal/jobs/orders/due-reminders",
    defaultBody: { dry_run: true },
  },
  {
    key: "penalty_sweep",
    label: "Penalty sweep (daily cron equivalent)",
    path: "/api/v1/internal/jobs/orders/penalty-sweep",
    defaultBody: { notify: true },
    danger: true,
  },
  {
    key: "auto_match",
    label: "Freelance auto-match (stub)",
    path: "/api/v1/internal/jobs/freelance-jobs/auto-match",
    defaultBody: { job_id: null },
  },
];

export function JobsRunner() {
  const toast = useToast();
  const [selected, setSelected] = React.useState<JobDef>(jobs[0]);
  const [bodyText, setBodyText] = React.useState<string>(JSON.stringify(jobs[0].defaultBody, null, 2));
  const [result, setResult] = React.useState<unknown>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [confirmed, setConfirmed] = React.useState(false);

  React.useEffect(() => {
    setBodyText(JSON.stringify(selected.defaultBody, null, 2));
    setResult(null);
    setError(null);
    setConfirmed(false);
  }, [selected.key]);

  return (
    <div className="kiyaari-panel space-y-4 rounded-lg p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <div className="kiyaari-text-muted text-xs font-medium">Job</div>
          <ThemedSelect
            className="w-full"
            value={selected.key}
            onChange={(e) => {
              const next = jobs.find((j) => j.key === e.target.value)!;
              setSelected(next);
            }}
          >
            {jobs.map((j) => (
              <option key={j.key} value={j.key}>
                {j.label}
              </option>
            ))}
          </ThemedSelect>
          <div className="kiyaari-text-muted font-mono text-xs">POST {selected.path}</div>
        </div>

        <div className="space-y-1">
          <div className="kiyaari-text-muted text-xs font-medium">Confirm</div>
          <label className="flex items-center gap-2 text-sm">
            <Input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4"
            />
            I understand this can change production data.
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <div className="kiyaari-text-muted text-xs font-medium">Request body (JSON)</div>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          className="kiyaari-textarea min-h-32 w-full rounded-md px-3 py-2 font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={selected.danger ? "danger" : "primary"}
          disabled={pending || !confirmed}
          onClick={() =>
            start(async () => {
              setError(null);
              setResult(null);
              let body: Record<string, unknown> = {};
              try {
                body = bodyText.trim() ? JSON.parse(bodyText) : {};
              } catch (e: unknown) {
                setError(`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`);
                return;
              }

              const res = await fetch(`/api/proxy`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-proxy-path": selected.path },
                body: JSON.stringify(body),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setError(data?.message || "Job failed");
                setResult(data);
                toast.push({ title: "Job failed", message: data?.message || "Error", variant: "error" });
                return;
              }
              setResult(data);
              toast.push({ title: "Job complete", variant: "success" });
            })
          }
        >
          {pending ? "Running…" : "Run job"}
        </Button>
        {!confirmed && <div className="kiyaari-text-muted text-xs">Tick confirm to enable.</div>}
      </div>

      {error && <div className="kiyaari-alert-error rounded-md px-3 py-2 text-sm">{error}</div>}

      {result != null && (
        <div className="space-y-1">
          <div className="kiyaari-text-muted text-xs font-medium">Result</div>
          <JsonView value={result} />
        </div>
      )}
    </div>
  );
}
