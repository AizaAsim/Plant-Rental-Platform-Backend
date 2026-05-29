import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export function QuickLink({
  href,
  label,
  icon,
  description,
}: {
  href: string;
  label: string;
  icon: string;
  description?: string;
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="kiyaari-quick-link h-full transition-all">
        <CardContent className="flex items-center gap-3 py-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition-transform group-hover:scale-110"
            style={{ background: "var(--accent)" }}
            aria-hidden
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {label}
            </div>
            {description && (
              <div className="kiyaari-text-muted truncate text-xs">{description}</div>
            )}
          </div>
          <span
            className="text-lg opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
            style={{ color: "var(--primary)" }}
            aria-hidden
          >
            →
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
