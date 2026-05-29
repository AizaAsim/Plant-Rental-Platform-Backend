import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchAdmin, fmtDate } from "@/lib/admin-page";
import { DisputePanel } from "./dispute-panel";

type DisputeDetail = {
  id: string;
  disputeNumber: string;
  status: string;
  disputeType: string;
  description?: string;
  messages?: { message: string; createdAt: string; sender?: { fullName: string | null } }[];
};

export default async function AdminDisputeDetailPage({
  params,
}: {
  params: Promise<{ dispute_id: string }>;
}) {
  const { dispute_id } = await params;
  const d = await fetchAdmin<DisputeDetail>(
    `/api/v1/admin/disputes/${encodeURIComponent(dispute_id)}`,
    `/admin/disputes/${dispute_id}`
  );

  return (
    <div className="space-y-4">
      <Link
        href="/admin/disputes"
        className="text-sm font-medium hover:underline"
        style={{ color: "var(--primary)" }}
      >
        ← Back to disputes
      </Link>
      <div className="flex items-center gap-3">
        <div className="text-xl font-semibold text-zinc-900">{d.disputeNumber}</div>
        <Badge>{d.status}</Badge>
        <Badge>{d.disputeType}</Badge>
      </div>
      {d.description && <p className="text-sm text-zinc-600">{d.description}</p>}

      <DisputePanel disputeId={d.id} status={d.status} />

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(d.messages ?? []).map((m, i) => (
            <div key={i} className="kiyaari-message rounded-md p-3 text-sm">
              <div className="kiyaari-text-muted text-xs font-medium">
                {m.sender?.fullName ?? "User"} · {fmtDate(m.createdAt)}
              </div>
              <div className="mt-1">{m.message}</div>
            </div>
          ))}
          {(d.messages ?? []).length === 0 && (
            <div className="text-sm text-zinc-500">No messages yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
