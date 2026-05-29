"use client";

import { Suspense, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Field = {
  name: string;
  label: string;
  type?: "text" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export function TableFilters(props: { fields: Field[] }) {
  return (
    <Suspense fallback={<div className="h-16 animate-pulse rounded-lg opacity-40 kiyaari-card border" />}>
      <TableFiltersInner {...props} />
    </Suspense>
  );
}

function TableFiltersInner({ fields }: { fields: Field[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function apply(form: FormData) {
    const next = new URLSearchParams();
    next.set("page", "1");
    for (const f of fields) {
      const v = String(form.get(f.name) ?? "").trim();
      if (v) next.set(f.name, v);
    }
    start(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border p-3 kiyaari-card"
      style={{ borderColor: "var(--card-border)" }}
      onSubmit={(e) => {
        e.preventDefault();
        apply(new FormData(e.currentTarget));
      }}
    >
      {fields.map((f) => (
        <div key={f.name} className="space-y-1">
          <label className="text-xs font-medium" style={{ color: "var(--muted)" }}>
            {f.label}
          </label>
          {f.type === "select" ? (
            <select
              name={f.name}
              defaultValue={sp.get(f.name) ?? ""}
              className="h-10 min-w-[140px] rounded-md border px-3 text-sm"
              style={{
                borderColor: "var(--card-border)",
                background: "var(--card)",
                color: "var(--foreground)",
              }}
            >
              <option value="">All</option>
              {(f.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={f.name}
              defaultValue={sp.get(f.name) ?? ""}
              placeholder={f.placeholder}
              className="h-10 min-w-[160px] rounded-md border px-3 text-sm"
              style={{
                borderColor: "var(--card-border)",
                background: "var(--card)",
                color: "var(--foreground)",
              }}
            />
          )}
        </div>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="kiyaari-btn-primary h-10 rounded-md px-4 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "…" : "Apply filters"}
      </button>
      <button
        type="button"
        className="h-10 rounded-md border px-4 text-sm"
        style={{ borderColor: "var(--card-border)", color: "var(--muted)" }}
        onClick={() => start(() => router.push(pathname))}
      >
        Clear
      </button>
    </form>
  );
}
