import { fetchAdmin } from "@/lib/admin-page";
import { FeaturedManager, type Featured } from "./featured-manager";

export default async function AdminFeaturedPlantsPage() {
  const items = await fetchAdmin<Featured[]>(
    "/api/v1/admin/featured-plants",
    "/admin/featured-plants"
  );
  return <FeaturedManager items={items} />;
}
