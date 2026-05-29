import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/env";
import { setAuthCookies } from "@/lib/cookies";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const res = await fetch(`${apiBaseUrl()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const dataText = await res.text();
  let data: any = null;
  try {
    data = dataText ? JSON.parse(dataText) : null;
  } catch {
    data = dataText;
  }

  if (!res.ok) {
    return NextResponse.json(
      { message: data?.message ?? "Login failed", details: data },
      { status: res.status }
    );
  }

  const accessToken =
    data?.access_token ?? data?.accessToken ?? data?.token ?? data?.data?.access_token;
  const refreshToken =
    data?.refresh_token ?? data?.refreshToken ?? data?.data?.refresh_token ?? null;

  if (!accessToken || typeof accessToken !== "string") {
    return NextResponse.json(
      { message: "Login succeeded but access_token missing", details: data },
      { status: 500 }
    );
  }

  await setAuthCookies({ accessToken, refreshToken });

  return NextResponse.json({
    ok: true,
    profile: data?.user ?? data?.data?.user ?? null,
  });
}

