"use server";

import { backendFetch } from "@/lib/backend";
import { revalidatePath } from "next/cache";

export async function setUserActive(userId: string, isActive: boolean, reason?: string) {
  await backendFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ is_active: isActive, reason }),
  });
  revalidatePath("/admin/users");
}

export async function verifyUser(userId: string) {
  await backendFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/verify`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
  revalidatePath("/admin/users");
}

