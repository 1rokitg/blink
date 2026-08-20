import type { Metadata } from "next";

import { INDICATORS_SITE } from "@/lib/indicators-site";

export const metadata: Metadata = {
  title: `${INDICATORS_SITE.name} · ${INDICATORS_SITE.tagline}`,
  description:
    "One-time pack: indicators .zip, setup video, and customized aggr.trade templates RokitG uses daily. Built around Aggregated OrderBook Depth.",
  robots: { index: true, follow: true },
};

export default function IndicatorsSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
