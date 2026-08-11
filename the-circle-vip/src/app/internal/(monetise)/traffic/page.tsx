import { TrafficView } from "@/components/internal/traffic-view";
import { getCloudflareZoneTraffic } from "@/lib/cloudflare-zone-analytics.server";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Traffic · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function TrafficPage() {
  await requireInternalSession();
  const [stats, cloudflare] = await Promise.all([
    getInternalDashboardStats(),
    getCloudflareZoneTraffic(30),
  ]);
  return (
    <TrafficView initialStats={stats} initialCloudflare={cloudflare} />
  );
}
