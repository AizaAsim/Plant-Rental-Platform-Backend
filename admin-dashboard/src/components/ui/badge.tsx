import { cn } from "./cn";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  const v =
    variant === "success"
      ? "kiyaari-badge-success"
      : variant === "warning"
        ? "kiyaari-badge-warning"
        : variant === "danger"
          ? "kiyaari-badge-danger"
          : "kiyaari-badge-default";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        v,
        className
      )}
    >
      {children}
    </span>
  );
}
