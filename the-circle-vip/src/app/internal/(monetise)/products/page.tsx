import { ProductsView } from "@/components/internal/products-view";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Products · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function ProductsPage() {
  await requireInternalSession();
  const stats = await getInternalDashboardStats();
  return <ProductsView initialStore={stats.store} />;
}
