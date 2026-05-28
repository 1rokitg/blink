import { redirect } from "next/navigation";

import { intentMarketPath } from "~/lib/blink/intent-path";
import { slugToMarketSymbol } from "~/lib/blink/markets";

export default async function IntentMarketIndexPage(props: {
  params: Promise<{ market: string }>;
}) {
  const { market } = await props.params;
  const coin = slugToMarketSymbol(market);
  redirect(`/i/${intentMarketPath(coin)}/market`);
}
