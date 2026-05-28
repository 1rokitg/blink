import { getAdminStats } from "~/app/actions/get-admin-stats";
import { AdminDashboard } from "~/components/blink/admin-dashboard";
import { DEFAULT_ADMIN_STATS_OPTIONS } from "~/lib/blink/admin-dashboard-defaults";

export async function InternalDashboardOverviewPage() {
  const initialOverviewStats = await getAdminStats(DEFAULT_ADMIN_STATS_OPTIONS);

  return <AdminDashboard initialOverviewStats={initialOverviewStats} />;
}
