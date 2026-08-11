"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";

import {
  CountUpInt,
  SkeletonBlock,
} from "@/components/internal/count-up-stat";
import {
  formatFunnelPct,
  type FunnelBoard,
  type FunnelEmailRow,
} from "@/lib/funnel-stats";
import { formatChannelLabel } from "@/lib/attribution";
import {
  LEAD_STATUS_LABEL,
  type LeadStatus,
} from "@/lib/leads-types";
import type { DashboardRange } from "@/lib/internal-stats-types";

const RANGES: { days: DashboardRange; label: string }[] = [
  { days: 1, label: "Today" },
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 0, label: "All" },
];

const STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "member",
  "lost",
];

type EmailFilter = "in_range" | "open" | "paid" | "all";

function statusTone(status: LeadStatus) {
  switch (status) {
    case "new":
      return "bg-sky-500/10 text-sky-300";
    case "contacted":
      return "bg-amber-500/10 text-amber-300";
    case "qualified":
      return "bg-violet-500/10 text-violet-300";
    case "member":
      return "bg-emerald-500/10 text-emerald-300";
    case "lost":
      return "bg-zinc-500/10 text-zinc-400";
  }
}

function MetricCard({
  label,
  hint,
  pending,
  children,
  accent,
}: {
  label: string;
  hint?: string;
  pending?: boolean;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <div
      className={`rounded-2xl border bg-[#141414] p-5 ${
        accent ?? "border-[#262626]"
      }`}
    >
      <p className="text-[12px] font-medium tracking-wide text-[#a1a1aa] uppercase">
        {label}
      </p>
      {pending ? (
        <SkeletonBlock className="mt-3 h-9 w-28" />
      ) : (
        <div className="mt-3 text-[32px] font-semibold tracking-tight text-[#fafafa] tabular-nums">
          {children}
        </div>
      )}
      {hint ? <p className="mt-2 text-[12px] text-[#71717a]">{hint}</p> : null}
    </div>
  );
}

function StageBar({
  visitors,
  emails,
  paid,
}: {
  visitors: number;
  emails: number;
  paid: number;
}) {
  const max = Math.max(visitors, emails, paid, 1);
  const stages = [
    { label: "Visitors", value: visitors, color: "bg-cyan-400" },
    { label: "Emails", value: emails, color: "bg-[#ff6a00]" },
    { label: "Paid", value: paid, color: "bg-emerald-400" },
  ];
  return (
    <div className="space-y-3 rounded-2xl border border-[#262626] bg-[#141414] p-5">
      <p className="text-[13px] font-semibold text-[#fafafa]">Stage volume</p>
      {stages.map((stage) => (
        <div key={stage.label}>
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="text-[#a1a1aa]">{stage.label}</span>
            <span className="font-semibold tabular-nums text-[#fafafa]">
              {stage.value.toLocaleString()}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#0f0f0f]">
            <div
              className={`h-full rounded-full ${stage.color}`}
              style={{ width: `${Math.max(4, (stage.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FunnelView({ initialBoard }: { initialBoard: FunnelBoard }) {
  const [board, setBoard] = useState(initialBoard);
  const [range, setRange] = useState<DashboardRange>(initialBoard.rangeDays);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EmailFilter>("in_range");
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rangeLabel =
    RANGES.find((item) => item.days === range)?.label ?? `${range}d`;

  function refresh(days: DashboardRange) {
    setRange(days);
    startTransition(async () => {
      const res = await fetch(`/api/internal/funnel?days=${days}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { board: FunnelBoard };
      setBoard(data.board);
    });
  }

  function setStatus(id: string, status: LeadStatus) {
    startTransition(async () => {
      const res = await fetch("/api/internal/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", id, status }),
      });
      if (!res.ok) {
        setMessage("Could not update status.");
        return;
      }
      const data = (await res.json()) as {
        lead: { id: string; status: LeadStatus; updatedAt: string };
      };
      setBoard((prev) => ({
        ...prev,
        emails: prev.emails.map((row) =>
          row.id === data.lead.id
            ? {
                ...row,
                status: data.lead.status,
                updatedAt: data.lead.updatedAt,
              }
            : row,
        ),
      }));
      // Recompute open/paid counts for in-range rows after status change.
      refresh(range);
    });
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(email);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setMessage(email);
    }
  }

  const filteredEmails = useMemo(() => {
    const q = search.trim().toLowerCase();
    return board.emails.filter((row) => {
      if (filter === "in_range" && !row.inRange) return false;
      if (filter === "open") {
        if (row.status === "member" || row.status === "lost" || row.paidMemberId) {
          return false;
        }
      } else if (filter === "paid") {
        if (row.status !== "member" && !row.paidMemberId) return false;
      }
      if (!q) return true;
      return [
        row.email,
        row.source,
        row.channel,
        row.utmCampaign,
        row.note,
        row.status,
        row.paidMemberLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [board.emails, filter, search]);

  const filterCounts = useMemo(() => {
    let open = 0;
    let paid = 0;
    let inRange = 0;
    for (const row of board.emails) {
      if (row.inRange) inRange += 1;
      if (row.status === "member" || row.paidMemberId) paid += 1;
      else if (row.status !== "lost") open += 1;
    }
    return { open, paid, inRange, all: board.emails.length };
  }, [board.emails]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-[0.18em] text-[#ff6a00] uppercase">
            Marketing
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#fafafa]">
            Funnel
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#a1a1aa]">
            Landing email captures, visitor → email → paid conversion, and CRM
            status for every address collected on rokitg.com.
          </p>
          <p className="mt-2 text-[12px] text-[#71717a]">
            Updated {new Date(board.generatedAt).toLocaleString()}
            {pending ? " · refreshing…" : ""} · Traffic SoT:{" "}
            {board.trafficSource === "cloudflare" ? "Cloudflare" : "First-party"}
            {" · "}
            {board.emailsCapturedAllTime.toLocaleString()} emails all-time
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((item) => (
            <button
              key={item.days}
              type="button"
              onClick={() => refresh(item.days)}
              disabled={pending}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
                range === item.days
                  ? "border-white bg-white text-black"
                  : "border-[#262626] bg-[#141414] text-[#a1a1aa] hover:bg-[#1c1c1c]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-300">
          {message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Visitors"
          hint={`${rangeLabel} uniques`}
          pending={pending}
          accent="border-cyan-500/25"
        >
          <CountUpInt value={board.visitors} />
        </MetricCard>
        <MetricCard
          label="Emails captured"
          hint={`${board.emailsOpen} open · ${board.emailsPaid} paid in range`}
          pending={pending}
          accent="border-orange-500/25"
        >
          <CountUpInt value={board.emailsCaptured} />
        </MetricCard>
        <MetricCard
          label="Visitor → email"
          hint="Capture rate"
          pending={pending}
        >
          {formatFunnelPct(board.visitorToEmailPct)}
        </MetricCard>
        <MetricCard
          label="Email → paid"
          hint={`Visitor → paid ${formatFunnelPct(board.visitorToPaidPct)}`}
          pending={pending}
          accent="border-emerald-500/25"
        >
          {formatFunnelPct(board.emailToPaidPct)}
        </MetricCard>
      </div>

      <StageBar
        visitors={board.visitors}
        emails={board.emailsCaptured}
        paid={board.emailsPaid}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] font-semibold text-[#fafafa]">
            Sales channels ({rangeLabel})
          </p>
          <p className="mt-1 text-[12px] text-[#71717a]">
            First-touch UTM / social source on email captures
          </p>
          {board.byChannel.length === 0 ? (
            <p className="mt-4 text-[13px] text-[#71717a]">
              No channel-tagged emails in this window yet. Share links like{" "}
              <code className="text-[#a1a1aa]">?utm_source=twitter</code>.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {board.byChannel.map((row) => (
                <li
                  key={row.channel}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[13px]"
                >
                  <span className="text-[#d4d4d8]">
                    {formatChannelLabel(row.channel)}
                  </span>
                  <span className="font-semibold tabular-nums text-[#fafafa]">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5">
          <p className="text-[13px] font-semibold text-[#fafafa]">
            Capture placements ({rangeLabel})
          </p>
          <p className="mt-1 text-[12px] text-[#71717a]">
            Which form on the page (hero / mid / final)
          </p>
          {board.bySource.length === 0 ? (
            <p className="mt-4 text-[13px] text-[#71717a]">
              No landing emails in this window yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {board.bySource.map((row) => (
                <li
                  key={row.source}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[13px]"
                >
                  <span className="capitalize text-[#d4d4d8]">{row.source}</span>
                  <span className="font-semibold tabular-nums text-[#fafafa]">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#fafafa]">
            Captured emails
          </h2>
          <p className="mt-1 text-sm text-[#a1a1aa]">
            Manage waitlist / landing captures. Mark contacted, qualified, paid,
            or lost — matches against Stripe member emails when someone converts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, channel, source, note…"
            className="min-w-[220px] flex-1 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
          />
          <div className="flex flex-wrap rounded-xl border border-[#262626] bg-[#0f0f0f] p-1">
            {(
              [
                ["in_range", `${rangeLabel} (${filterCounts.inRange})`],
                ["open", `Open (${filterCounts.open})`],
                ["paid", `Paid (${filterCounts.paid})`],
                ["all", `All (${filterCounts.all})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                  filter === value
                    ? "bg-white text-black"
                    : "text-[#a1a1aa] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#262626]">
          <table className="w-full min-w-[960px] text-left text-[13px]">
            <thead className="bg-[#141414] text-[#a1a1aa]">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Placement</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Paid match</th>
                <th className="px-4 py-3 font-medium">Captured</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] bg-[#0f0f0f]">
              {filteredEmails.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-[#71717a]"
                  >
                    No captured emails in this filter.
                  </td>
                </tr>
              ) : (
                filteredEmails.map((row: FunnelEmailRow) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-[#fafafa]">{row.email}</p>
                      {row.note ? (
                        <p className="mt-1 text-[12px] text-[#71717a]">
                          {row.note}
                        </p>
                      ) : null}
                      {!row.inRange ? (
                        <p className="mt-1 text-[11px] text-[#52525b]">
                          Outside {rangeLabel.toLowerCase()} window
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top text-[#d4d4d8]">
                      <div>{formatChannelLabel(row.channel)}</div>
                      {row.utmCampaign ? (
                        <div className="mt-1 text-[11px] text-[#71717a]">
                          {row.utmCampaign}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top capitalize text-[#d4d4d8]">
                      {row.source || "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        disabled={pending}
                        value={row.status}
                        onChange={(e) =>
                          setStatus(row.id, e.target.value as LeadStatus)
                        }
                        className={`rounded-full border border-transparent px-2 py-1 text-[12px] font-semibold outline-none ${statusTone(row.status)}`}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {LEAD_STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 align-top text-[#d4d4d8]">
                      {row.paidMemberLabel ? (
                        <span className="text-emerald-300">
                          {row.paidMemberLabel}
                        </span>
                      ) : (
                        <span className="text-[#52525b]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-[#71717a]">
                      {new Date(row.createdAt).toLocaleString()}
                      <p className="text-[11px]">by {row.createdBy}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void copyEmail(row.email)}
                          className="rounded-full border border-[#262626] bg-[#141414] px-2.5 py-1.5 text-[12px] font-semibold text-[#d4d4d8] hover:bg-[#1c1c1c]"
                        >
                          {copied === row.email ? "Copied" : "Copy"}
                        </button>
                        {row.peopleHref ? (
                          <a
                            href={row.peopleHref}
                            className="rounded-full border border-[#262626] bg-[#141414] px-2.5 py-1.5 text-[12px] font-semibold text-[#70a7ff] hover:border-[#3f3f46] hover:bg-[#1c1c1c]"
                          >
                            Profile
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
