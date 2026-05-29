import { fetchAdmin } from "@/lib/admin-page";
import { CategoriesManager, type CatNode } from "./categories-manager";

export default async function AdminCategoriesPage() {
  const tree = await fetchAdmin<CatNode[]>("/api/v1/admin/categories", "/admin/categories");
  return <CategoriesManager tree={tree} />;
}
