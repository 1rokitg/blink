"use client";

import { useMemo, useState, useTransition } from "react";

import { AreaLineChart, Sparkline } from "@/components/internal/charts";
import type { CryptoFunnelStats } from "@/lib/analytics-types";
import { CRYPTO_CHAIN_ORDER } from "@/lib/crypto-payments";
import { FALLBACK_PLANS, type PlanId } from "@/lib/plans";

function pct(value: number | null) {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

function accessEndIsoForPlan(planId: PlanId) {
  const end = new Date();
  const plan = FALLBACK_PLANS[planId];
  if (plan.interval === "year") {
    end.setUTCFullYear(end.getUTCFullYear() + plan.intervalCount);
  } else {
    end.setUTCMonth(end.getUTCMonth() + plan.intervalCount);
  }
  return end.toISOString().slice(0, 16);
}

function toDatetimeLocalValue(iso: string) {
  // datetime-local wants YYYY-MM-DDTHH:mm in local; store as UTC slice for simplicity
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso)) return iso.slice(0, 16);
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return accessEndIsoForPlan("quarter");
  }
}

type IngestForm = {
  txHash: string;
  chainId: (typeof CRYPTO_CHAIN_ORDER)[number];
  amountUsdc: string;
  planId: PlanId;
  email: string;
  name: string;
  telegramUsername: string;
  telegramUserId: string;
  discordUsername: string;
  walletAddress: string;
  walletBrand: string;
  accessEndsAt: string;
  note: string;
  skipChainVerify: boolean;
};

type IngestResult = {
  alreadyRecorded?: boolean;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceUrl?: string | null;
  inviteLink?: string | null;
  accessEndsAt?: string;
  payment?: {
    txHash?: string;
    explorerUrl?: string | null;
    amountUsdc?: number;
  };
  error?: string;
};

const EMPTY_FORM: IngestForm = {
  txHash: "",
  chainId: "base",
  amountUsdc: String(FALLBACK_PLANS.quarter.amountUsd),
  planId: "quarter",
  email: "",
  name: "",
  telegramUsername: "",
  telegramUserId: "",
  discordUsername: "",
  walletAddress: "",
  walletBrand: "",
  accessEndsAt: accessEndIsoForPlan("quarter"),
  note: "",
  skipChainVerify: false,
};

export function CryptoView({ crypto }: { crypto: CryptoFunnelStats }) {
  const views = crypto.series.map((d) => d.metrics.views);
  const connects = crypto.series.map((d) => d.metrics.connectSuccess);
  const paid = crypto.series.map((d) => d.metrics.paid);
  const walletShare = Object.entries(crypto.totals.byWallet)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const chainShare = Object.entries(crypto.totals.byChain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const [form, setForm] = useState<IngestForm>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);

  const planHint = useMemo(() => {
    const plan = FALLBACK_PLANS[form.planId];
    return `${plan.label} · catalog ${plan.amountUsd} USDC (override amount if they paid differently)`;
  }, [form.planId]);

  function updatePlan(planId: PlanId) {
    setForm((f) => ({
      ...f,
      planId,
      amountUsdc: String(FALLBACK_PLANS[planId].amountUsd),
      accessEndsAt: accessEndIsoForPlan(planId),
    }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const amountUsdc = Number(form.amountUsdc);
    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      setError("Enter a valid USDC amount.");
      return;
    }

    const accessEndsAt = form.accessEndsAt
      ? new Date(`${form.accessEndsAt}:00.000Z`).toISOString()
      : undefined;

    startTransition(() => {
      void (async () => {
        try {
          const res = await fetch("/api/internal/memberships", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              action: "crypto_grant",
              planId: form.planId,
              email: form.email.trim(),
              name: form.name.trim(),
              telegramUsername: form.telegramUsername.trim().replace(/^@/, ""),
              telegramUserId: form.telegramUserId.trim() || undefined,
              discordUsername: form.discordUsername.trim() || undefined,
              walletAddress: form.walletAddress.trim(),
              walletBrand: form.walletBrand.trim() || undefined,
              chainId: form.chainId,
              txHash: form.txHash.trim(),
              amountUsdc,
              accessEndsAt,
              note: form.note.trim() || undefined,
              skipChainVerify: form.skipChainVerify || undefined,
            }),
          });
          const data = (await res.json()) as IngestResult & { error?: string };
          if (!res.ok) {
            setError(data.error || "Could not ingest crypto receipt.");
            return;
          }
          setResult(data);
        } catch {
          setError("Network error while ingesting receipt.");
        }
      })();
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
          Crypto
        </h1>
        <p className="mt-1 text-[14px] text-[#a1a1aa]">
          Ingest USDC receipts, generate Stripe invoices (no card charge), and
          track wallet funnel conversion.
        </p>
      </div>

      <form
        id="ingest"
        onSubmit={onSubmit}
        className="scroll-mt-24 space-y-4 rounded-2xl border border-[#262626] bg-[#141414] p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#fafafa]">
              Ingest crypto receipt
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] text-[#a1a1aa]">
              Paste a Base / EVM / Solana USDC transfer. We verify on-chain (unless
              skipped), write the ledger, create a Stripe customer marked{" "}
              <span className="text-[#e4e4e7]">preferredPaymentMethod=crypto</span>
              , raise a paid-out-of-band invoice, and open access until the end
              date — without charging a card.
            </p>
          </div>
          <a
            href="/internal/payments"
            className="text-[12px] font-semibold text-[#70a7ff] hover:underline"
          >
            Open live ledger →
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="block space-y-1.5 xl:col-span-2">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Transaction hash
            </span>
            <input
              required
              value={form.txHash}
              onChange={(e) =>
                setForm((f) => ({ ...f, txHash: e.target.value }))
              }
              placeholder="0x… or Solana signature"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 font-mono text-[13px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Chain</span>
            <select
              value={form.chainId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  chainId: e.target.value as IngestForm["chainId"],
                }))
              }
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            >
              {CRYPTO_CHAIN_ORDER.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Amount (USDC)
            </span>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amountUsdc}
              onChange={(e) =>
                setForm((f) => ({ ...f, amountUsdc: e.target.value }))
              }
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Access plan
            </span>
            <select
              value={form.planId}
              onChange={(e) => updatePlan(e.target.value as PlanId)}
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            >
              <option value="month">1 Month</option>
              <option value="quarter">3 Months</option>
              <option value="year">One Year</option>
            </select>
            <span className="block text-[11px] text-[#71717a]">{planHint}</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Access ends (UTC)
            </span>
            <input
              required
              type="datetime-local"
              value={toDatetimeLocalValue(form.accessEndsAt)}
              onChange={(e) =>
                setForm((f) => ({ ...f, accessEndsAt: e.target.value }))
              }
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Customer name
            </span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="VictorV"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              placeholder="victor@example.com"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Telegram @username
            </span>
            <input
              required
              value={form.telegramUsername}
              onChange={(e) =>
                setForm((f) => ({ ...f, telegramUsername: e.target.value }))
              }
              placeholder="Victor_8892"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>

          <label className="block space-y-1.5 xl:col-span-2">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Payer wallet
            </span>
            <input
              required
              value={form.walletAddress}
              onChange={(e) =>
                setForm((f) => ({ ...f, walletAddress: e.target.value }))
              }
              placeholder="0x… or Solana address"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 font-mono text-[13px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Wallet brand (optional)
            </span>
            <input
              value={form.walletBrand}
              onChange={(e) =>
                setForm((f) => ({ ...f, walletBrand: e.target.value }))
              }
              placeholder="MetaMask, Rabby…"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Discord (optional)
            </span>
            <input
              value={form.discordUsername}
              onChange={(e) =>
                setForm((f) => ({ ...f, discordUsername: e.target.value }))
              }
              placeholder="shark88"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Telegram user id (optional)
            </span>
            <input
              value={form.telegramUserId}
              onChange={(e) =>
                setForm((f) => ({ ...f, telegramUserId: e.target.value }))
              }
              placeholder="123456789"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Note</span>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="First crypto customer · underpaid quarter…"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[#a1a1aa]">
          <input
            type="checkbox"
            checked={form.skipChainVerify}
            onChange={(e) =>
              setForm((f) => ({ ...f, skipChainVerify: e.target.checked }))
            }
            className="rounded border-[#52525b]"
          />
          Skip on-chain verify (admin already confirmed the receipt)
        </label>

        {error ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-100">
            <p className="font-semibold">
              {result.alreadyRecorded
                ? "Already recorded — showing existing Stripe objects."
                : "Receipt ingested · Stripe invoice generated (no card charge)."}
            </p>
            <dl className="grid gap-1 sm:grid-cols-2">
              <div>
                <dt className="text-emerald-200/70">Customer</dt>
                <dd className="font-mono text-[12px]">{result.customerId}</dd>
              </div>
              <div>
                <dt className="text-emerald-200/70">Invoice</dt>
                <dd className="font-mono text-[12px]">
                  {result.invoiceNumber || result.invoiceId || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-emerald-200/70">Subscription</dt>
                <dd className="font-mono text-[12px]">
                  {result.subscriptionId}
                </dd>
              </div>
              <div>
                <dt className="text-emerald-200/70">Access ends</dt>
                <dd>{result.accessEndsAt?.slice(0, 10) || "—"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-3 pt-1">
              {result.invoiceUrl || result.invoiceId ? (
                <a
                  href={
                    result.invoiceUrl ||
                    `https://dashboard.stripe.com/invoices/${result.invoiceId}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#70a7ff] hover:underline"
                >
                  Open invoice →
                </a>
              ) : null}
              {result.payment?.explorerUrl ? (
                <a
                  href={result.payment.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#70a7ff] hover:underline"
                >
                  View on explorer →
                </a>
              ) : null}
              <a
                href="/internal/payments"
                className="font-semibold text-[#70a7ff] hover:underline"
              >
                Payments ledger →
              </a>
              {result.inviteLink ? (
                <button
                  type="button"
                  className="font-semibold text-[#70a7ff] hover:underline"
                  onClick={() =>
                    void navigator.clipboard.writeText(result.inviteLink || "")
                  }
                >
                  Copy Telegram invite
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {pending ? "Ingesting…" : "Ingest receipt & generate invoice"}
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Checkout views",
            value: crypto.totals.views.toLocaleString(),
            hint: `${crypto.totals.uniqueVisitors.length} unique visitors`,
            points: views,
          },
          {
            label: "Connects",
            value: crypto.totals.connectSuccess.toLocaleString(),
            hint: `${crypto.totals.connectAttempts} attempts · ${crypto.totals.uniqueWallets.length} wallets`,
            points: connects,
          },
          {
            label: "Paid",
            value: crypto.totals.paid.toLocaleString(),
            hint: `${crypto.totals.revenueUsdc.toLocaleString()} USDC`,
            points: paid,
          },
          {
            label: "View → paid",
            value: pct(crypto.conversion.viewToPaid),
            hint: `Connect ${pct(crypto.conversion.viewToConnect)} · Sign ${pct(crypto.conversion.connectToSign)} · Pay ${pct(crypto.conversion.signToPaid)}`,
            points: paid,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#262626] bg-[#141414] p-5"
          >
            <p className="text-[13px] text-[#a1a1aa]">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-[#fafafa]">
              {card.value}
            </p>
            <p className="mt-1 text-[12px] text-[#71717a]">{card.hint}</p>
            <div className="mt-3">
              <Sparkline points={card.points} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold text-[#fafafa]">
            Connects over time
          </p>
          <div className="mt-4">
            <AreaLineChart
              primary={connects}
              heightClass="h-56"
              label="Connects"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold text-[#fafafa]">
            Paid over time
          </p>
          <div className="mt-4">
            <AreaLineChart
              primary={paid}
              primaryStroke="#16a34a"
              heightClass="h-56"
              label="Paid"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold">Wallets</p>
          <ul className="mt-4 space-y-2 text-[13px]">
            {walletShare.map(([brand, count]) => (
              <li key={brand} className="flex justify-between gap-3">
                <span className="text-[#a1a1aa]">{brand}</span>
                <span className="font-semibold text-[#fafafa]">{count}</span>
              </li>
            ))}
            {walletShare.length === 0 ? (
              <li className="text-[#71717a]">No wallet connects yet.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
          <p className="text-[15px] font-semibold">Chains</p>
          <ul className="mt-4 space-y-2 text-[13px]">
            {chainShare.map(([chain, count]) => (
              <li key={chain} className="flex justify-between gap-3">
                <span className="text-[#a1a1aa]">{chain}</span>
                <span className="font-semibold text-[#fafafa]">{count}</span>
              </li>
            ))}
            {chainShare.length === 0 ? (
              <li className="text-[#71717a]">No chain activity yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
