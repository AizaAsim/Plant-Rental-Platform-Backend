"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { setUserActive, verifyUser } from "./actions";

export function UserRowActions({
  userId,
  isActive,
  isVerified,
}: {
  userId: string;
  isActive: boolean;
  isVerified: boolean;
}) {
  const toast = useToast();
  const [busy, start] = React.useTransition();
  const [openToggle, setOpenToggle] = React.useState(false);
  const [openVerify, setOpenVerify] = React.useState(false);

  return (
    <div className="inline-flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => setOpenToggle(true)} disabled={busy}>
        {isActive ? "Deactivate" : "Activate"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpenVerify(true)}
        disabled={busy || isVerified}
      >
        Verify
      </Button>

      <ConfirmDialog
        open={openToggle}
        onOpenChange={setOpenToggle}
        title={`${isActive ? "Deactivate" : "Activate"} user`}
        description={`User ID: ${userId}`}
        confirmText={isActive ? "Deactivate" : "Activate"}
        variant="danger"
        busy={busy}
        onConfirm={() =>
          start(async () => {
            try {
              await setUserActive(userId, !isActive, "Changed by admin dashboard");
              toast.push({ title: "Updated", variant: "success" });
              setOpenToggle(false);
            } catch (e: any) {
              toast.push({ title: "Failed", message: e?.message || "Error", variant: "error" });
            }
          })
        }
      />

      <ConfirmDialog
        open={openVerify}
        onOpenChange={setOpenVerify}
        title="Verify user"
        description={`User ID: ${userId}`}
        confirmText="Verify"
        variant="primary"
        busy={busy}
        onConfirm={() =>
          start(async () => {
            try {
              await verifyUser(userId);
              toast.push({ title: "Verified", variant: "success" });
              setOpenVerify(false);
            } catch (e: any) {
              toast.push({ title: "Failed", message: e?.message || "Error", variant: "error" });
            }
          })
        }
      />
    </div>
  );
}

