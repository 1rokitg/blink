"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { ArrowUpRight, Loader2, Search, Shield, Sparkles } from "lucide-react";
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

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function truncateAddress(address: string) {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function SuperuserPanel(props: { actingWalletAddress: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
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
  const [giftDuration, setGiftDuration] = useState<30 | 90 | 365>(30);
  const [builderFeeDraft, setBuilderFeeDraft] = useState(builderMaxFeeRate());

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

  async function handleLookup() {
    const nextQuery = query.trim();
    if (!nextQuery) {
      toast.error("Enter a wallet address or referral code.");
      return;
    }

    setLoading(true);
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
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load wallet snapshot";
      setSnapshot(null);
      setLookupError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSnapshot() {
    if (!snapshot) return;

    const result = await getSuperuserWalletSnapshot({
      actingWalletAddress: props.actingWalletAddress,
      query: snapshot.walletAddress,
    });
    setSnapshot(result);
  }

  async function runAction(
    key: string,
    action: () => Promise<void>,
    successMessage: string,
  ) {
    try {
      setSaving(key);
      await action();
      await refreshSnapshot();
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
    <section className="mt-4 rounded-2xl border border-amber-400/18 bg-[linear-gradient(180deg,rgba(24,18,9,0.92),rgba(11,11,16,0.98))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            <Shield className="size-3.5" />
            Superuser tools
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            God mode wallet inspector
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

      <div className="mt-5 rounded-2xl border border-white/10 bg-[#10131d] p-4">
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
              className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1119] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35"
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
                    {snapshot.membership?.status === "active" ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-emerald-300">
                        Pro active
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
                    <span className="text-white/82">
                      {snapshot.membership
                        ? `${snapshot.membership.tier} · ${snapshot.membership.status}`
                        : "—"}
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
                    setGiftDuration(Number(event.target.value) as 30 | 90 | 365)
                  }
                  className="h-11 rounded-xl border border-white/10 bg-[#121726] px-3 text-sm text-white outline-none"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>365 days</option>
                </select>
              </div>
              <button
                type="button"
                disabled={saving === "membership"}
                onClick={() =>
                  void runAction(
                    "membership",
                    async () => {
                      await giftBlinkMembershipAction({
                        actingWalletAddress: props.actingWalletAddress,
                        durationDays: giftDuration,
                        targetWalletAddress: snapshot.walletAddress,
                        tier: giftTier,
                      });
                    },
                    "Gifted Blink Pro membership.",
                  )
                }
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
