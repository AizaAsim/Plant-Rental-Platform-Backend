"use server";

import { backendFetch } from "@/lib/backend";
import { revalidatePath } from "next/cache";

export async function processPayout(payoutId: string, status: string, bankReference?: string) {
  await backendFetch(`/api/v1/admin/payouts/${encodeURIComponent(payoutId)}/process`, {
    method: "PUT",
    body: JSON.stringify({ status, bank_reference: bankReference, notes: "Processed via admin dashboard" }),
  });
  revalidatePath("/admin/payouts");
}
