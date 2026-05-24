import type { Metadata } from "next";
import Link from "next/link";

/**
 * /r/[code] — Referral landing page.
 *
 * Intentionally DB-free: we accept any code slug, set the cookie, show the
 * landing. Validation that the code is real happens at claim time
 * (POST /api/referrals/claim). This means the page always works even before
 * `pnpm db:push` has run or before the referrer has visited /rewards.
 */
export async function generateMetadata(props: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await props.params;
  const slug = decodeURIComponent(code).toLowerCase();
  return {
    title: `${slug} invited you to Blink`,
    description:
      "Trade perps with zero maker fees on Hyperliquid. Up to 50× leverage, instant fills, self-custody.",
    openGraph: {
      title: `${slug} invited you to Blink`,
      description:
        "The fastest social trading terminal on Hyperliquid. Zero fees, up to 50× leverage.",
      url: `https://blink.lat/r/${slug}`,
      siteName: "Blink",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${slug} invited you to Blink`,
      description: "Trade perps with zero maker fees on Hyperliquid.",
    },
  };
}

export default async function ReferralLandingPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const slug = decodeURIComponent(code).toLowerCase();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#060510] px-4 text-[#f2f4f7]">
      {/* Radial bg glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(44,107,255,0.14), transparent 65%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(59,225,186,0.07), transparent 55%)",
        }}
      />

      {/* Grid lines */}
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        {/* Wordmark */}
        <Link
          href="/"
          className="mb-10 text-4xl font-bold tracking-[-0.04em] text-white"
        >
          blink
        </Link>

        {/* Invited-by badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2c6bff]/35 bg-[#2c6bff]/12 px-4 py-1.5 text-sm font-medium text-[#6fa8ff]">
          <span className="size-1.5 rounded-full bg-[#6fa8ff]" />
          Invited by&nbsp;<span className="font-bold text-white">{slug}</span>
        </div>

        <h1 className="text-[2.8rem] font-bold leading-[1.08] tracking-[-0.04em] text-white">
          Trade perps.
          <br />
          <span className="text-[#6fa8ff]">Zero fees.</span>
        </h1>

        <p className="mt-4 text-base leading-relaxed text-white/50">
          Blink is a social trading terminal powered by Hyperliquid — the
          fastest way to go long or short on any asset.
        </p>

        {/* Feature pills */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {[
            "0% maker fee",
            "Up to 50× leverage",
            "Instant fills",
            "Self-custody",
          ].map((f) => (
            <span
              key={f}
              className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/55"
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/trade/BTC"
          className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-[16px] bg-[#2c6bff] text-base font-bold text-white shadow-[0_0_48px_rgba(44,107,255,0.40)] transition hover:bg-[#2c6bff]/90"
        >
          Start trading on Blink
        </Link>

        <p className="mt-4 text-xs text-white/30">
          Your referral is recorded when you connect your wallet.
        </p>
      </div>
    </main>
  );
}
