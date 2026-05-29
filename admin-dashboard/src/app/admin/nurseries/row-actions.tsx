"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { setNurseryActive, verifyNursery } from "./actions";

export function NurseryRowActions({
  nurseryId,
  name,
  isActive,
  isVerified,
}: {
  nurseryId: string;
  name: string;
  isActive: boolean;
  isVerified: boolean;
}) {
  const toast = useToast();
  const [busy, start] = React.useTransition();
  const [openToggle, setOpenToggle] = React.useState(false);
  const [openVerify, setOpenVerify] = React.useState(false);

  return (
    <div className="inline-flex flex-wrap justify-end gap-2">
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => setOpenToggle(true)}>
        {isActive ? "Deactivate" : "Activate"}
      </Button>
      <Button variant="secondary" size="sm" disabled={busy || isVerified} onClick={() => setOpenVerify(true)}>
        Verify
      </Button>

      <ConfirmDialog
        open={openToggle}
        onOpenChange={setOpenToggle}
        title={`${isActive ? "Deactivate" : "Activate"} nursery`}
        description={name}
        variant="danger"
        busy={busy}
        onConfirm={() =>
          start(async () => {
            try {
              await setNurseryActive(nurseryId, !isActive, "Admin dashboard");
              toast.push({ title: "Updated", variant: "success" });
              setOpenToggle(false);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Error";
              toast.push({ title: "Failed", message: msg, variant: "error" });
            }
          })
        }
      />
      <ConfirmDialog
        open={openVerify}
        onOpenChange={setOpenVerify}
        title="Verify nursery"
        description={name}
        variant="primary"
        busy={busy}
        onConfirm={() =>
          start(async () => {
            try {
              await verifyNursery(nurseryId, true);
              toast.push({ title: "Verified", variant: "success" });
              setOpenVerify(false);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Error";
              toast.push({ title: "Failed", message: msg, variant: "error" });
            }
          })
        }
      />
    </div>
  );
}
