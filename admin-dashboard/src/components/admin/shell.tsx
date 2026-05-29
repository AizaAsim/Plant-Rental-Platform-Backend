"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminNav } from "./nav";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "./brand-logo";
import { ThemeToggle } from "./theme-toggle";
import { pageTitleFromPath } from "./nav-config";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const pageTitle = pageTitleFromPath(pathname);

  return (
    <div className="kiyaari-shell-bg relative min-h-screen">
      <header className="kiyaari-header sticky top-0 z-10 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/admin" className="shrink-0">
              <BrandLogo showTagline={false} />
            </Link>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {pageTitle}
              </div>
              <div className="kiyaari-text-muted truncate text-xs">{pathname}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  router.push("/login");
                })
              }
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-4 px-4 py-5">
        <aside className="kiyaari-sidebar col-span-12 rounded-xl border shadow-sm md:col-span-3 lg:sticky lg:top-[4.25rem] lg:self-start">
          <div className="border-b p-4" style={{ borderColor: "var(--card-border)" }}>
            <BrandLogo />
          </div>
          <AdminNav activePath={pathname} />
          <div
            className="kiyaari-sidebar-footer m-2 mt-1 rounded-lg px-3 py-2 text-center text-[10px]"
            style={{ color: "var(--muted)", background: "var(--accent)" }}
          >
            Kiyaari · Plant rental platform
          </div>
        </aside>
        <main className="col-span-12 md:col-span-9">{children}</main>
      </div>
    </div>
  );
}
