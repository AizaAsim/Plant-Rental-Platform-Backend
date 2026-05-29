export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export function apiBaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_API_BASE_URL").replace(/\/+$/, "");
}

