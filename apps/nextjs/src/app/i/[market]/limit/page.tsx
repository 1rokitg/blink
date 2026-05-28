import type { Metadata } from "next";
import { Suspense } from "react";

import { IntentPageSkeleton } from "~/components/blink/intent-page-skeleton";
import { IntentTradePage } from "~/components/blink/intent-trade-page";
import { intentMarketPath } from "~/lib/blink/intent-path";
import { slugToMarketSymbol } from "~/lib/blink/markets";

export async function generateMetadata(props: {
  params: Promise<{ market: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const [{ market }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const coin = slugToMarketSymbol(market);
  const path = intentMarketPath(coin);
  const price =
    typeof searchParams.price === "string" ? searchParams.price : "mid";
  return {
    title: `Limit ${coin} · Blink`,
    description: `Place a limit order on ${coin} at ${price}.`,
    openGraph: {
      title: `Limit ${coin} on Blink`,
      description: `Limit order intent for ${coin}.`,
      url: `https://blink.lat/i/${path}/limit?price=${encodeURIComponent(price)}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `Limit ${coin} on Blink`,
      description: `Limit ${coin} at ${price}.`,
    },
  };
}

export default async function IntentLimitPage(props: {
  params: Promise<{ market: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ market }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const coin = slugToMarketSymbol(market);
  const priceParam =
    typeof searchParams.price === "string" ? searchParams.price : "mid";

  return (
    <Suspense fallback={<IntentPageSkeleton />}>
      <IntentTradePage market={coin} mode="limit" priceParam={priceParam} />
    </Suspense>
  );
}
