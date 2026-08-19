function publicUrl(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  // Reject empty / bare t.me stubs left by stale shell env during builds.
  if (!trimmed || trimmed === "https://t.me/" || trimmed === "https://t.me") {
    return fallback;
  }
  return trimmed;
}

/** Non-copy site config. Translatable strings live in `src/messages/{en,es}.ts`. */
export const SITE = {
  name: "The Circle",
  telegramInvite: publicUrl(
    process.env.NEXT_PUBLIC_TELEGRAM_INVITE_URL,
    "https://t.me/rokitgg",
  ),
  twitterUrl: publicUrl(process.env.NEXT_PUBLIC_TWITTER_URL, "https://x.com"),
  /**
   * YouTube id for the marketing re-entry dialog (live stream).
   * Override with `NEXT_PUBLIC_MARKETING_VIDEO_ID` if needed.
   */
  marketingVideoId:
    process.env.NEXT_PUBLIC_MARKETING_VIDEO_ID?.trim() || "yxL7sWw_Juo",
  /** Public watch URL — marketed as a live stream in the re-entry dialog. */
  marketingVideoLiveUrl:
    process.env.NEXT_PUBLIC_MARKETING_VIDEO_LIVE_URL?.trim() ||
    "https://www.youtube.com/live/yxL7sWw_Juo",
  marketingVideoIsLive: true,
  /**
   * When `/` switched to the marketing landing and checkout moved to `/join`.
   * Used as a Home impressions chart marker ("Landing refresh").
   */
  landingPlaybookAt: "2026-08-05T21:38:26.000Z",
  /**
   * SaaS-style monthly vs yearly upsell dialog on `/join`.
   * Flip to `false` to drop the experiment without deleting the code.
   */
  yearlyUpsellDialog: true,
  referralRewardUsd: 50,
  /** Free Substack subscribe page — sidekick funnel after landing email capture. */
  newsletterSubscribeUrl:
    process.env.NEXT_PUBLIC_NEWSLETTER_URL?.trim() ||
    "https://rokitg.substack.com/subscribe",
  /** Shopify Online Store (Internet Culture) — Cloudflare DNS → shops.myshopify.com */
  shopifyStoreUrl:
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL?.trim() ||
    "https://store.rokitg.com",
  /** Shopify new customer accounts host */
  shopifyAccountUrl:
    process.env.NEXT_PUBLIC_SHOPIFY_ACCOUNT_URL?.trim() ||
    "https://account.rokitg.com",
  shopifyMyshopifyDomain:
    process.env.NEXT_PUBLIC_SHOPIFY_MYSHOPIFY_DOMAIN?.trim() ||
    "tfrdn9-ku.myshopify.com",
  /**
   * Public marketing apex — Doorfee (https://doorfee.io/p/rokitg) via Cloudflare
   * CNAME flatten `@` → `doorfee.io`. App / Stripe / join live on `www`.
   */
  doorfeeLandingUrl:
    process.env.NEXT_PUBLIC_DOORFEE_LANDING_URL?.trim() ||
    "https://doorfee.io/p/rokitg",
  /** Circle app host (Worker). Prefer www once apex is Doorfee-only. */
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://www.rokitg.com",
  partners: [
    {
      id: "propr",
      title: "Propr",
      href: "https://app.propr.xyz/r/ROKIT",
      logo: "/partners/propr.png",
      // Brand: black + emerald aurora (prop trading / onchain USDC)
      gradient:
        "linear-gradient(155deg, rgba(0,200,120,0.42) 0%, rgba(0,77,64,0.55) 38%, rgba(0,0,0,0.92) 100%)",
      glow: "rgba(0,230,140,0.45)",
    },
    {
      id: "fomo",
      title: "fomo.family",
      href: "https://fomo.family/r/1rokitg",
      gradient:
        "linear-gradient(155deg, rgba(203,208,235,0.28) 0%, rgba(88,70,180,0.32) 42%, rgba(6,5,16,0.75) 100%)",
      glow: "rgba(203,208,235,0.35)",
    },
    {
      id: "basedbot",
      title: "BasedBot",
      href: "https://basedbot.app/r/rokitg",
      gradient:
        "linear-gradient(155deg, rgba(0,82,255,0.55) 0%, rgba(0,82,255,0.2) 45%, rgba(10,14,30,0.7) 100%)",
      glow: "rgba(0,82,255,0.5)",
    },
    {
      id: "kraken",
      title: "Kraken Pro",
      href: "https://proinvite.kraken.com/9f1e/wrf3l5kn",
      gradient:
        "linear-gradient(155deg, rgba(113,50,245,0.55) 0%, rgba(149,136,217,0.22) 40%, rgba(253,208,0,0.12) 72%, rgba(16,6,40,0.7) 100%)",
      glow: "rgba(113,50,245,0.5)",
    },
    {
      id: "axiom",
      title: "Axiom Pro",
      href: "https://axiom.trade/@rokitg",
      gradient:
        "linear-gradient(155deg, rgba(34,197,94,0.4) 0%, rgba(16,185,129,0.18) 42%, rgba(10,12,14,0.75) 100%)",
      glow: "rgba(34,197,94,0.4)",
    },
    {
      id: "extended",
      title: "Extended",
      href: "https://app.extended.exchange/join/ROKITG",
      gradient:
        "linear-gradient(155deg, rgba(0,188,132,0.48) 0%, rgba(6,138,99,0.22) 45%, rgba(8,8,8,0.75) 100%)",
      glow: "rgba(0,188,132,0.45)",
    },
  ],
  features: [
    {
      id: "alpha",
      span: "lg:col-span-2 lg:row-span-2",
      tone: "cyan",
    },
    {
      id: "community",
      span: "lg:col-span-1",
      tone: "violet",
    },
    {
      id: "profit-bot",
      span: "lg:col-span-1",
      tone: "orange",
    },
    {
      id: "monitors",
      span: "lg:col-span-1",
      tone: "emerald",
    },
    {
      id: "partners",
      span: "lg:col-span-1",
      tone: "magenta",
    },
    {
      id: "whitelist",
      span: "lg:col-span-2",
      tone: "gold",
    },
  ],
} as const;
