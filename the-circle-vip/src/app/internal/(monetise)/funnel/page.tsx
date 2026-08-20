import { FunnelView } from "@/components/internal/funnel-view";
import { getFunnelBoard } from "@/lib/funnel-stats.server";
import { requireInternalSession } from "@/lib/internal-session.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Funnel · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function FunnelPage() {
  await requireInternalSession();
  const board = await getFunnelBoard(30);
  return <FunnelView initialBoard={board} />;
}
