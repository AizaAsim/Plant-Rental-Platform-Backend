import { cn } from "@/components/ui/cn";

export function PageHeader({
  title,
  description,
  meta,
  actions,
  className,
}: {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h1 className="kiyaari-page-title text-xl font-semibold">{title}</h1>
        {description && <p className="kiyaari-page-subtitle mt-1 text-sm">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {meta && <div className="kiyaari-text-muted text-xs">{meta}</div>}
        {actions}
      </div>
    </div>
  );
}
