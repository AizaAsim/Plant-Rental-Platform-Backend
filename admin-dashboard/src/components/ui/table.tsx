import * as React from "react";
import { cn } from "./cn";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="kiyaari-card w-full overflow-auto rounded-lg border">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "kiyaari-table-head border-b px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide",
        className
      )}
      style={{ borderColor: "var(--card-border)" }}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border-b px-3 py-2", className)}
      style={{ borderColor: "var(--card-border)", color: "var(--foreground)" }}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:opacity-90", className)} {...props} />;
}

