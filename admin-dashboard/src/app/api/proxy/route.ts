import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return NextResponse.json({ message: "Missing path" }, { status: 400 });
  try {
    const data = await backendFetch(path, { method: "GET" });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Request failed", details: e?.details ?? e },
      { status: Number.isFinite(e?.status) && e.status > 0 ? e.status : 500 }
    );
  }
}

async function proxyWrite(req: Request, method: "POST" | "PUT" | "DELETE") {
  const proxyPath = req.headers.get("x-proxy-path");
  if (!proxyPath) {
    return NextResponse.json({ message: "Missing x-proxy-path header" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const data = await backendFetch(proxyPath, {
      method,
      body: method === "DELETE" ? undefined : JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? "Request failed", details: e?.details ?? e },
      { status: Number.isFinite(e?.status) && e.status > 0 ? e.status : 500 }
    );
  }
}

export async function POST(req: Request) {
  return proxyWrite(req, "POST");
}

export async function PUT(req: Request) {
  return proxyWrite(req, "PUT");
}

export async function DELETE(req: Request) {
  return proxyWrite(req, "DELETE");
}

