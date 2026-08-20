import { CheckoutLinksView } from "@/components/internal/checkout-links-view";
import { listClaimLinks, publicClaimUrl } from "@/lib/claim-links.server";
import { requireInternalSession } from "@/lib/internal-session.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Checkout links · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function CheckoutLinksPage() {
  await requireInternalSession();
  const links = await listClaimLinks(100);
  return (
    <CheckoutLinksView
      initialLinks={links.map((link) => ({
        ...link,
        url: publicClaimUrl(link.id),
        amountUsd: link.amountUsdCents / 100,
      }))}
    />
  );
}
