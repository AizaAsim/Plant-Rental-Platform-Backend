"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { verifyGardener } from "./actions";

export function GardenerRowActions({
  gardenerId,
  name,
  isVerified,
}: {
  gardenerId: string;
  name: string;
  isVerified: boolean;
}) {
  const toast = useToast();
  const [busy, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" disabled={busy || isVerified} onClick={() => setOpen(true)}>
        Verify
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Verify gardener"
        description={name}
        variant="primary"
        busy={busy}
        onConfirm={() =>
          start(async () => {
            try {
              await verifyGardener(gardenerId, true);
              toast.push({ title: "Verified", variant: "success" });
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
