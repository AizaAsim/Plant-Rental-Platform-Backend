import { cookies } from "next/headers";

export const ACCESS_TOKEN_COOKIE = "admin_access_token";
export const REFRESH_TOKEN_COOKIE = "admin_refresh_token";

export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function setAuthCookies(input: {
  accessToken: string;
  refreshToken?: string | null;
  maxAgeSeconds?: number;
}) {
  const jar = await cookies();
  jar.set(ACCESS_TOKEN_COOKIE, input.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: input.maxAgeSeconds ?? 60 * 60 * 24,
  });

  if (input.refreshToken) {
    jar.set(REFRESH_TOKEN_COOKIE, input.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.set(ACCESS_TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  jar.set(REFRESH_TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

