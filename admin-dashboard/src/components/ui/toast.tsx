"use client";

import * as React from "react";
import { cn } from "./cn";

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  variant?: "success" | "error" | "info";
};

type ToastContextValue = {
  push: (t: Omit<ToastItem, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const push = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random()}`;
    const item: ToastItem = { id, variant: "info", ...t };
    setItems((prev) => [item, ...prev].slice(0, 5));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg border bg-white px-3 py-2 shadow-sm",
              t.variant === "success" && "border-green-200",
              t.variant === "error" && "border-red-200",
              t.variant === "info" && "border-zinc-200"
            )}
          >
            <div className="text-sm font-medium text-zinc-900">{t.title}</div>
            {t.message && <div className="text-xs text-zinc-600">{t.message}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

