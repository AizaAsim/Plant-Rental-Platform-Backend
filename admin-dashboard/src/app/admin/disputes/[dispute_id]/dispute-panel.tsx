"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { addDisputeMessage, resolveDispute } from "./actions";

export function DisputePanel({ disputeId, status }: { disputeId: string; status: string }) {
  const toast = useToast();
  const [msg, setMsg] = React.useState("");
  const [resolution, setResolution] = React.useState("");
  const [busy, start] = React.useTransition();

  return (
    <div className="kiyaari-panel space-y-4 rounded-lg p-4">
      <div className="text-sm font-semibold">Admin actions</div>
      <div className="space-y-2">
        <div className="kiyaari-text-muted text-xs font-medium">Reply to dispute</div>
        <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Your message…" />
        <Button
          variant="secondary"
          disabled={busy || !msg.trim()}
          onClick={() =>
            start(async () => {
              try {
                await addDisputeMessage(disputeId, msg);
                setMsg("");
                toast.push({ title: "Message sent", variant: "success" });
              } catch (e: unknown) {
                toast.push({
                  title: "Failed",
                  message: e instanceof Error ? e.message : "Error",
                  variant: "error",
                });
              }
            })
          }
        >
          Send message
        </Button>
      </div>
      {status !== "RESOLVED" && (
        <div className="space-y-2 border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
          <div className="kiyaari-text-muted text-xs font-medium">Resolve dispute</div>
          <Textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution text…"
          />
          <Button
            variant="danger"
            disabled={busy || !resolution.trim()}
            onClick={() =>
              start(async () => {
                try {
                  await resolveDispute(disputeId, resolution);
                  toast.push({ title: "Resolved", variant: "success" });
                } catch (e: unknown) {
                  toast.push({
                    title: "Failed",
                    message: e instanceof Error ? e.message : "Error",
                    variant: "error",
                  });
                }
              })
            }
          >
            Mark resolved
          </Button>
        </div>
      )}
    </div>
  );
}
