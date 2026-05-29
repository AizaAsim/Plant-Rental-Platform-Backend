"use server";

import { backendFetch } from "@/lib/backend";
import { revalidatePath } from "next/cache";

export async function verifyNursery(nurseryId: string, isVerified: boolean, rejectionReason?: string) {
  await backendFetch(`/api/v1/admin/nurseries/${encodeURIComponent(nurseryId)}/verify`, {
    method: "PUT",
    body: JSON.stringify({ is_verified: isVerified, rejection_reason: rejectionReason ?? "" }),
  });
  revalidatePath("/admin/nurseries");
}

export async function setNurseryActive(nurseryId: string, isActive: boolean, reason?: string) {
  await backendFetch(`/api/v1/admin/nurseries/${encodeURIComponent(nurseryId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ is_active: isActive, reason }),
  });
  revalidatePath("/admin/nurseries");
}
