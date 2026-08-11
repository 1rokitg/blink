import { MembershipsView } from "@/components/internal/memberships-view";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Memberships · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function MembershipsPage() {
  await requireInternalSession();
  const stats = await getInternalDashboardStats();
  return (
    <MembershipsView
      initialMembers={stats.members}
      stripeConfigured={stats.stripeConfigured}
    />
  );
}
