"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { resolveManualOrder } from "./actions";

export function ManualResolveButton({ orderId }: { orderId: string }) {
  const toast = useToast();
  const [busy, start] = React.useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={() =>
        start(async () => {
          try {
            await resolveManualOrder(orderId, "REASSIGN", "Resolved from admin dashboard");
            toast.push({ title: "Case resolved", variant: "success" });
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
      Resolve
    </Button>
  );
}
