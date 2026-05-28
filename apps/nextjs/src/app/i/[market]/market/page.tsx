import type { Metadata } from "next";
import { Suspense } from "react";

import { IntentPageSkeleton } from "~/components/blink/intent-page-skeleton";
import { IntentTradePage } from "~/components/blink/intent-trade-page";
import { intentMarketPath } from "~/lib/blink/intent-path";
import { slugToMarketSymbol } from "~/lib/blink/markets";

export async function generateMetadata(props: {
  params: Promise<{ market: string }>;
}): Promise<Metadata> {
  const { market } = await props.params;
  const coin = slugToMarketSymbol(market);
  const path = intentMarketPath(coin);
  return {
    title: `Long ${coin} · Blink`,
    description: `One-tap market order on ${coin}. Trade perps on Hyperliquid with Blink.`,
    openGraph: {
      title: `Long ${coin} on Blink`,
      description: `Open a ${coin} position in one tap. Zero friction onboarding.`,
      url: `https://blink.lat/i/${path}/market`,
    },
    twitter: {
      card: "summary_large_image",
      title: `Long ${coin} on Blink`,
      description: `One-tap ${coin} perps — market buy or sell.`,
    },
  };
}

export default async function IntentMarketPage(props: {
  params: Promise<{ market: string }>;
}) {
  const { market } = await props.params;
  const coin = slugToMarketSymbol(market);

  return (
    <Suspense fallback={<IntentPageSkeleton />}>
      <IntentTradePage market={coin} mode="market" />
    </Suspense>
  );
}
