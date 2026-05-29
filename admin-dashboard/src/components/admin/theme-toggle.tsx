"use client";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors"
      style={{
        borderColor: "var(--card-border)",
        background: "var(--card)",
        color: "var(--foreground)",
      }}
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      <span aria-hidden>{theme === "light" ? "🌙" : "☀️"}</span>
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
