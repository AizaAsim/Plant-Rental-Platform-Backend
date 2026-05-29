import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonView } from "@/components/ui/json-view";
import { fetchAdmin } from "@/lib/admin-page";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ order_id: string }>;
}) {
  const { order_id } = await params;
  const order = await fetchAdmin<unknown>(
    `/api/v1/admin/orders/${encodeURIComponent(order_id)}`,
    `/admin/orders/${order_id}`
  );

  return (
    <div className="space-y-4">
      <Link href="/admin/orders" className="text-sm text-blue-700 hover:underline">
        ← Back to orders
      </Link>
      <div className="text-xl font-semibold text-zinc-900">Order detail</div>
      <Card>
        <CardHeader>
          <CardTitle>Full record</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonView value={order} />
        </CardContent>
      </Card>
    </div>
  );
}
