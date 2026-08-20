import { MarketingStatsView } from "@/components/internal/marketing-stats-view";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Stats · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function MarketingStatsPage() {
  await requireInternalSession();
  const stats = await getInternalDashboardStats(30);
  return <MarketingStatsView initialStats={stats} />;
}
