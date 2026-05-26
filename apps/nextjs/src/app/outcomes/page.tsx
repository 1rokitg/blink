import type { Metadata } from "next";

import { OutcomesDiscovery } from "~/components/blink/hip4/outcomes-discovery";
import { fetchHip4Markets } from "~/lib/blink/hip4/markets";

export const metadata: Metadata = {
  title: "HIP-4 Outcomes | Blink",
  description:
    "Explore live Hyperliquid HIP-4 outcome markets on Blink with YES / NO prices, expiry, and implied probabilities.",
};

export default async function OutcomesPage() {
  const markets = await fetchHip4Markets();

  return <OutcomesDiscovery markets={markets} />;
}
