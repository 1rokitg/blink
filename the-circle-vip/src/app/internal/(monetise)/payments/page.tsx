import { PaymentsView } from "@/components/internal/payments-view";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Payments · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function PaymentsPage() {
  await requireInternalSession();
  const stats = await getInternalDashboardStats();
  return <PaymentsView stats={stats} />;
}
