"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/admin/brand-logo";
import { ThemeToggle } from "@/components/admin/theme-toggle";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";

  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Login failed");
        return;
      }
      router.push(next);
    });
  }

  return (
    <div
      className="kiyaari-login-bg relative flex min-h-screen items-center justify-center px-4"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30" aria-hidden>
        <span className="absolute left-[10%] top-[15%] text-4xl">🪴</span>
        <span className="absolute right-[12%] top-[20%] text-3xl">🌱</span>
        <span className="absolute bottom-[18%] left-[18%] text-3xl">🍃</span>
        <span className="absolute bottom-[22%] right-[20%] text-4xl">🌿</span>
      </div>
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="relative z-10 w-full max-w-md shadow-lg ring-1 ring-[var(--card-border)]">
        <CardHeader className="space-y-3">
          <BrandLogo />
          <CardTitle>Sign in to admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                Email
              </div>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@plantrent.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                Password
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              Requires an account with role <strong>ADMIN</strong> on the Kiyaari API.
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={<div className="min-h-screen" style={{ background: "var(--background)" }} />}
    >
      <LoginInner />
    </React.Suspense>
  );
}
