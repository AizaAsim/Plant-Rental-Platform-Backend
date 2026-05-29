import { redirect } from "next/navigation";
import { backendFetch, BackendFetchError } from "./backend";
import { prisma } from "./db";
import type { Paginated } from "./format";

export type ComplaintRow = {
  id: string;
  complaintNumber: string;
  subject: string;
  status: string;
  createdAt: string;
  order?: { orderNumber: string };
  user?: { fullName: string | null; email: string | null };
};

export type ComplaintsListResult = {
  data: Paginated<ComplaintRow>;
  source: "api" | "database";
  apiError?: string;
};

async function listFromDatabase(query: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<ComplaintRow>> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(Number(query.limit) || 50, 100);
  const skip = (page - 1) * limit;
  const where = query.status ? { status: query.status as never } : {};

  const [rows, total] = await Promise.all([
    prisma.orderComplaint.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { orderNumber: true } },
        user: { select: { fullName: true, email: true } },
      },
    }),
    prisma.orderComplaint.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      complaintNumber: r.complaintNumber,
      subject: r.subject,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      order: r.order ? { orderNumber: r.order.orderNumber } : undefined,
      user: r.user
        ? { fullName: r.user.fullName, email: r.user.email }
        : undefined,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Loads admin order complaints from the Nest API, or from the DB when the API
 * route is missing on a server that has not been redeployed yet (404).
 */
export async function fetchOrderComplaints(
  pathWithQuery: string,
  loginNext: string,
  query: { status?: string; page?: number; limit?: number }
): Promise<ComplaintsListResult> {
  try {
    const data = await backendFetch<Paginated<ComplaintRow>>(pathWithQuery);
    return { data, source: "api" };
  } catch (e: unknown) {
    if (e instanceof BackendFetchError) {
      if (e.status === 401) {
        redirect(`/login?next=${encodeURIComponent(loginNext)}`);
      }
      if (e.status === 404 && process.env.DATABASE_URL) {
        try {
          const data = await listFromDatabase(query);
          return {
            data,
            source: "database",
            apiError: e.message,
          };
        } catch (dbErr: unknown) {
          const msg = dbErr instanceof Error ? dbErr.message : "Database error";
          if (msg.includes("order_complaints") || msg.includes("does not exist")) {
            throw new BackendFetchError({
              status: 404,
              message:
                "Order complaints table missing. Run: npx prisma migrate deploy (migration 20260526120000_penalty_complaints_extension)",
            });
          }
          throw dbErr;
        }
      }
    }
    throw e;
  }
}
