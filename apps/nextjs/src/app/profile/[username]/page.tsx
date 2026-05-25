import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";

export async function generateMetadata(props: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await props.params;
  const handle = decodeURIComponent(username);
  const resolvedAddress = await resolveProfileAddress(handle);
  const canonicalSlug = await getProfileSlugByWalletAddress(resolvedAddress);
  const profileSlug = canonicalSlug ?? handle;
  const profilePath = `/profile/${encodeURIComponent(profileSlug)}`;

  return {
    title: `${profileSlug} · Blink`,
    description: `View ${profileSlug}'s trading activity and performance on Blink — the social trading terminal for Hyperliquid.`,
    alternates: {
      canonical: profilePath,
    },
    openGraph: {
      title: `${profileSlug} on Blink`,
      description: `Check out ${profileSlug}'s trades and performance on Hyperliquid.`,
      url: `https://blink.lat${profilePath}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${profileSlug} on Blink`,
      description: `Check out ${profileSlug}'s trades and performance on Hyperliquid.`,
    },
  };
}

import { CalendarDays, Gift, Search, Verified } from "lucide-react";

import { db } from "@acme/db/client";
import {
  Follow,
  ReferralCode,
  TwitterConnection,
  UserProfile,
} from "@acme/db/schema";
import { AssetIcon } from "~/components/blink/asset-icon";
import { ConnectTwitterButton } from "~/components/blink/connect-twitter-button";
import { ProfileEquitySection } from "~/components/blink/profile-equity-section";
import { ProfileShareButton } from "~/components/blink/profile-share-button";
import { ProfileTopTraders } from "~/components/blink/profile-top-traders";
import { infoClient } from "~/lib/blink/hyperliquid";
import { formatUsd } from "~/lib/blink/markets";
import { isWalletBlinkPro } from "~/lib/blink/membership.server";
import {
  getProfileSlugByWalletAddress,
  resolveProfileAddress,
} from "~/lib/blink/resolve-address";

function humanizeProfileSlug(slug: string) {
  const trimmed = slug.trim();
  if (!trimmed) return "blink-user";
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
  }
  return trimmed.replace(/[-_]+/g, " ");
}

function normalizeProfileHandle(value?: string | null) {
  const normalized = value?.trim().replace(/^@/, "");
  return normalized ? normalized : null;
}

function createAvatarUrl(seed: string) {
  return `https://avatar.vercel.sh/${encodeURIComponent(seed)}.png?size=140`;
}

function formatCompactUsd(value: number) {
  if (Math.abs(value) >= 100_000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return formatUsd(value);
}

function formatSignedUsd(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCompactUsd(value)}`;
}

async function getProfileHeroData(address: string | null, slug: string) {
  const fallbackName = humanizeProfileSlug(slug);
  const fallbackHandle = normalizeProfileHandle(slug) ?? "blink";

  if (!address) {
    return {
      avatarSeed: slug || "blink-user",
      bio: "Trading Hyperliquid on Blink.",
      displayName: fallbackName,
      handle: fallbackHandle,
      isPro: false,
      joinedLabel: "Joined recently",
      referralCode: null,
      twitterUsername: null,
    };
  }

  try {
    const normalizedAddress = address.toLowerCase();
    const [profileRows, twitterRows, referralRows, isPro] = await Promise.all([
      db
        .select({
          bio: UserProfile.bio,
          displayName: UserProfile.displayName,
          ensName: UserProfile.ensName,
          joinedAt: UserProfile.joinedAt,
        })
        .from(UserProfile)
        .where(eq(UserProfile.walletAddress, normalizedAddress))
        .limit(1),
      db
        .select({
          twitterName: TwitterConnection.twitterName,
          twitterUsername: TwitterConnection.twitterUsername,
        })
        .from(TwitterConnection)
        .where(eq(TwitterConnection.walletAddress, normalizedAddress))
        .limit(1),
      db
        .select({ code: ReferralCode.code })
        .from(ReferralCode)
        .where(eq(ReferralCode.walletAddress, normalizedAddress))
        .limit(1),
      isWalletBlinkPro(normalizedAddress),
    ]);

    const profile = profileRows[0];
    const twitter = twitterRows[0];
    const referral = referralRows[0];

    const displayName =
      profile?.displayName?.trim() ||
      profile?.ensName?.trim() ||
      twitter?.twitterName?.trim() ||
      fallbackName;
    const handle =
      normalizeProfileHandle(twitter?.twitterUsername) ||
      normalizeProfileHandle(referral?.code) ||
      normalizeProfileHandle(profile?.displayName) ||
      normalizeProfileHandle(profile?.ensName?.split(".")[0]) ||
      fallbackHandle;
    const bio =
      profile?.bio?.trim() ||
      (twitter?.twitterUsername
        ? `Verified on X as @${twitter.twitterUsername}.`
        : "Trading Hyperliquid on Blink.");
    const joinedLabel = profile?.joinedAt
      ? `Joined ${new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "numeric",
        }).format(profile.joinedAt)}`
      : "Joined recently";

    return {
      avatarSeed: twitter?.twitterUsername || address,
      bio,
      displayName,
      handle,
      isPro,
      joinedLabel,
      referralCode: referral?.code ?? null,
      twitterUsername: twitter?.twitterUsername ?? null,
    };
  } catch {
    return {
      avatarSeed: address,
      bio: "Trading Hyperliquid on Blink.",
      displayName: fallbackName,
      handle: fallbackHandle,
      isPro: false,
      joinedLabel: "Joined recently",
      referralCode: null,
      twitterUsername: null,
    };
  }
}

async function getProfileShowcaseStats(address: string | null) {
  if (!address) return null;

  const normalizedAddress = address.toLowerCase();
  const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;

  try {
    const [state, fills, followersRows] = await Promise.all([
      infoClient.clearinghouseState({
        user: normalizedAddress as `0x${string}`,
      }),
      infoClient.userFillsByTime({
        user: normalizedAddress as `0x${string}`,
        startTime: twoYearsAgo,
      }),
      db
        .select({ value: count() })
        .from(Follow)
        .where(eq(Follow.followingAddress, normalizedAddress)),
    ]);

    const totalRealizedPnl = (fills ?? []).reduce(
      (sum, fill) => sum + Number(fill.closedPnl),
      0,
    );

    return {
      accountValue: Number(state.marginSummary.accountValue ?? 0),
      followers: followersRows[0]?.value ?? 0,
      openPositions: state.assetPositions.filter(
        (position) => Number(position.position.szi) !== 0,
      ).length,
      recentFills: fills?.length ?? 0,
      totalRealizedPnl,
    };
  } catch {
    return null;
  }
}

export default async function ProfilePage(props: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await props.params;
  const slug = decodeURIComponent(rawUsername);

  const resolvedAddress = await resolveProfileAddress(slug);
  const canonicalSlug = await getProfileSlugByWalletAddress(resolvedAddress);
  if (canonicalSlug && canonicalSlug.toLowerCase() !== slug.toLowerCase()) {
    permanentRedirect(`/profile/${encodeURIComponent(canonicalSlug)}`);
  }

  const hero = await getProfileHeroData(resolvedAddress, slug);
  const showcaseStats = await getProfileShowcaseStats(resolvedAddress);
  const profilePath = `/profile/${encodeURIComponent(canonicalSlug ?? slug)}`;
  const shareTitle = `${hero.displayName} on Blink`;

  return (
    <main className="min-h-screen bg-background px-3 pb-8 pt-3 text-[#f2f4f7]">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1780px] grid-cols-[360px_1fr_320px] gap-4">
        {/* ── Left sidebar ────────────────────────────────── */}
        <aside className="flex min-h-[calc(100vh-7rem)] flex-col gap-2 self-start">
          <Link href={"/trade"}>
            <h1 className="text-5xl font-bold tracking-[-0.04em] text-white">
              blink
            </h1>
          </Link>
        </aside>

        {/* ── Main content ────────────────────────────────── */}
        <section className="min-w-0">
          {/* Search bar */}
          <div className="mb-2 flex h-[68px] items-center justify-center">
            <div className="relative w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
              <input
                className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0c101c] pl-9 pr-3 text-base outline-none placeholder:text-white/35"
                placeholder="Search wallets..."
              />
            </div>
          </div>

          {/* Profile card */}
          <section className="mx-auto w-full max-w-[980px] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_20%_15%,rgba(43,128,255,0.06),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(23,189,174,0.06),transparent_42%)] p-0">
            {/* Cover */}
            <div className="relative h-52 border-b border-white/10 bg-[radial-gradient(circle_at_20%_15%,rgba(43,128,255,0.3),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(23,189,174,0.24),transparent_42%),linear-gradient(180deg,#0c1326,#0a1020)]" />

            {/* Avatar + name row */}
            <div className="relative z-10 -mt-14 px-3 pb-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                  <div className="relative size-28 shrink-0">
                    <img
                      src={createAvatarUrl(hero.avatarSeed)}
                      alt={`${hero.displayName} avatar`}
                      className="size-28 rounded-full border-4 border-[#08101f]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center text-5xl"
                    >
                      👀
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#8cb9ff]">
                      Public Blink profile
                    </p>
                    <div className="pb-1">
                      <p className="text-4xl font-semibold text-white">
                        {hero.displayName}
                      </p>
                      <p className="text-lg text-white/55">@{hero.handle}</p>
                    </div>
                    {hero.isPro ? (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-gradient-to-r from-amber-300/15 to-yellow-300/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
                        <Verified className="size-3" />
                        Blink Pro
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <ProfileShareButton path={profilePath} title={shareTitle} />
                  <Link
                    href="/rewards"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2c6bff] px-4 py-2 text-sm font-medium text-white hover:bg-[#2c6bff]/90"
                  >
                    <Gift className="size-4" />
                    Rewards
                  </Link>
                </div>
              </div>

              <p className="mt-2 text-lg text-white/88">{hero.bio}</p>

              {showcaseStats ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                      Account value
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {formatCompactUsd(showcaseStats.accountValue)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                      Realized PnL
                    </p>
                    <p
                      className={`mt-2 text-2xl font-semibold ${
                        showcaseStats.totalRealizedPnl >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }`}
                    >
                      {formatSignedUsd(showcaseStats.totalRealizedPnl)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                      Open positions
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {showcaseStats.openPositions}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                      Followers
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {showcaseStats.followers}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Twitter connect / verified badge */}
              <div className="mt-3">
                <ConnectTwitterButton
                  showSuccessCard={false}
                  targetWalletAddress={resolvedAddress ?? undefined}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-white/55">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  {hero.joinedLabel}
                </span>
                {hero.twitterUsername ? (
                  <span className="inline-flex items-center gap-1.5 text-[#8fdcff]">
                    <Verified className="size-4" />@{hero.twitterUsername}
                  </span>
                ) : null}
                {hero.referralCode ? (
                  <span className="text-white/55">
                    Invite code{" "}
                    <span className="font-mono text-white/82">
                      {hero.referralCode}
                    </span>
                  </span>
                ) : null}
                {showcaseStats ? (
                  <span className="text-white/45">
                    {showcaseStats.recentFills} fills tracked on Hyperliquid
                  </span>
                ) : null}
                {resolvedAddress && (
                  <span className="font-mono text-xs text-white/35">
                    {resolvedAddress.slice(0, 6)}…{resolvedAddress.slice(-4)}
                  </span>
                )}
              </div>
            </div>

            {/* Equity + balances — live from HL + Neon */}
            <div className="border-t border-white/10 px-5 pb-3 pt-5">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#8cb9ff]">
                    Live Hyperliquid account
                  </p>
                  <p className="mt-1 text-sm text-white/58">
                    Blink identity up top, canonical trading data below.
                  </p>
                </div>
                <p className="text-xs text-white/35">
                  Updates from Hyperliquid L1 account state and fills.
                </p>
              </div>
              <ProfileEquitySection targetAddress={resolvedAddress} />

              <div className="mt-7 flex items-center justify-center gap-2 text-sm text-white/35">
                <AssetIcon asset="HYPE" className="size-4" />
                <p>Powered by Hyperliquid</p>
              </div>
              <div className="mt-4 flex justify-center">
                <Link
                  href="/trade/BTC"
                  className="inline-flex items-center text-sm text-white/55 hover:text-white"
                >
                  Back to trading
                </Link>
              </div>
            </div>
          </section>
        </section>

        {/* ── Right sidebar ────────────────────────────────── */}
        <aside className="flex min-h-[calc(100vh-7rem)] flex-col gap-3 self-start">
          {/* Spacer to align with the search bar header */}
          <div className="h-[68px]" />
          <ProfileTopTraders />
        </aside>
      </div>
    </main>
  );
}
