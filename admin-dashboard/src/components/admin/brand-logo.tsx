import { cn } from "@/components/ui/cn";

export function BrandLogo({ className, showTagline = true }: { className?: string; showTagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl text-lg shadow-sm ring-1"
        style={{
          background: "var(--accent)",
          color: "var(--primary)",
          borderColor: "color-mix(in srgb, var(--primary) 25%, transparent)",
        }}
        aria-hidden
      >
        🌿
      </span>
      <div>
        <div className="text-base font-bold tracking-tight" style={{ color: "var(--primary)" }}>
          Kiyaari
        </div>
        {showTagline && (
          <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Admin Console
          </div>
        )}
      </div>
    </div>
  );
}
