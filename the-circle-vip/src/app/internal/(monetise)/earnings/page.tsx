import { EarningsView } from "@/components/internal/earnings-view";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";
import { getProprReferralSummary } from "@/lib/propr-referrals.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Earnings · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function EarningsPage() {
  await requireInternalSession();
  const [stats, proprReferrals] = await Promise.all([
    getInternalDashboardStats(),
    getProprReferralSummary(),
  ]);
  return (
    <EarningsView initialStats={stats} proprReferrals={proprReferrals} />
  );
}
