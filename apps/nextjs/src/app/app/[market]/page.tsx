import { redirect } from "next/navigation";

import { marketToSlug, slugToMarketSymbol } from "~/lib/blink/markets";

export default async function LegacyMarketPage(props: {
  params: Promise<{ market: string }>;
}) {
  const params = await props.params;
  redirect(`/trade/${marketToSlug(slugToMarketSymbol(params.market))}`);
}
