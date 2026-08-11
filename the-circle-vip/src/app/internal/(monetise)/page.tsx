import { HomeView } from "@/components/internal/home-view";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Home · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function InternalHomePage() {
  await requireInternalSession();
  const stats = await getInternalDashboardStats();
  return <HomeView initialStats={stats} />;
}
