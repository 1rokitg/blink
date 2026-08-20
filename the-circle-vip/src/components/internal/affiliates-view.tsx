"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  AFFILIATE_STATUS_LABEL,
  type AffiliateRecord,
  type AffiliateStatus,
} from "@/lib/affiliates-types";
import { formatUsd } from "@/lib/internal-money";
import { SITE } from "@/lib/site";

type AffiliateRow = AffiliateRecord & { shareUrl: string };

type Totals = {
  affiliates: number;
  active: number;
  clicks: number;
  conversions: number;
  revenueAttributedUsd: number;
  earningsUsd: number;
};

function statusTone(status: AffiliateStatus) {
  if (status === "active") return "bg-emerald-500/15 text-emerald-300";
  if (status === "paused") return "bg-amber-500/15 text-amber-300";
  return "bg-white/10 text-[#a1a1aa]";
}

export function AffiliatesView({
  initialAffiliates = [],
  initialTotals,
}: {
  initialAffiliates?: AffiliateRow[];
  initialTotals?: Totals;
}) {
  const [affiliates, setAffiliates] = useState(initialAffiliates);
  const [totals, setTotals] = useState<Totals>(
    initialTotals ?? {
      affiliates: 0,
      active: 0,
      clicks: 0,
      conversions: 0,
      revenueAttributedUsd: 0,
      earningsUsd: 0,
    },
  );
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [commissionType, setCommissionType] = useState<"percent" | "flat">(
    "percent",
  );
  const [commissionValue, setCommissionValue] = useState("20");
  const [note, setNote] = useState("");

  function refresh() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/affiliates", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          affiliates?: AffiliateRow[];
          totals?: Totals;
        };
        setAffiliates(data.affiliates ?? []);
        if (data.totals) setTotals(data.totals);
      } catch {
        // keep last snapshot
      }
    });
  }

  useEffect(() => {
    if (initialAffiliates.length === 0) refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return affiliates;
    return affiliates.filter((row) =>
      [
        row.name,
        row.code,
        row.email,
        row.telegramUsername,
        row.note,
        row.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [affiliates, search]);

  async function createAffiliate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/affiliates", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            name,
            code: code || undefined,
            email: email || undefined,
            telegramUsername: telegramUsername || undefined,
            commissionType,
            commissionValue: Number(commissionValue),
            note: note || undefined,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          affiliate?: AffiliateRow;
        };
        if (!res.ok) throw new Error(data.error ?? "Create failed");
        if (data.affiliate) {
          setAffiliates((prev) => [data.affiliate!, ...prev]);
          setTotals((prev) => ({
            ...prev,
            affiliates: prev.affiliates + 1,
            active: prev.active + 1,
          }));
          setMessage(`Affiliate ${data.affiliate.code} is live.`);
        }
        setName("");
        setCode("");
        setEmail("");
        setTelegramUsername("");
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  async function setStatus(id: string, status: AffiliateStatus) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/affiliates", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set_status", id, status }),
        });
        const data = (await res.json()) as {
          error?: string;
          affiliate?: AffiliateRow;
        };
        if (!res.ok) throw new Error(data.error ?? "Update failed");
        if (data.affiliate) {
          setAffiliates((prev) =>
            prev.map((row) => (row.id === id ? data.affiliate! : row)),
          );
          refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  async function copyLink(row: AffiliateRow) {
    try {
      await navigator.clipboard.writeText(row.shareUrl);
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError("Could not copy link.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
            Affiliates
          </h1>
          <p className="mt-1 text-[14px] text-[#a1a1aa]">
            Issue share links, track clicks & conversions, and accrue referral
            rewards (default buyer discount ${SITE.referralRewardUsd} context ·
            commission set per affiliate).
            {pending ? " · refreshing…" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-full border border-[#262626] bg-[#141414] px-4 py-2 text-[13px] font-semibold text-[#e4e4e7] hover:bg-[#0f0f0f]"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-300">
          {message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Active affiliates</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {totals.active}
            <span className="ml-2 text-lg font-medium text-[#71717a]">
              / {totals.affiliates}
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Clicks</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {totals.clicks.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Conversions</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {totals.conversions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] text-[#a1a1aa]">Earnings accrued</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-emerald-300">
            {formatUsd(totals.earningsUsd)}
          </p>
          <p className="mt-1 text-[12px] text-[#71717a]">
            Attributed volume {formatUsd(totals.revenueAttributedUsd)}
          </p>
        </div>
      </section>

      <form
        id="create"
        onSubmit={createAffiliate}
        className="scroll-mt-24 space-y-4 rounded-2xl border border-[#262626] bg-[#141414] p-6"
      >
        <div>
          <p className="text-[15px] font-semibold text-[#fafafa]">
            Create affiliate
          </p>
          <p className="mt-1 text-[12px] text-[#71717a]">
            Share link format:{" "}
            <span className="font-mono text-[#d4d4d8]">/join?ref=CODE</span>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Creator / partner"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Code (optional)
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AUTO if blank"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 font-mono text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Telegram
            </span>
            <input
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="@handle"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Commission type
            </span>
            <select
              value={commissionType}
              onChange={(e) =>
                setCommissionType(e.target.value as "percent" | "flat")
              }
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            >
              <option value="percent">Percent of sale</option>
              <option value="flat">Flat USD per conversion</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              {commissionType === "percent" ? "Percent" : "Flat USD"}
            </span>
            <input
              value={commissionValue}
              onChange={(e) => setCommissionValue(e.target.value)}
              inputMode="decimal"
              required
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Payout wallet, Discord, campaign…"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Create affiliate"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, code, telegram…"
          className="min-w-[240px] flex-1 rounded-full border border-[#262626] bg-[#141414] px-4 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#0f0f0f] text-[11px] tracking-wide text-[#a1a1aa] uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Affiliate</th>
                <th className="px-4 py-3 font-semibold">Code / link</th>
                <th className="px-4 py-3 font-semibold">Commission</th>
                <th className="px-4 py-3 font-semibold">Clicks</th>
                <th className="px-4 py-3 font-semibold">Conv.</th>
                <th className="px-4 py-3 font-semibold">Earnings</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-[#1f1f1f]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#fafafa]">{row.name}</p>
                    <p className="text-[11px] text-[#71717a]">
                      {row.telegramUsername
                        ? `@${row.telegramUsername}`
                        : row.email || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-mono text-[12px] font-semibold text-[#fafafa]">
                      {row.code}
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyLink(row)}
                      className="mt-1 text-[11px] font-semibold text-[#70a7ff] hover:underline"
                    >
                      {copiedId === row.id ? "Copied" : "Copy join link"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {row.commissionType === "percent"
                      ? `${row.commissionValue}%`
                      : formatUsd(row.commissionValue)}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {row.clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {row.conversions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-emerald-300">
                      {formatUsd(row.earningsUsd)}
                    </p>
                    <p className="text-[11px] text-[#71717a]">
                      vol {formatUsd(row.revenueAttributedUsd)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${statusTone(row.status)}`}
                    >
                      {AFFILIATE_STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.status !== "active" ? (
                        <button
                          type="button"
                          onClick={() => void setStatus(row.id, "active")}
                          className="rounded-full border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10"
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void setStatus(row.id, "paused")}
                          className="rounded-full border border-[#262626] px-2.5 py-1 text-[11px] font-semibold text-[#e4e4e7] hover:bg-[#0f0f0f]"
                        >
                          Pause
                        </button>
                      )}
                      {row.status !== "archived" ? (
                        <button
                          type="button"
                          onClick={() => void setStatus(row.id, "archived")}
                          className="rounded-full border border-[#262626] px-2.5 py-1 text-[11px] font-semibold text-[#a1a1aa] hover:bg-[#0f0f0f]"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-[#71717a]"
                  >
                    No affiliates yet — create one above to start sharing links.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
