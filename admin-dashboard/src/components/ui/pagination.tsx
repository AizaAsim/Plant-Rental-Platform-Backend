"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "./button";

export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();

  const mk = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div className="text-xs text-zinc-600">
        Page {page} / {totalPages || 1}
      </div>
      <div className="flex items-center gap-2">
        <Link href={mk(Math.max(1, page - 1))} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : 0}>
          <Button variant="secondary" size="sm" disabled={page <= 1}>
            Prev
          </Button>
        </Link>
        <Link
          href={mk(Math.min(totalPages || 1, page + 1))}
          aria-disabled={page >= (totalPages || 1)}
          tabIndex={page >= (totalPages || 1) ? -1 : 0}
        >
          <Button variant="secondary" size="sm" disabled={page >= (totalPages || 1)}>
            Next
          </Button>
        </Link>
      </div>
    </div>
  );
}

