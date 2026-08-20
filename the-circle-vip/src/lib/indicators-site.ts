/**
 * indicators.rokitg.com — standalone storefront for RokitG Indicators.
 * Separate from The Circle VIP membership (rokitg.com).
 *
 * Product thesis:
 * https://rokitg.substack.com/p/my-favorite-indicators-and-how-i
 *
 * Deliverable: one-time .zip — indicators + setup video + customized
 * aggr.trade templates (RokitG daily layouts). Public community reference for
 * the template format: https://github.com/cryptorife/aggr-templates
 */

export const INDICATORS_SITE = {
  host: "indicators.rokitg.com",
  name: "RokitG Indicators",
  brand: "Indicators",
  primaryName: "Aggregated OrderBook Depth",
  tagline: "Not the ones everyone uses.",
  heroSupport:
    "A one-time pack: the indicators .zip, a setup video, and the aggr.trade templates I use and trust every day — customized for how I actually trade.",
  articleUrl: "https://rokitg.substack.com/p/my-favorite-indicators-and-how-i",
  articleTitle: "My Favorite Indicators & How I Use Them",
  launchUrl: "https://kiyotaka.ai/ref=zAbD4p_jE_",
  aggrTradeUrl: "https://aggr.trade",
  /** Community reference for aggr.trade template format (not the product sold). */
  aggrTemplatesReferenceUrl: "https://github.com/cryptorife/aggr-templates",
  circleUrl: "https://rokitg.com",
  amountUsd: 20,
  billing: "one_time" as const,
  envPriceId: "STRIPE_PRICE_INDICATORS_PACK",
  /** One-time EUR price for the zip pack. */
  fallbackPriceId: "price_1U1qcZEhIQQHCvRuryhFQU7L",
  deliverables: [
    {
      title: "Indicators .zip",
      body: "The private indicator files — including Aggregated OrderBook Depth — ready to import into your workflow.",
    },
    {
      title: "Setup video tutorial",
      body: "Step-by-step walkthrough so you’re not guessing settings, thresholds, or layout on day one.",
    },
    {
      title: "aggr.trade templates",
      body: "Customized aggr.trade templates I use and trust daily — Full / Tape style layouts tuned for live crypto tape.",
    },
  ],
  stack: [
    {
      step: "01",
      title: "Order book depth",
      body: "Primary filter — bids building in the direction you want to trade. Passive support, not just market-buy noise.",
    },
    {
      step: "02",
      title: "Funding rate",
      body: "Should be reasonable — not extremely skewed one way. Table stakes for leverage sentiment.",
    },
    {
      step: "03",
      title: "Open interest",
      body: "Rising in the same direction as price. Confirms the move has fuel, not just a vacuum squeeze.",
    },
    {
      step: "04",
      title: "Liquidation spikes",
      body: "No massive liquidations fighting the move. Pain points matter — don’t size into a trap.",
    },
  ],
} as const;

export function isIndicatorsHost(host: string) {
  const h = host.toLowerCase().split(":")[0] ?? "";
  return (
    h === INDICATORS_SITE.host ||
    h === "indicators.localhost" ||
    h.startsWith("indicators.")
  );
}
