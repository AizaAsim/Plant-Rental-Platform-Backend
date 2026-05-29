"use server";

import { backendFetch } from "@/lib/backend";
import { revalidatePath } from "next/cache";

export async function addDisputeMessage(disputeId: string, message: string) {
  await backendFetch(`/api/v1/admin/disputes/${encodeURIComponent(disputeId)}/message`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  revalidatePath(`/admin/disputes/${disputeId}`);
}

export async function resolveDispute(disputeId: string, resolution: string) {
  await backendFetch(`/api/v1/admin/disputes/${encodeURIComponent(disputeId)}/resolve`, {
    method: "PUT",
    body: JSON.stringify({ resolution }),
  });
  revalidatePath(`/admin/disputes/${disputeId}`);
  revalidatePath("/admin/disputes");
}
