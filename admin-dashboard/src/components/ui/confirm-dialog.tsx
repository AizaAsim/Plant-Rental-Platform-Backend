"use client";

import * as React from "react";
import { Button } from "./button";

export function ConfirmDialog({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "primary" | "danger";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="kiyaari-dialog w-full max-w-md rounded-lg border shadow-lg">
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--card-border)" }}>
          <div className="text-sm font-semibold">{title}</div>
          {description && <div className="kiyaari-dialog-muted mt-1 text-sm">{description}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button variant="secondary" disabled={!!busy} onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            disabled={!!busy}
            onClick={() => void onConfirm()}
          >
            {busy ? "Working…" : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
