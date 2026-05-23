import { redirect } from "next/navigation";

export default async function LegacyMarketPage(props: {
  params: Promise<{ market: string }>;
}) {
  const params = await props.params;
  redirect(`/trade/${encodeURIComponent(params.market.toUpperCase())}`);
}
