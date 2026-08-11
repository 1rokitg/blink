import { AffiliatesView } from "@/components/internal/affiliates-view";
import {
  affiliateShareUrl,
  affiliateTotals,
  listAffiliates,
} from "@/lib/affiliates.server";
import { requireInternalSession } from "@/lib/internal-session.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Affiliates · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function AffiliatesPage() {
  await requireInternalSession();
  const affiliates = await listAffiliates(200);
  return (
    <AffiliatesView
      initialAffiliates={affiliates.map((row) => ({
        ...row,
        shareUrl: affiliateShareUrl(row.code),
      }))}
      initialTotals={affiliateTotals(affiliates)}
    />
  );
}
