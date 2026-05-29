import * as React from "react";
import { cn } from "./cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]",
        className
      )}
      style={{
        borderColor: "var(--card-border)",
        background: "var(--card)",
        color: "var(--foreground)",
      }}
      {...props}
    />
  );
});

