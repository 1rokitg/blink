import { CryptoView } from "@/components/internal/crypto-view";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Crypto · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function CryptoPage() {
  await requireInternalSession();
  const stats = await getInternalDashboardStats();
  return <CryptoView crypto={stats.crypto} />;
}
