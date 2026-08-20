"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { AreaLineChart, BreakdownBar } from "@/components/internal/charts";
import type { InternalDashboardStats } from "@/lib/internal-stats-types";
import { formatUsd } from "@/lib/internal-money";
import { shortenAddress } from "@/lib/crypto-payments";
import {
  formatDueRelative,
  memberDueAt,
} from "@/lib/members-due";
import {
  resolvePersonForCryptoPayment,
  resolvePersonForStripePayment,
  type PersonRef,
} from "@/lib/payment-people";
import type { PersonEnrichment } from "@/lib/people-types";

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  trialing: "#38bdf8",
  past_due: "#7dd3fc",
  canceled: "#1d4ed8",
  unpaid: "#ef4444",
  incomplete: "#94a3b8",
  incomplete_expired: "#64748b",
  paused: "#f97316",
};

type CryptoPaymentRow = {
  txHash: string;
  chainId: string;
  chainLabel: string;
  explorerUrl: string | null;
  planId: string;
  planLabel: string;
  amountUsdc: number;
  walletAddress: string | null;
  walletBrand: string | null;
  telegramUsername: string;
  telegramUserId?: string;
  createdAt: string;
  email?: string | null;
  name?: string | null;
  preferredPaymentMethod?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeInvoiceId?: string | null;
  accessEndsAt?: string | null;
};

type CryptoPaymentsResponse = {
  generatedAt: string;
  totals: { paid: number; revenueUsdc: number };
  payments: CryptoPaymentRow[];
};

type StripePaymentRow = {
  invoiceId: string;
  customerId: string | null;
  email: string | null;
  amountUsd: number;
  currency: string;
  status: string;
  description: string | null;
  paidAt: string;
  country: string | null;
  whopPaymentId: string | null;
  method: string | null;
  tag: string;
  source: string;
};

type StripePaymentsResponse = {
  generatedAt: string;
  rail: string;
  label?: string;
  totals: { paid: number; revenueUsd: number; members: number };
  payments: StripePaymentRow[];
};

function relativeTime(iso: string) {
  const delta = Date.now() - Date.parse(iso);
  if (!Number.isFinite(delta)) return "—";
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PaymentsView({ stats }: { stats: InternalDashboardStats }) {
  const [tab, setTab] = useState<"card" | "crypto">("card");
  const [crypto, setCrypto] = useState<CryptoPaymentsResponse>(() => ({
    generatedAt: stats.generatedAt,
    totals: {
      paid: stats.crypto.payments.length || stats.crypto.totals.paid,
      revenueUsdc:
        stats.crypto.payments.reduce((sum, row) => sum + row.amountUsdc, 0) ||
        stats.crypto.totals.revenueUsdc,
    },
    payments: stats.crypto.payments.map((payment) => ({
      txHash: payment.txHash,
      chainId: payment.chainId,
      chainLabel: payment.chainId,
      explorerUrl: null,
      planId: payment.planId,
      planLabel: payment.planId,
      amountUsdc: payment.amountUsdc,
      walletAddress: payment.walletAddress,
      walletBrand: payment.walletBrand,
      telegramUsername: payment.telegramUsername,
      createdAt: payment.createdAt,
    })),
  }));
  const [stripePayments, setStripePayments] =
    useState<StripePaymentsResponse | null>(null);
  const [enrichments, setEnrichments] = useState<PersonEnrichment[]>([]);
  const [pending, startTransition] = useTransition();
  const [stripePending, startStripeTransition] = useTransition();
  const [live, setLive] = useState(true);

  function refreshCrypto() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/payments", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        setCrypto((await res.json()) as CryptoPaymentsResponse);
      } catch {
        // keep last good snapshot
      }
    });
  }

  function refreshStripePayments() {
    startStripeTransition(async () => {
      try {
        const res = await fetch("/api/internal/payments?rail=stripe-payments", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        setStripePayments((await res.json()) as StripePaymentsResponse);
      } catch {
        // keep last good snapshot
      }
    });
  }

  useEffect(() => {
    refreshCrypto();
    refreshStripePayments();
    void (async () => {
      try {
        const res = await fetch("/api/internal/people?limit=200", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { enrichments?: PersonEnrichment[] };
        setEnrichments(data.enrichments ?? []);
      } catch {
        // person links still resolve via members/visitors
      }
    })();
  }, []);

  const stripePersonByInvoice = useMemo(() => {
    const map = new Map<string, PersonRef>();
    for (const payment of stripePayments?.payments ?? []) {
      const person = resolvePersonForStripePayment(
        payment,
        stats.members,
        enrichments,
      );
      if (person) map.set(payment.invoiceId, person);
    }
    return map;
  }, [stripePayments, stats.members, enrichments]);

  const cryptoPersonByTx = useMemo(() => {
    const map = new Map<string, PersonRef>();
    for (const payment of crypto.payments) {
      const person = resolvePersonForCryptoPayment(
        payment,
        stats.members,
        stats.people,
        enrichments,
      );
      if (person) map.set(payment.txHash, person);
    }
    return map;
  }, [crypto.payments, stats.members, stats.people, enrichments]);

  useEffect(() => {
    if (!live || tab !== "crypto") return;
    const id = window.setInterval(() => refreshCrypto(), 10_000);
    return () => window.clearInterval(id);
  }, [live, tab]);

  const total =
    stats.paymentsBreakdown.reduce((sum, row) => sum + row.amount, 0) || 1;
  const stripeGross =
    stripePayments?.totals.revenueUsd ?? stats.stripeAllTimeRevenue;
  const stripePaidCount =
    stripePayments?.totals.paid ?? stripePayments?.payments.length ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
            Payments
          </h1>
          <p className="mt-1 text-[14px] text-[#a1a1aa]">
            Stripe Payments and verified USDC in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["card", "crypto"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-full border px-3 py-2 text-[13px] font-medium ${
                tab === value
                  ? "border-white bg-white text-black"
                  : "border-[#262626] bg-[#141414] text-[#a1a1aa]"
              }`}
            >
              {value === "crypto" ? "Crypto USDC" : "Stripe Payments"}
            </button>
          ))}
        </div>
      </div>

      {tab === "crypto" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid w-full gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
                <p className="text-[13px] text-[#a1a1aa]">Verified payments</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">
                  {crypto.totals.paid.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
                <p className="text-[13px] text-[#a1a1aa]">USDC volume</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">
                  {crypto.totals.revenueUsdc.toLocaleString()} USDC
                </p>
              </div>
              <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
                <p className="text-[13px] text-[#a1a1aa]">Live feed</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-[#fafafa]">
                  {live ? "Polling every 10s" : "Paused"}
                  {pending ? " · updating…" : ""}
                </p>
                <p className="mt-1 text-[12px] text-[#71717a]">
                  Updated {new Date(crypto.generatedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => refreshCrypto()}
              className="rounded-full border border-[#262626] bg-[#141414] px-3 py-2 text-[13px] font-semibold text-[#e4e4e7] hover:bg-[#0f0f0f]"
            >
              Refresh now
            </button>
            <button
              type="button"
              onClick={() => setLive((value) => !value)}
              className="rounded-full border border-[#262626] bg-[#141414] px-3 py-2 text-[13px] font-semibold text-[#e4e4e7] hover:bg-[#0f0f0f]"
            >
              {live ? "Pause live" : "Resume live"}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414] ">
            <div className="border-b border-[#262626] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Crypto payments</h2>
              <p className="mt-1 text-[12px] text-[#71717a]">
                On-chain verifies and Crypto-tab receipt ingests land here with
                their Stripe invoices (paid out of band — no card charge).
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-[#0f0f0f] text-[11px] tracking-wide text-[#a1a1aa] uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Person</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 font-semibold">Access</th>
                    <th className="px-4 py-3 font-semibold">Chain</th>
                    <th className="px-4 py-3 font-semibold">Wallet</th>
                    <th className="px-4 py-3 font-semibold">Telegram</th>
                    <th className="px-4 py-3 font-semibold">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {crypto.payments.map((payment) => {
                    const person = cryptoPersonByTx.get(payment.txHash);
                    const personLabel =
                      person?.label ||
                      payment.name ||
                      (payment.telegramUsername
                        ? `@${payment.telegramUsername.replace(/^@/, "")}`
                        : null);
                    return (
                    <tr
                      key={payment.txHash}
                      className="border-t border-[#1f1f1f]"
                    >
                      <td className="px-4 py-3 text-[#a1a1aa]">
                        <p className="font-medium text-[#fafafa]">
                          {relativeTime(payment.createdAt)}
                        </p>
                        <p className="text-[11px]">
                          {new Date(payment.createdAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {person ? (
                          <Link
                            href={person.href}
                            className="font-medium text-[#70a7ff] hover:underline"
                          >
                            {person.label}
                            <span className="mt-0.5 block text-[10px] font-semibold tracking-wide text-[#52525b] uppercase">
                              {person.kind}
                            </span>
                          </Link>
                        ) : personLabel ? (
                          <span className="font-medium text-[#fafafa]">
                            {personLabel}
                            {payment.email ? (
                              <span className="mt-0.5 block text-[11px] font-normal text-[#71717a]">
                                {payment.email}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-[#52525b]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {payment.amountUsdc} USDC
                      </td>
                      <td className="px-4 py-3">{payment.planLabel}</td>
                      <td className="px-4 py-3">
                        {payment.stripeInvoiceId ? (
                          <a
                            href={`https://dashboard.stripe.com/invoices/${payment.stripeInvoiceId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] font-semibold text-[#70a7ff] hover:underline"
                          >
                            {payment.stripeInvoiceId.slice(0, 14)}…
                          </a>
                        ) : (
                          <span className="text-[#52525b]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#a1a1aa]">
                        {payment.accessEndsAt
                          ? new Date(payment.accessEndsAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {payment.chainLabel}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">
                          {payment.walletBrand || "Wallet"}
                        </p>
                        <p className="font-mono text-[11px] text-[#71717a]">
                          {payment.walletAddress
                            ? shortenAddress(payment.walletAddress)
                            : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {payment.telegramUsername
                          ? `@${payment.telegramUsername.replace(/^@/, "")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {payment.explorerUrl ? (
                          <a
                            href={payment.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] font-semibold text-[#70a7ff] underline"
                          >
                            {payment.txHash.slice(0, 10)}…
                          </a>
                        ) : (
                          <span className="font-mono text-[11px] text-[#71717a]">
                            {payment.txHash.slice(0, 10)}…
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                  {crypto.payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center text-[#71717a]"
                      >
                        No verified crypto payments yet. Ingest a receipt from
                        Crypto → Ingest crypto receipt, or wait for checkout
                        verifies.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
              <p className="text-[13px] text-[#a1a1aa]">All-time revenue</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">
                {formatUsd(stripeGross)}
              </p>
              <p className="mt-1 text-[12px] text-[#71717a]">
                via Stripe Payments
                {stripePending ? " · refreshing…" : ""}
              </p>
            </div>
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
              <p className="text-[13px] text-[#a1a1aa]">Paid invoices</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">
                {stripePaidCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
              <p className="text-[13px] text-[#a1a1aa]">MRR</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">
                {formatUsd(stats.mrr)}
              </p>
              <p className="mt-1 text-[12px] text-[#71717a]">
                via Stripe Payments run-rate
              </p>
            </div>
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
              <p className="text-[13px] text-[#a1a1aa]">Active members</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">
                {stats.activeSubscribers.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => refreshStripePayments()}
              className="rounded-full border border-[#262626] bg-[#141414] px-3 py-2 text-[13px] font-semibold text-[#e4e4e7] hover:bg-[#0f0f0f]"
            >
              Refresh Stripe
            </button>
            {!stats.stripeConfigured ? (
              <span className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-300">
                Stripe is not configured
              </span>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414]">
            <div className="border-b border-[#262626] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Stripe Payments</h2>
              <p className="mt-1 text-[12px] text-[#71717a]">
                Paid invoices on Stripe — source of truth for card and migrated
                history.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-[#0f0f0f] text-[11px] tracking-wide text-[#a1a1aa] uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Person</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Tag</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {(stripePayments?.payments ?? []).map((payment) => {
                    const person = stripePersonByInvoice.get(payment.invoiceId);
                    return (
                    <tr
                      key={payment.invoiceId}
                      className="border-t border-[#1f1f1f]"
                    >
                      <td className="px-4 py-3 text-[#a1a1aa]">
                        <p className="font-medium text-[#fafafa]">
                          {relativeTime(payment.paidAt)}
                        </p>
                        <p className="text-[11px]">
                          {new Date(payment.paidAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {person ? (
                          <Link
                            href={person.href}
                            className="font-medium text-[#70a7ff] hover:underline"
                          >
                            {person.label}
                          </Link>
                        ) : (
                          <span className="text-[#52525b]">Unlinked</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#fafafa]">
                          {payment.email || payment.customerId || "—"}
                        </p>
                        {payment.country ? (
                          <p className="text-[11px] text-[#71717a]">
                            {payment.country}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatUsd(payment.amountUsd)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-[#d4d4d8]">
                          {payment.tag || "Stripe"}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-[#a1a1aa]">
                        {payment.description || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[#71717a]">
                        {payment.invoiceId}
                      </td>
                    </tr>
                    );
                  })}
                  {(stripePayments?.payments.length ?? 0) === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-[#71717a]"
                      >
                        {stripePending
                          ? "Loading Stripe Payments…"
                          : "No Stripe Payments yet."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
              <p className="text-[15px] font-semibold">Revenue trend</p>
              <p className="mt-1 text-[12px] text-[#71717a]">
                Card charge series for the current Internal Tools range
              </p>
              <div className="mt-4">
                <AreaLineChart
                  primary={stats.revenueSeries.map((d) => d.amount)}
                  heightClass="h-64"
                  label="Revenue"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-[#262626] bg-[#141414] p-6">
              <p className="text-[15px] font-semibold">Status breakdown</p>
              <div className="mt-5">
                <BreakdownBar
                  showLegend={false}
                  rows={stats.paymentsBreakdown.map((row) => ({
                    key: row.status.replaceAll("_", " "),
                    value: row.amount,
                  }))}
                  colors={Object.fromEntries(
                    stats.paymentsBreakdown.map((row) => [
                      row.status.replaceAll("_", " "),
                      STATUS_COLORS[row.status] ?? "#94a3b8",
                    ]),
                  )}
                />
              </div>
              <ul
                className="mt-5 space-y-3 text-[13px]"
                aria-label="Status breakdown legend"
              >
                {stats.paymentsBreakdown.map((row) => (
                  <li
                    key={row.status}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 capitalize text-[#a1a1aa]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: STATUS_COLORS[row.status] ?? "#94a3b8",
                        }}
                        aria-hidden
                      />
                      {row.status.replaceAll("_", " ")}
                    </span>
                    <span className="font-semibold text-[#fafafa]">
                      {formatUsd(row.amount)}/mo ·{" "}
                      {((row.amount / total) * 100).toFixed(1)}% · {row.count}
                    </span>
                  </li>
                ))}
                {stats.paymentsBreakdown.length === 0 ? (
                  <li className="text-[#71717a]">No membership data yet.</li>
                ) : null}
              </ul>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414] ">
            <div className="border-b border-[#262626] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Members</h2>
              <p className="mt-1 text-[12px] text-[#71717a]">
                Active Stripe memberships and migrated paying customers
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="bg-[#0f0f0f] text-[11px] tracking-wide text-[#a1a1aa] uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Member</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Due</th>
                    <th className="px-4 py-3 font-semibold">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.members.slice(0, 50).map((member) => {
                    const due = memberDueAt(member);
                    const label = member.telegramUsername
                      ? `@${member.telegramUsername.replace(/^@/, "")}`
                      : member.email || member.name || member.id;
                    return (
                      <tr key={member.id} className="border-t border-[#1f1f1f]">
                        <td className="px-4 py-3">
                          <Link
                            href={`/internal/people?kind=member&id=${encodeURIComponent(member.id)}&tab=members`}
                            className="font-medium text-[#70a7ff] hover:underline"
                          >
                            {label}
                          </Link>
                          <p className="text-[11px] text-[#71717a]">
                            {member.email || member.telegramUserId || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {member.planLabel || member.planId || "—"}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {member.status.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#a1a1aa]">
                          {due ? (
                            <>
                              <p>{new Date(due).toLocaleDateString()}</p>
                              <p className="text-[11px] text-[#71717a]">
                                {formatDueRelative(due)}
                                {member.dueKind === "whop_estimate"
                                  ? " · est."
                                  : ""}
                              </p>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {formatUsd(member.mrr)}
                        </td>
                      </tr>
                    );
                  })}
                  {stats.members.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-[#71717a]"
                      >
                        No members yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
