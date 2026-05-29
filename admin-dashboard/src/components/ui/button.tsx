import * as React from "react";
import { cn } from "./cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  style,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--background)] disabled:opacity-50 disabled:pointer-events-none";
  const v =
    variant === "primary"
      ? "kiyaari-btn-primary border border-transparent"
      : variant === "secondary"
        ? "kiyaari-btn-secondary hover:opacity-100"
        : variant === "danger"
          ? "bg-red-600 text-white hover:bg-red-500"
          : "bg-transparent hover:opacity-80";
  const themed = variant === "ghost" ? { color: "var(--foreground)" } : undefined;
  const s = size === "sm" ? "h-9 px-3 text-sm" : size === "lg" ? "h-12 px-5" : "h-10 px-4";
  return (
    <button
      className={cn(base, v, s, className)}
      style={{ ...themed, ...style }}
      {...props}
    />
  );
}
