"use server";

import { backendFetch } from "@/lib/backend";
import { revalidatePath } from "next/cache";

export async function verifyGardener(gardenerId: string, isVerified: boolean) {
  await backendFetch(`/api/v1/admin/gardeners/${encodeURIComponent(gardenerId)}/verify`, {
    method: "PUT",
    body: JSON.stringify({ is_verified: isVerified }),
  });
  revalidatePath("/admin/gardeners");
}
