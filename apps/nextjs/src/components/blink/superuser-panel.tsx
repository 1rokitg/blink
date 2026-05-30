"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Activity,
  ArrowUpRight,
  Copy,
  Fingerprint,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  type SuperuserWalletSnapshot,
  getSuperuserWalletSnapshot,
  giftBlinkMembershipAction,
  recordSuperuserBuilderApprovalAction,
  setSuperuserRoleAction,
  upsertSuperuserReferralCodeAction,
} from "~/app/actions/manage-superuser-wallet";
import { builderMaxFeeRate } from "~/lib/blink/builder";
import { describeGiftedMembership } from "~/lib/blink/gift-membership.shared";
import { getInternalUserPath } from "~/lib/blink/wallet-address";

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
  }).format(value);
}

function formatSignedMoney(value: number) {
  const formatted = formatMoney(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function truncateAddress(address: string) {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function truncateMiddle(value: string, max = 42) {
  if (!value) return "—";
  if (value.length <= max) return value;
  const edge = Math.max(8, Math.floor((max - 1) / 2));
  return `${value.slice(0, edge)}…${value.slice(-edge)}`;
}

function countryWithFlag(value: string | null | undefined) {
  if (!value) return "—";
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return value;
  const flag = String.fromCodePoint(
    ...code.split("").map((char) => 127397 + char.charCodeAt(0)),
  );
  return `${flag} ${code}`;
}

export function SuperuserPanel(props: {
  actingWalletAddress: string;
  initialWalletAddress?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(props.initialWalletAddress ?? "");
  const [loading, setLoading] = useState(Boolean(props.initialWalletAddress));
  const initialLoadKeyRef = useRef<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SuperuserWalletSnapshot | null>(
    null,
  );
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [roleDraft, setRoleDraft] = useState<"viewer" | "admin" | "superuser">(
    "viewer",
  );
  const [roleNote, setRoleNote] = useState("");
  const [referralCodeDraft, setReferralCodeDraft] = useState("");
  const [giftTier, setGiftTier] = useState<"basic" | "preferred" | "premium">(
    "basic",
  );
  const [giftDuration, setGiftDuration] = useState<30 | 90 | 365 | "lifetime">(
    365,
  );
  const [builderFeeDraft, setBuilderFeeDraft] = useState(builderMaxFeeRate());

  const giftedMembership = useMemo(
    () => describeGiftedMembership(snapshot?.membership ?? null),
    [snapshot?.membership],
  );

  useEffect(() => {
    if (!snapshot) return;

    setRoleDraft(snapshot.role.role);
    setRoleNote(snapshot.role.note ?? "");
    setReferralCodeDraft(snapshot.referralCode ?? "");
    setBuilderFeeDraft(
      snapshot.builderApproval?.maxFeeRate ?? builderMaxFeeRate(),
    );
    setGiftTier(
      snapshot.membership?.tier === "preferred" ||
        snapshot.membership?.tier === "premium"
        ? snapshot.membership.tier
        : "basic",
    );
  }, [snapshot]);

  const loadWallet = useCallback(
    async (
      searchQuery: string,
      options?: { syncUrl?: boolean; showLoading?: boolean },
    ) => {
      const nextQuery = searchQuery.trim();
      if (!nextQuery) {
        setLookupError("Enter a wallet address or referral code.");
        return;
      }

      if (options?.showLoading !== false) {
        setLoading(true);
      }
      setLookupError(null);

      try {
        const result = await getSuperuserWalletSnapshot({
          actingWalletAddress: props.actingWalletAddress,
          query: nextQuery,
        });

        if (!result) {
          setSnapshot(null);
          setLookupError("No wallet found for that search.");
          return;
        }

        setSnapshot(result);
        setQuery(result.walletAddress);

        if (options?.syncUrl !== false) {
          router.replace(getInternalUserPath(result.walletAddress), {
            scroll: false,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load wallet snapshot";
        setSnapshot(null);
        setLookupError(message);
        toast.error(message);
      } finally {
        if (options?.showLoading !== false) {
          setLoading(false);
        }
      }
    },
    [props.actingWalletAddress, router],
  );

  useEffect(() => {
    const wallet = props.initialWalletAddress?.trim();
    if (!wallet || !props.actingWalletAddress) return;

    const loadKey = `${props.actingWalletAddress}:${wallet}`;
    if (initialLoadKeyRef.current === loadKey) return;
    initialLoadKeyRef.current = loadKey;

    setQuery(wallet);
    void loadWallet(wallet, { syncUrl: false, showLoading: true });
  }, [props.actingWalletAddress, props.initialWalletAddress, loadWallet]);

  async function handleLookup() {
    await loadWallet(query, { syncUrl: true, showLoading: true });
  }

  async function refreshSnapshot() {
    const target =
      snapshot?.walletAddress ?? props.initialWalletAddress ?? query;
    if (!target.trim()) return;

    setLoading(true);
    setLookupError(null);

    try {
      await loadWallet(target, { syncUrl: true, showLoading: false });
    } finally {
      setLoading(false);
    }
  }

  const copyShareLink = useCallback(async () => {
    const wallet = snapshot?.walletAddress ?? props.initialWalletAddress;
    if (!wallet || typeof window === "undefined") return;

    const url = `${window.location.origin}${getInternalUserPath(wallet)}`;

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Internal user link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  }, [props.initialWalletAddress, snapshot?.walletAddress]);

  async function runAction(
    key: string,
    action: () => Promise<void>,
    successMessage: string,
    options?: { skipRefresh?: boolean },
  ) {
    try {
      setSaving(key);
      await action();
      if (!options?.skipRefresh) {
        await refreshSnapshot();
      }
      toast.success(successMessage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Superuser action failed";
      toast.error(message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-[#0b0d13] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#8fbaff4a] bg-[#8fbaff1a] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c4d6ff]">
            <Shield className="size-3.5" />
            Superuser tools
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Superuser control center
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-white/50">
            Search by wallet or referral code, inspect the full Blink state, and
            apply direct superuser actions for roles, referral slugs, manual
            builder approvals, and gifted Pro.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right text-xs text-white/45">
          Acting as
          <div className="mt-1 font-mono text-sm text-white/78">
            {truncateAddress(props.actingWalletAddress)}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-[#0b0d13] p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleLookup();
                }
              }}
              placeholder="Search by wallet or referral code"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleLookup()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#8fbaff55] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-4 text-sm font-medium text-white shadow-[0_16px_40px_rgba(37,90,224,0.28)] transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Inspect wallet
          </button>
          <button
            type="button"
            onClick={() => void refreshSnapshot()}
            disabled={loading || (!snapshot && !props.initialWalletAddress)}
            title="Reload wallet data"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/80 transition hover:bg-white/[0.08] disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {lookupError ? (
          <p className="mt-3 text-sm text-rose-300">{lookupError}</p>
        ) : (
          <p className="mt-3 text-xs text-white/40">
            Example searches: `0x...` wallet, `rokitg` referral code.
          </p>
        )}
      </div>

      {snapshot ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                    Resolved {snapshot.resolvedBy}
                  </p>
                  <p className="mt-2 font-mono text-lg text-white">
                    {snapshot.walletAddress}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/60">
                      Role {snapshot.role.role}
                    </span>
                    {giftedMembership.isActiveGift ? (
                      <span
                        className="rounded-full border border-amber-400/35 bg-amber-400/12 px-2.5 py-1 text-[11px] font-medium text-amber-200"
                        title={`Gift membership · expires ${formatTimestamp(snapshot.membership?.currentPeriodEnd)}`}
                      >
                        {giftedMembership.label}
                      </span>
                    ) : snapshot.membership?.status === "active" ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-300">
                        Pro active · paid
                      </span>
                    ) : null}
                    {snapshot.twitter ? (
                      <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-sky-300">
                        @{snapshot.twitter.twitterUsername}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyShareLink()}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#8fbaff4a] bg-[#8fbaff14] px-3 text-sm text-[#c4d6ff] transition hover:bg-[#8fbaff26]"
                  >
                    <Link2 className="size-3.5" />
                    Copy internal link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        snapshot.walletAddress,
                      );
                      toast.success("Wallet address copied.");
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/78 transition hover:bg-white/[0.08]"
                  >
                    <Copy className="size-3.5" />
                    Copy wallet
                  </button>
                  <Link
                    href={`/profile/${snapshot.referralCode ?? snapshot.walletAddress}`}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/78 transition hover:bg-white/[0.08]"
                  >
                    Open profile
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                  <Link
                    href="/rewards"
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/78 transition hover:bg-white/[0.08]"
                  >
                    Rewards
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Referral code
                  </p>
                  <p className="mt-2 font-mono text-lg text-white">
                    {snapshot.referralCode ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Referred users
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {snapshot.referredCount}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Followers
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {snapshot.follows.followers}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Following
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {snapshot.follows.following}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
                <h3 className="text-sm font-semibold text-white">
                  Identity + social
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Display name</span>
                    <span className="text-white/82">
                      {snapshot.userProfile?.displayName ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">ENS</span>
                    <span className="text-white/82">
                      {snapshot.userProfile?.ensName ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Joined</span>
                    <span className="text-white/82">
                      {formatTimestamp(snapshot.userProfile?.joinedAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Twitter</span>
                    <span className="text-white/82">
                      {snapshot.twitter
                        ? `@${snapshot.twitter.twitterUsername}`
                        : "—"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#121726] p-3 text-white/60">
                    {snapshot.userProfile?.bio ?? "No profile bio saved."}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
                <h3 className="text-sm font-semibold text-white">
                  Referral + lifecycle
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Referred by</span>
                    <span className="font-mono text-white/82">
                      {snapshot.referredBy
                        ? truncateAddress(snapshot.referredBy.referrerAddress)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Inbound code</span>
                    <span className="text-white/82">
                      {snapshot.referredBy?.code ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Membership</span>
                    <span className="text-right text-white/82">
                      {snapshot.membership
                        ? `${snapshot.membership.tier} · ${snapshot.membership.status}`
                        : "—"}
                      {giftedMembership.isGift ? (
                        <span className="mt-0.5 block text-xs font-medium text-amber-300/90">
                          {giftedMembership.label}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Pro until</span>
                    <span className="text-white/82">
                      {formatTimestamp(snapshot.membership?.currentPeriodEnd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Builder approval</span>
                    <span className="text-white/82">
                      {snapshot.builderApproval
                        ? `${snapshot.builderApproval.maxFeeRate} · ${snapshot.builderApproval.status}`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Builder approved</span>
                    <span className="text-white/82">
                      {snapshot.metrics.builderApproved ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">First trade</span>
                    <span className="text-white/82">
                      {snapshot.metrics.firstTrade ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/45">Pro checkout started</span>
                    <span className="text-white/82">
                      {snapshot.metrics.proCheckoutStarted ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-[#8fbaff]" />
                <h3 className="text-sm font-semibold text-white">
                  Hyperliquid account state
                </h3>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Account value
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatMoney(snapshot.onchain.accountValue)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Withdrawable
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatMoney(snapshot.onchain.withdrawable)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Margin used
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {formatMoney(snapshot.onchain.marginUsed)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Unrealized PnL
                  </p>
                  <p
                    className={`mt-2 text-lg font-semibold ${
                      snapshot.onchain.totalUnrealizedPnl > 0
                        ? "text-emerald-300"
                        : snapshot.onchain.totalUnrealizedPnl < 0
                          ? "text-rose-300"
                          : "text-white"
                    }`}
                  >
                    {formatSignedMoney(snapshot.onchain.totalUnrealizedPnl)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Realized PnL
                  </p>
                  <p
                    className={`mt-2 text-lg font-semibold ${
                      snapshot.onchain.totalRealizedPnl > 0
                        ? "text-emerald-300"
                        : snapshot.onchain.totalRealizedPnl < 0
                          ? "text-rose-300"
                          : "text-white"
                    }`}
                  >
                    {formatSignedMoney(snapshot.onchain.totalRealizedPnl)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                    Positions / orders
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {snapshot.onchain.positionCount} /{" "}
                    {snapshot.onchain.openOrderCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
                <h3 className="text-sm font-semibold text-white">
                  Open positions
                </h3>
                <div className="mt-4 space-y-2">
                  {snapshot.onchain.positions.length > 0 ? (
                    snapshot.onchain.positions.map((position) => (
                      <div
                        key={`${position.coin}-${position.entryPx}-${position.size}`}
                        className="rounded-xl border border-white/10 bg-[#121726] px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {position.coin}
                            </p>
                            <p className="mt-1 text-xs text-white/42">
                              Size {position.size} at {position.entryPx || "—"}
                            </p>
                          </div>
                          <p
                            className={`text-sm font-medium ${
                              position.unrealizedPnl > 0
                                ? "text-emerald-300"
                                : position.unrealizedPnl < 0
                                  ? "text-rose-300"
                                  : "text-white/72"
                            }`}
                          >
                            {formatSignedMoney(position.unrealizedPnl)}
                          </p>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="text-xs text-white/45">
                            Position value {formatMoney(position.positionValue)}
                          </div>
                          <div className="text-xs text-white/45">
                            Margin used {formatMoney(position.marginUsed)}
                          </div>
                          <div className="text-xs text-white/45">
                            ROE {formatCompactNumber(position.returnOnEquity)}%
                          </div>
                          <div className="text-xs text-white/45">
                            Liq px{" "}
                            {position.liquidationPx !== null
                              ? formatMoney(position.liquidationPx)
                              : "—"}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-[#121726] px-3 py-4 text-sm text-white/45">
                      No active positions.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
                <h3 className="text-sm font-semibold text-white">
                  Working orders
                </h3>
                <div className="mt-4 space-y-2">
                  {snapshot.onchain.workingOrders.length > 0 ? (
                    snapshot.onchain.workingOrders.map((order) => (
                      <div
                        key={`${order.coin}-${order.orderId ?? order.timestamp}`}
                        className="rounded-xl border border-white/10 bg-[#121726] px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {order.coin}
                            </p>
                            <p className="mt-1 text-xs text-white/42">
                              {order.side} {order.size} @ {order.limitPx}
                            </p>
                          </div>
                          {order.isReduceOnly ? (
                            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-300">
                              Reduce only
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-white/38">
                          {formatTimestamp(order.timestamp)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-[#121726] px-3 py-4 text-sm text-white/45">
                      No open orders.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
                <h3 className="text-sm font-semibold text-white">
                  Recent fills
                </h3>
                <div className="mt-4 space-y-2">
                  {snapshot.onchain.recentFills.length > 0 ? (
                    snapshot.onchain.recentFills.map((fill) => (
                      <div
                        key={`${fill.coin}-${fill.time}-${fill.px}-${fill.size}`}
                        className="rounded-xl border border-white/10 bg-[#121726] px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {fill.coin}
                            </p>
                            <p className="mt-1 text-xs text-white/42">
                              {fill.side} {fill.size} @ {fill.px}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-medium ${
                                fill.closedPnl > 0
                                  ? "text-emerald-300"
                                  : fill.closedPnl < 0
                                    ? "text-rose-300"
                                    : "text-white/72"
                              }`}
                            >
                              {formatSignedMoney(fill.closedPnl)}
                            </p>
                            <p className="mt-1 text-xs text-white/38">
                              {formatMoney(fill.notionalUsd)}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-white/38">
                          {formatTimestamp(fill.time)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-[#121726] px-3 py-4 text-sm text-white/45">
                      No fills found in the tracked window.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
                  <h3 className="text-sm font-semibold text-white">
                    Spot balances
                  </h3>
                  <div className="mt-4 space-y-2">
                    {snapshot.onchain.spotBalances.length > 0 ? (
                      snapshot.onchain.spotBalances.map((balance) => (
                        <div
                          key={`${balance.coin}-${balance.total}`}
                          className="rounded-xl border border-white/10 bg-[#121726] px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white">
                              {balance.coin}
                            </p>
                            <p className="text-sm text-white/78">
                              {formatCompactNumber(balance.total)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-white/42">
                            Available {formatCompactNumber(balance.available)} •
                            Hold {formatCompactNumber(balance.hold)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl border border-white/10 bg-[#121726] px-3 py-4 text-sm text-white/45">
                        No spot balances recorded.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
                  <h3 className="text-sm font-semibold text-white">
                    Staking + delegations
                  </h3>
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                          Delegated
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {formatCompactNumber(
                            snapshot.onchain.stakingSummary?.delegated ?? 0,
                          )}{" "}
                          HYPE
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                          Pending withdrawal
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {formatCompactNumber(
                            snapshot.onchain.stakingSummary
                              ?.totalPendingWithdrawal ?? 0,
                          )}{" "}
                          HYPE
                        </p>
                      </div>
                    </div>
                    {snapshot.onchain.stakingDelegations.length > 0 ? (
                      <div className="space-y-2">
                        {snapshot.onchain.stakingDelegations.map(
                          (delegation) => (
                            <div
                              key={`${delegation.validator}-${delegation.amount}`}
                              className="rounded-xl border border-white/10 bg-[#121726] px-3 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-mono text-xs text-white/62">
                                  {truncateAddress(delegation.validator)}
                                </p>
                                <p className="text-sm text-white/82">
                                  {formatCompactNumber(delegation.amount)} HYPE
                                </p>
                              </div>
                              <p className="mt-2 text-xs text-white/38">
                                Unlocks{" "}
                                {formatTimestamp(delegation.lockedUntil)}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-white/10 bg-[#121726] px-3 py-4 text-sm text-white/45">
                        No active validator delegations.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
              <h3 className="text-sm font-semibold text-white">
                Recent referred wallets
              </h3>
              <div className="mt-4 space-y-2">
                {snapshot.recentReferrals.length > 0 ? (
                  snapshot.recentReferrals.map((referral) => (
                    <div
                      key={`${referral.address}-${referral.joinedAt}`}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-[#121726] px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-mono text-white/82">
                          {truncateAddress(referral.address)}
                        </p>
                        <p className="mt-1 text-xs text-white/42">
                          Joined {formatTimestamp(referral.joinedAt)} via{" "}
                          {referral.code}
                        </p>
                      </div>
                      <Link
                        href={`/profile/${referral.address}`}
                        className="text-white/55 transition hover:text-white"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-white/10 bg-[#121726] px-3 py-4 text-sm text-white/45">
                    No referred wallets recorded for this account yet.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-amber-300" />
                  <h3 className="text-sm font-semibold text-white">
                    Builder approval history
                  </h3>
                </div>
                <div className="mt-4 space-y-2">
                  {snapshot.builderApprovals.length > 0 ? (
                    snapshot.builderApprovals.map((approval) => (
                      <div
                        key={`${approval.builderAddress}-${approval.approvedAt}`}
                        className="rounded-xl border border-white/10 bg-[#121726] px-3 py-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-white/84">
                            {approval.maxFeeRate}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/58">
                            {approval.status}
                          </span>
                        </div>
                        <p className="mt-2 font-mono text-xs text-white/45">
                          {truncateMiddle(approval.builderAddress)}
                        </p>
                        <p className="mt-1 text-xs text-white/38">
                          {formatTimestamp(approval.approvedAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-white/10 bg-[#121726] px-3 py-4 text-sm text-white/45">
                      No builder approvals recorded for this wallet yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
                <div className="flex items-center gap-2">
                  <Fingerprint className="size-4 text-sky-300" />
                  <h3 className="text-sm font-semibold text-white">
                    App fingerprint
                  </h3>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                      Events
                    </p>
                    <p className="mt-2 text-xl font-semibold text-white">
                      {snapshot.appFingerprint.eventCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                      Issue logs
                    </p>
                    <p className="mt-2 text-xl font-semibold text-amber-300">
                      {snapshot.appFingerprint.issueCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#121726] p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/38">
                      Last seen
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {formatTimestamp(snapshot.appFingerprint.lastSeenAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    ["Recent IPs", snapshot.appFingerprint.recentIpAddresses],
                    ["Visitor IDs", snapshot.appFingerprint.recentVisitorIds],
                    ["Session IDs", snapshot.appFingerprint.recentSessionIds],
                    [
                      "Fingerprints",
                      snapshot.appFingerprint.recentFingerprints,
                    ],
                    ["Countries", snapshot.appFingerprint.recentCountries],
                    ["Cities", snapshot.appFingerprint.recentCities],
                    ["Sources", snapshot.appFingerprint.recentSources],
                    ["Paths", snapshot.appFingerprint.recentPaths],
                  ].map(([label, values]) => (
                    <div key={String(label)}>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-white/38">
                        {label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(values as string[]).length > 0 ? (
                          (values as string[]).map((value) => (
                            <span
                              key={value}
                              className="rounded-full border border-white/10 bg-[#121726] px-2.5 py-1 text-xs text-white/68"
                            >
                              {label === "Countries"
                                ? countryWithFlag(value)
                                : truncateMiddle(value, 36)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-white/35">—</span>
                        )}
                      </div>
                    </div>
                  ))}

                  <div>
                    <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-white/38">
                      User agents
                    </p>
                    <div className="space-y-2">
                      {snapshot.appFingerprint.recentUserAgents.length > 0 ? (
                        snapshot.appFingerprint.recentUserAgents.map(
                          (value) => (
                            <div
                              key={value}
                              className="rounded-xl border border-white/10 bg-[#121726] px-3 py-2 text-xs text-white/62"
                            >
                              {value}
                            </div>
                          ),
                        )
                      ) : (
                        <span className="text-xs text-white/35">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-[#8fbaff]" />
                <h3 className="text-sm font-semibold text-white">
                  Recent app logs
                </h3>
              </div>
              <div className="mt-4 space-y-2">
                {snapshot.recentEventLogs.length > 0 ? (
                  snapshot.recentEventLogs.map((log) => (
                    <div
                      key={`${log.createdAt}-${log.requestId ?? log.eventType}`}
                      className="rounded-xl border border-white/10 bg-[#121726] px-3 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/60">
                              {log.eventType}
                            </span>
                            {log.source ? (
                              <span className="text-xs text-white/42">
                                {log.source}
                              </span>
                            ) : null}
                          </div>
                          {log.summary ? (
                            <p className="mt-2 text-sm font-medium text-white">
                              {log.summary}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/45">
                            {log.code ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                                Code {log.code}
                              </span>
                            ) : null}
                            {log.ipAddress ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono">
                                IP {log.ipAddress}
                              </span>
                            ) : null}
                            {log.country || log.city ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                                {[
                                  log.city,
                                  log.region,
                                  countryWithFlag(log.country),
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            ) : null}
                            {log.path ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                                {truncateMiddle(log.path, 44)}
                              </span>
                            ) : null}
                            {log.visitorId ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono">
                                {truncateMiddle(log.visitorId, 30)}
                              </span>
                            ) : null}
                            {log.fingerprint ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono">
                                {truncateMiddle(log.fingerprint, 30)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right text-xs text-white/38">
                          <div>{formatTimestamp(log.createdAt)}</div>
                          {log.requestId ? (
                            <div className="mt-1 font-mono">
                              {truncateMiddle(log.requestId, 22)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-white/10 bg-[#121726] px-3 py-4 text-sm text-white/45">
                    No app logs recorded for this wallet yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
              <h3 className="text-sm font-semibold text-white">Role control</h3>
              <div className="mt-4 space-y-3">
                <select
                  value={roleDraft}
                  onChange={(event) =>
                    setRoleDraft(
                      event.target.value as "viewer" | "admin" | "superuser",
                    )
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none"
                >
                  <option value="viewer">viewer</option>
                  <option value="admin">admin</option>
                  <option value="superuser">superuser</option>
                </select>
                <input
                  value={roleNote}
                  onChange={(event) => setRoleNote(event.target.value)}
                  placeholder="Reason / note"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none placeholder:text-white/35"
                />
                <button
                  type="button"
                  disabled={saving === "role"}
                  onClick={() =>
                    void runAction(
                      "role",
                      async () => {
                        await setSuperuserRoleAction({
                          actingWalletAddress: props.actingWalletAddress,
                          note: roleNote,
                          role: roleDraft,
                          targetWalletAddress: snapshot.walletAddress,
                        });
                      },
                      "Role updated.",
                    )
                  }
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-sm font-medium text-white transition hover:bg-white/[0.09] disabled:opacity-60"
                >
                  {saving === "role" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Save role"
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
              <h3 className="text-sm font-semibold text-white">
                Referral code control
              </h3>
              <div className="mt-4 space-y-3">
                <input
                  value={referralCodeDraft}
                  onChange={(event) => setReferralCodeDraft(event.target.value)}
                  placeholder="Custom referral slug"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none placeholder:text-white/35"
                />
                <button
                  type="button"
                  disabled={saving === "referral"}
                  onClick={() =>
                    void runAction(
                      "referral",
                      async () => {
                        await upsertSuperuserReferralCodeAction({
                          actingWalletAddress: props.actingWalletAddress,
                          code: referralCodeDraft,
                          targetWalletAddress: snapshot.walletAddress,
                        });
                      },
                      "Referral code updated.",
                    )
                  }
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-sm font-medium text-white transition hover:bg-white/[0.09] disabled:opacity-60"
                >
                  {saving === "referral" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Save referral code"
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
              <h3 className="text-sm font-semibold text-white">
                Gift Blink Pro
              </h3>
              {giftedMembership.isActiveGift ? (
                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm leading-relaxed text-amber-100/95">
                  <p className="font-medium">
                    Already gifted — do not double-gift by mistake
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    {giftedMembership.label}. Expires{" "}
                    {formatTimestamp(snapshot.membership?.currentPeriodEnd)}.
                    Sending another gift extends or replaces the current gift
                    period.
                  </p>
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <select
                  value={giftTier}
                  onChange={(event) =>
                    setGiftTier(
                      event.target.value as "basic" | "preferred" | "premium",
                    )
                  }
                  className="h-11 rounded-xl border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none"
                >
                  <option value="basic">Basic</option>
                  <option value="preferred">Preferred</option>
                  <option value="premium">Premium</option>
                </select>
                <select
                  value={giftDuration}
                  onChange={(event) =>
                    setGiftDuration(
                      event.target.value === "lifetime"
                        ? "lifetime"
                        : (Number(event.target.value) as 30 | 90 | 365),
                    )
                  }
                  className="h-11 rounded-xl border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>365 days</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
              <button
                type="button"
                disabled={saving === "membership" || !snapshot}
                onClick={() => {
                  if (!snapshot) return;

                  void (async () => {
                    try {
                      setSaving("membership");
                      const result = await giftBlinkMembershipAction({
                        actingWalletAddress: props.actingWalletAddress,
                        durationDays: giftDuration,
                        targetWalletAddress: snapshot.walletAddress,
                        tier: giftTier,
                      });

                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }

                      setSnapshot((current) =>
                        current
                          ? {
                              ...current,
                              membership: result.membership,
                              userProfile: {
                                bio: current.userProfile?.bio ?? null,
                                displayName:
                                  current.userProfile?.displayName ?? null,
                                ensName: current.userProfile?.ensName ?? null,
                                isPro: true,
                                joinedAt:
                                  current.userProfile?.joinedAt ??
                                  new Date().toISOString(),
                              },
                            }
                          : current,
                      );

                      toast.success(
                        giftDuration === "lifetime"
                          ? "Gifted lifetime Blink Pro."
                          : `Gifted Blink Pro for ${giftDuration} days.`,
                      );

                      try {
                        await refreshSnapshot();
                      } catch (refreshError) {
                        console.warn(
                          "[superuser] membership gifted but snapshot refresh failed",
                          refreshError,
                        );
                      }
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : "Failed to gift membership";
                      toast.error(message);
                    } finally {
                      setSaving(null);
                    }
                  })();
                }}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/15 disabled:opacity-60"
              >
                {saving === "membership" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Gift membership"
                )}
              </button>
              <p className="mt-2 text-xs text-white/40">
                Sets `blink_membership` active with payment method `gift` and
                mirrors `user_profile.isPro`.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f131c] p-4">
              <h3 className="text-sm font-semibold text-white">
                Manual builder approval
              </h3>
              <div className="mt-4 space-y-3">
                <input
                  value={builderFeeDraft}
                  onChange={(event) => setBuilderFeeDraft(event.target.value)}
                  placeholder="0.01%"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none placeholder:text-white/35"
                />
                <button
                  type="button"
                  disabled={saving === "builder"}
                  onClick={() =>
                    void runAction(
                      "builder",
                      async () => {
                        await recordSuperuserBuilderApprovalAction({
                          actingWalletAddress: props.actingWalletAddress,
                          maxFeeRate: builderFeeDraft,
                          targetWalletAddress: snapshot.walletAddress,
                        });
                      },
                      "Manual builder approval recorded.",
                    )
                  }
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-sm font-medium text-white transition hover:bg-white/[0.09] disabled:opacity-60"
                >
                  {saving === "builder" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Record approval"
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-white/40">
                This is an internal DB override for visibility and support
                flows. It does not write the approval to Hyperliquid L1.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
