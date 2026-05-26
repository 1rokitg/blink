import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OutcomeMarketShell } from "~/components/blink/hip4/outcome-market-shell";
import { getHip4MarketBySlug } from "~/lib/blink/hip4/markets";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const market = await getHip4MarketBySlug(slug);

  if (!market) {
    return {
      title: "HIP-4 Outcomes | Blink",
    };
  }

  return {
    title: `${market.title} | Blink Outcomes`,
    description: `${market.subtitle} Trade the YES and NO sides on Blink's dedicated HIP-4 surface.`,
  };
}

export default async function TradeOutcomeMarketPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const market = await getHip4MarketBySlug(slug);

  if (!market) {
    notFound();
  }

  return <OutcomeMarketShell market={market} />;
}
