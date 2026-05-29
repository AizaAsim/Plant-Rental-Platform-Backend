import { buildQuery, fetchAdmin, type Paginated } from "@/lib/admin-page";
import { CouponsManager, type CouponRow } from "./coupons-manager";

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; is_active?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const qs = buildQuery(params);
  const data = await fetchAdmin<Paginated<CouponRow>>(`/api/v1/admin/coupons?${qs}`, "/admin/coupons");
  return <CouponsManager data={data} />;
}
