import { apiBaseUrl } from "./env";
import { getAccessToken } from "./cookies";

export type BackendError = {
  status: number;
  message: string;
  details?: unknown;
};

export class BackendFetchError extends Error implements BackendError {
  status: number;
  details?: unknown;

  constructor(input: BackendError) {
    super(input.message);
    this.name = "BackendFetchError";
    this.status = input.status;
    this.details = input.details;
  }
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function backendFetch<T = unknown>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const url = `${apiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const auth = init.auth !== false;

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body != null) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (e: any) {
    // Network errors (ECONNREFUSED, DNS, etc.)
    throw new BackendFetchError({
      status: 0,
      message: "Backend fetch failed (network error). Is the API server running?",
      details: { url, cause: e?.cause ?? e },
    });
  }

  if (!res.ok) {
    const data = await readJsonSafe(res);
    const msg =
      typeof data === "object" && data && "message" in (data as any)
        ? String((data as any).message)
        : `Request failed with status ${res.status}`;
    throw new BackendFetchError({ status: res.status, message: msg, details: data });
  }

  return (await readJsonSafe(res)) as T;
}

