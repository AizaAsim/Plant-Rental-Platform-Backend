"use server";

import { backendFetch } from "@/lib/backend";
import { revalidatePath } from "next/cache";

export async function resolveManualOrder(orderId: string, action: string, note?: string) {
  await backendFetch(`/api/v1/admin/manual-orders/${encodeURIComponent(orderId)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action, note }),
  });
  revalidatePath("/admin/manual-orders");
}
