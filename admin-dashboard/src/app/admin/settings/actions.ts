"use server";

import { backendFetch } from "@/lib/backend";
import { revalidatePath } from "next/cache";

export async function updateCommission(vendorPercent: number, gardenerPercent: number) {
  const vendor_commission_rate = vendorPercent / 100;
  const gardener_commission_rate = gardenerPercent / 100;
  if (
    !Number.isFinite(vendor_commission_rate) ||
    !Number.isFinite(gardener_commission_rate) ||
    vendor_commission_rate < 0 ||
    vendor_commission_rate > 1 ||
    gardener_commission_rate < 0 ||
    gardener_commission_rate > 1
  ) {
    throw new Error("Rates must be between 0 and 100%");
  }
  await backendFetch("/api/v1/admin/settings/commission", {
    method: "PUT",
    body: JSON.stringify({ vendor_commission_rate, gardener_commission_rate }),
  });
  revalidatePath("/admin/settings");
}

export async function upsertPlatformSetting(key: string, value: string) {
  if (!key.trim()) throw new Error("Key is required");
  if (value === undefined || value === null) throw new Error("Value is required");
  await backendFetch(`/api/v1/admin/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value: String(value) }),
  });
  revalidatePath("/admin/settings");
}

export async function updateFreelanceMatchConfig(body: {
  auto_match_enabled: boolean;
  auto_match_score_threshold: number;
  gardener_accept_window_minutes: number;
}) {
  await backendFetch("/api/v1/admin/settings/freelance-match-config", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  revalidatePath("/admin/settings");
}
