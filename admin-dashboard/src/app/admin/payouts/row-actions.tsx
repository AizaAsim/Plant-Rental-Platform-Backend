"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { processPayout } from "./actions";

export function PayoutRowActions({
  payoutId,
  payoutNumber,
  status,
}: {
  payoutId: string;
  payoutNumber: string;
  status: string;
}) {
  const toast = useToast();
  const [busy, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const canProcess = status === "PENDING" || status === "PROCESSING";

  if (!canProcess) return <span className="text-xs text-zinc-400">—</span>;

  return (
    <>
      <Button variant="primary" size="sm" disabled={busy} onClick={() => setOpen(true)}>
        Mark completed
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Complete payout"
        description={payoutNumber}
        variant="danger"
        busy={busy}
        onConfirm={() =>
          start(async () => {
            try {
              await processPayout(payoutId, "COMPLETED", `ADM-${Date.now()}`);
              toast.push({ title: "Payout updated", variant: "success" });
              setOpen(false);
            } catch (e: unknown) {
              toast.push({
                title: "Failed",
                message: e instanceof Error ? e.message : "Error",
                variant: "error",
              });
            }
          })
        }
      />
    </>
  );
}
