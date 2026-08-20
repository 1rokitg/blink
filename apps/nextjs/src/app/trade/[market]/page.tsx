import type { Metadata } from "next";

import { TerminalShell } from "~/components/blink/terminal-shell";
import { marketToSlug, slugToMarketSymbol } from "~/lib/blink/markets";
import {
  SOCIAL_CARD_IMAGE,
  SOCIAL_CARD_IMAGE_URL,
} from "~/lib/blink/metadata-images";

export async function generateMetadata(props: {
  params: Promise<{ market: string }>;
}): Promise<Metadata> {
  const { market } = await props.params;
  const coin = slugToMarketSymbol(market);
  return {
    title: `Trade ${coin} · Blink`,
    description: `Trade ${coin} perpetuals on Hyperliquid with zero maker fees, up to 50× leverage, and instant fills. Powered by Blink.`,
    openGraph: {
      title: `Trade ${coin} · Blink`,
      description: `Trade ${coin} perpetuals on Hyperliquid. Zero extra fees, 50× leverage, self-custody.`,
      url: `https://blink.lat/trade/${marketToSlug(coin)}`,
      images: [SOCIAL_CARD_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: `Trade ${coin} · Blink`,
      description: `Trade ${coin} perpetuals on Hyperliquid. Zero extra fees, 50× leverage, self-custody.`,
      images: [SOCIAL_CARD_IMAGE_URL],
    },
  };
}

export default async function TradeMarketPage(props: {
  params: Promise<{ market: string }>;
}) {
  const params = await props.params;

  return <TerminalShell market={slugToMarketSymbol(params.market)} />;
}
