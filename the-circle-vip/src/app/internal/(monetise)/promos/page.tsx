import { PromosView } from "@/components/internal/promos-view";
import { requireInternalSession } from "@/lib/internal-session.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Promo codes · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function PromosPage() {
  await requireInternalSession();
  return <PromosView />;
}
