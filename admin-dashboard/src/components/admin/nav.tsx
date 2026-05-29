import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { navGroups } from "./nav-config";

export function AdminNav({ activePath }: { activePath: string }) {
  return (
    <nav className="flex max-h-[calc(100vh-12rem)] flex-col gap-4 overflow-y-auto p-2 md:max-h-[calc(100vh-10rem)]">
      {navGroups.map((group) => (
        <div key={group.title}>
          <div className="kiyaari-nav-group-title px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest">
            {group.title}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((l) => {
              const active =
                activePath === l.href ||
                (l.href !== "/admin" && activePath.startsWith(`${l.href}/`));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "kiyaari-nav-link flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all",
                    active && "kiyaari-nav-link-active font-medium"
                  )}
                >
                  <span className="text-base leading-none opacity-90" aria-hidden>
                    {l.icon}
                  </span>
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
