import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Metadata } from "next";
import Link from "next/link";

import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { ReferralCode } from "@acme/db/schema";

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

/**
 * /r/[code] — Referral landing page.
 *
 * For users who click a referral link:
 * 1. We validate the code exists in the DB
 * 2. Set a `ref` cookie (30 days) so we can claim the referral after wallet connect
 * 3. Show a landing page that pitches Blink and CTAs to connect
 *
 * The referral is only *recorded* when the referred user connects their wallet
 * and the app calls POST /api/referrals/claim.
 */
export default async function ReferralLandingPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const slug = decodeURIComponent(code).toLowerCase();

  // Validate code
  const codeRow = await db
    .select()
    .from(ReferralCode)
    .where(eq(ReferralCode.code, slug))
    .limit(1);

  if (!codeRow[0]) {
    // Unknown code → redirect to main app
    redirect("/trade/BTC");
  }

  // Set ref cookie (30 days) so the app can claim the referral after connect
  const cookieStore = await cookies();
  cookieStore.set("blink_ref", slug, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#060510] px-4 text-[#f2f4f7]">
      {/* Radial bg glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(44,107,255,0.12), transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(59,225,186,0.06), transparent 60%)",
        }}
      />

      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        {/* Wordmark */}
        <Link href="/" className="mb-10 text-4xl font-bold tracking-[-0.04em] text-white">
          blink
        </Link>

        {/* Invited by badge */}
        <div className="mb-6 flex items-center gap-2 rounded-full border border-[#2c6bff]/30 bg-[#2c6bff]/10 px-4 py-1.5 text-sm font-medium text-[#6fa8ff]">
          <span className="size-1.5 rounded-full bg-[#6fa8ff]" />
          Invited by{" "}
          <span className="font-bold text-white">{slug}</span>
        </div>

        <h1 className="text-[2.6rem] font-bold leading-[1.1] tracking-[-0.04em] text-white">
          Trade perps.<br />
          <span className="text-[#6fa8ff]">Zero fees.</span>
        </h1>

        <p className="mt-4 text-base leading-relaxed text-white/50">
          Blink is a social trading terminal powered by Hyperliquid.
          The fastest way to go long or short on any asset.
        </p>

        {/* Feature pills */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["0% maker fee", "Up to 50× leverage", "Instant fills", "On-chain, self-custody"].map((f) => (
            <span
              key={f}
              className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/60"
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/trade/BTC"
          className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-[16px] bg-[#2c6bff] text-base font-bold text-white shadow-[0_0_40px_rgba(44,107,255,0.35)] transition hover:bg-[#2c6bff]/90"
        >
          Start trading on Blink
        </Link>

        <p className="mt-4 text-xs text-white/30">
          Your referral will be recorded when you connect your wallet.
        </p>
      </div>
    </main>
  );
}
