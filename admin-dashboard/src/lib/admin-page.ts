import { backendFetch, BackendFetchError } from "./backend";
import { redirect } from "next/navigation";

export async function fetchAdmin<T>(path: string, loginNext: string): Promise<T> {
  try {
    return await backendFetch<T>(path);
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) {
      redirect(`/login?next=${encodeURIComponent(loginNext)}`);
    }
    throw e;
  }
}

/** Use when an endpoint may be missing on older API deployments (e.g. 404). */
export async function fetchAdminOptional<T>(
  path: string,
  loginNext: string
): Promise<{ data: T | null; error: string | null; status?: number }> {
  try {
    const data = await backendFetch<T>(path);
    return { data, error: null };
  } catch (e: unknown) {
    if (e instanceof BackendFetchError) {
      if (e.status === 401) {
        redirect(`/login?next=${encodeURIComponent(loginNext)}`);
      }
      return { data: null, error: e.message, status: e.status };
    }
    const err = e as { status?: number; message?: string };
    if (err?.status === 401) {
      redirect(`/login?next=${encodeURIComponent(loginNext)}`);
    }
    return {
      data: null,
      error: err?.message ?? "Request failed",
      status: err?.status,
    };
  }
}

export type { Paginated } from "./format";
export { fmtDate, fmtMoney } from "./format";

export function buildQuery(
  params: Record<string, string | undefined>,
  defaults: { page?: number; limit?: number } = {}
): string {
  const sp = new URLSearchParams();
  sp.set("page", params.page || String(defaults.page ?? 1));
  sp.set("limit", params.limit || String(defaults.limit ?? 20));
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || k === "limit") continue;
    if (v) sp.set(k, v);
  }
  return sp.toString();
}

