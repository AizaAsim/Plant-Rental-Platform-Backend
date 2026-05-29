export async function proxyGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, { method: "GET" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "Request failed");
  return data as T;
}

export async function proxyWrite<T>(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch("/api/proxy", {
    method,
    headers: { "Content-Type": "application/json", "x-proxy-path": path },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "Request failed");
  return data as T;
}
