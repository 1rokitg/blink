"use client";

import { useMemo, useState, useTransition } from "react";

import {
  hasCrossMatch,
  leadTagTone,
  primarySourceTag,
  type LeadTag,
  type LeadTagId,
} from "@/lib/lead-cross-tags";
import { formatUsd } from "@/lib/internal-money";
import {
  LEAD_STATUS_LABEL,
  type LeadRecord,
  type LeadStatus,
} from "@/lib/leads-types";
import type { SubstackLeadMeta } from "@/lib/substack-meta";

const STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "member",
  "lost",
];

type LeadFilter =
  | "open"
  | "substack"
  | "substack_paid"
  | "propr"
  | "whop"
  | "waitlist"
  | "paid"
  | "also_whop"
  | "cross"
  | "all";

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

function sourceLabel(source: string | null) {
  const s = (source || "").toLowerCase();
  if (s === "whop_member" || s === "whop_person") return "Whop";
  if (s === "substack") return "Substack";
  if (s === "propr") return "Propr";
  if (s === "waitlist") return "Waitlist";
  if (s === "manual") return "Manual";
  if (!source) return "—";
  return source.replaceAll("_", " ");
}

function initials(lead: LeadRecord) {
  const base =
    lead.name?.trim() ||
    lead.telegramUsername?.trim() ||
    lead.email?.trim() ||
    "?";
  const parts = base.replace(/^@/, "").split(/[\s._#-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function leadMatchesSource(lead: LeadRecord, source: string) {
  return (lead.source || "").toLowerCase() === source;
}

function leadHasTag(tags: LeadTag[] | undefined, id: LeadTagId) {
  return Boolean(tags?.some((tag) => tag.id === id));
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SubstackPaymentBlock({ meta }: { meta: SubstackLeadMeta }) {
  const stripe = meta.stripe;
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] text-[#71717a] uppercase">
            Newsletter
          </p>
          <p className="mt-0.5 text-[12px] font-semibold text-[#fafafa]">
            {meta.type}
            {meta.stripePlan ? (
              <span className="font-normal text-[#a1a1aa]">
                {" "}
                · {meta.stripePlan}
              </span>
            ) : null}
          </p>
        </div>
        {meta.isPaidExport ? (
          <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
            Export {meta.exportRevenueLabel}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-[#262626] px-2 py-0.5 text-[10px] text-[#71717a]">
            Free
          </span>
        )}
      </div>

      <div className="border-t border-[#1f1f1f] pt-2">
        <p className="text-[10px] font-bold tracking-[0.14em] text-[#71717a] uppercase">
          Stripe payments · SoT
        </p>
        {stripe && stripe.lifetimeUsd > 0 ? (
          <>
            <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-emerald-300">
              {formatUsd(stripe.lifetimeUsd)}
            </p>
            <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
              {stripe.invoiceCount} invoice
              {stripe.invoiceCount === 1 ? "" : "s"}
              {stripe.sources.length
                ? ` · ${stripe.sources.join(", ")}`
                : ""}
              {stripe.lastPaidAt
                ? ` · last ${formatShortDate(stripe.lastPaidAt)}`
                : ""}
            </p>
          </>
        ) : (
          <p className="mt-0.5 text-[11px] text-[#71717a]">
            No paid invoices in Stripe for this email yet
          </p>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-[#52525b]">
        {[
          meta.country ? meta.country : null,
          meta.opens6mo ? `${meta.opens6mo} opens/6mo` : null,
          meta.postViews ? `${meta.postViews} post views` : null,
          meta.firstPaidAt
            ? `newsletter paid ${formatShortDate(meta.firstPaidAt)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") || "—"}
      </p>
    </div>
  );
}

export function LeadsView({
  initialLeads,
  peopleHrefs = {},
  tagsByLeadId = {},
  substackByLeadId = {},
}: {
  initialLeads: LeadRecord[];
  /** Deep-links into `/internal/people` for non-paid leads. */
  peopleHrefs?: Record<string, string>;
  /** Cross-dataset tags computed server-side. */
  tagsByLeadId?: Record<string, LeadTag[]>;
  /** Substack export + Stripe payment enrichment. */
  substackByLeadId?: Record<string, SubstackLeadMeta>;
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LeadFilter>("open");
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    let open = 0;
    let paid = 0;
    let propr = 0;
    let substack = 0;
    let substackPaid = 0;
    let whop = 0;
    let waitlist = 0;
    let alsoWhop = 0;
    let cross = 0;
    for (const lead of leads) {
      const tags = tagsByLeadId[lead.id] ?? [];
      const primary = primarySourceTag(lead.source);
      const substackMeta = substackByLeadId[lead.id];
      if (leadMatchesSource(lead, "propr") || leadHasTag(tags, "propr")) {
        propr += 1;
      }
      if (leadMatchesSource(lead, "substack") || leadHasTag(tags, "substack")) {
        substack += 1;
      }
      if (
        substackMeta &&
        ((substackMeta.stripe?.lifetimeUsd ?? 0) > 0 ||
          substackMeta.isPaidExport)
      ) {
        substackPaid += 1;
      }
      if (
        leadMatchesSource(lead, "whop_member") ||
        leadMatchesSource(lead, "whop_person") ||
        leadHasTag(tags, "whop")
      ) {
        whop += 1;
      }
      if (leadMatchesSource(lead, "waitlist") || leadHasTag(tags, "waitlist")) {
        waitlist += 1;
      }
      if (leadHasTag(tags, "whop") && primary !== "whop") alsoWhop += 1;
      if (hasCrossMatch(tags, lead.source)) cross += 1;
      if (lead.status === "member") paid += 1;
      else if (lead.status !== "lost") open += 1;
    }
    return {
      open,
      paid,
      propr,
      substack,
      substackPaid,
      whop,
      waitlist,
      alsoWhop,
      cross,
      all: leads.length,
    };
  }, [leads, tagsByLeadId, substackByLeadId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const tags = tagsByLeadId[lead.id] ?? [];
      const primary = primarySourceTag(lead.source);
      const substackMeta = substackByLeadId[lead.id];

      if (filter === "open") {
        if (lead.status === "member" || lead.status === "lost") return false;
      } else if (filter === "paid") {
        if (lead.status !== "member") return false;
      } else if (filter === "propr") {
        if (
          !leadMatchesSource(lead, "propr") &&
          !leadHasTag(tags, "propr")
        ) {
          return false;
        }
      } else if (filter === "substack") {
        if (
          !leadMatchesSource(lead, "substack") &&
          !leadHasTag(tags, "substack")
        ) {
          return false;
        }
      } else if (filter === "substack_paid") {
        if (
          !substackMeta ||
          ((substackMeta.stripe?.lifetimeUsd ?? 0) <= 0 &&
            !substackMeta.isPaidExport)
        ) {
          return false;
        }
      } else if (filter === "whop") {
        if (
          !leadMatchesSource(lead, "whop_member") &&
          !leadMatchesSource(lead, "whop_person") &&
          !leadHasTag(tags, "whop")
        ) {
          return false;
        }
      } else if (filter === "waitlist") {
        if (
          !leadMatchesSource(lead, "waitlist") &&
          !leadHasTag(tags, "waitlist")
        ) {
          return false;
        }
      } else if (filter === "also_whop") {
        if (!(leadHasTag(tags, "whop") && primary !== "whop")) return false;
      } else if (filter === "cross") {
        if (!hasCrossMatch(tags, lead.source)) return false;
      }

      if (!q) return true;
      return [
        lead.name,
        lead.email,
        lead.telegramUsername,
        lead.source,
        lead.channel,
        lead.note,
        lead.status,
        LEAD_STATUS_LABEL[lead.status],
        substackMeta?.type,
        substackMeta?.stripePlan,
        substackMeta?.exportRevenueLabel,
        ...tags.map((tag) => tag.label),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, search, filter, tagsByLeadId, substackByLeadId]);

  function setStatus(id: string, status: LeadStatus) {
    startTransition(async () => {
      const res = await fetch("/api/internal/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", id, status }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { lead: LeadRecord };
      setLeads((prev) =>
        prev.map((lead) => (lead.id === id ? data.lead : lead)),
      );
    });
  }

  const emptyCopy =
    filter === "paid"
      ? "No paid members in the pipeline yet."
      : filter === "propr"
        ? "No Propr leads yet — import from Emails or re-run the Propr CSV script."
        : filter === "substack"
          ? "No Substack leads yet — import the subscriber export from Emails."
          : filter === "substack_paid"
            ? "No Substack leads with Stripe payments or paid newsletter export."
            : filter === "whop"
              ? "No Whop matches yet."
              : filter === "also_whop"
                ? "No leads that also appear on Whop."
                : filter === "cross"
                  ? "No cross-matched leads yet."
                  : filter === "open"
                    ? "No open leads — switch to Paid, Substack, or All."
                    : "No leads yet. Use Create → Lead to capture one.";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
          Leads
        </h1>
        <p className="mt-1 max-w-3xl text-[14px] text-[#a1a1aa]">
          Pipeline for prospects, Whop migrants, Substack subscribers, Propr
          referrals, and waitlist interest. Substack cards show newsletter type
          from the export, and Stripe invoice totals as payment source of truth
          when the email matches.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, telegram, tags, note…"
          className="min-w-[220px] flex-1 rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
        />
        <div className="flex flex-wrap rounded-xl border border-[#262626] bg-[#0f0f0f] p-1">
          {(
            [
              ["open", `Open (${counts.open})`],
              ["substack", `Substack (${counts.substack})`],
              ["substack_paid", `Substack $ (${counts.substackPaid})`],
              ["propr", `Propr (${counts.propr})`],
              ["whop", `Whop (${counts.whop})`],
              ["waitlist", `Waitlist (${counts.waitlist})`],
              ["also_whop", `Also Whop (${counts.alsoWhop})`],
              ["cross", `Cross (${counts.cross})`],
              ["paid", `Paid (${counts.paid})`],
              ["all", `All (${counts.all})`],
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

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#262626] px-4 py-14 text-center text-[14px] text-[#71717a]">
          {emptyCopy}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((lead) => {
            const profileHref = peopleHrefs[lead.id] ?? null;
            const tags = tagsByLeadId[lead.id] ?? [];
            const primary = primarySourceTag(lead.source);
            const crossTags = tags.filter((tag) => tag.id !== primary);
            const substackMeta = substackByLeadId[lead.id] ?? null;
            const title =
              lead.name || lead.telegramUsername || lead.email || "Lead";

            return (
              <article
                key={lead.id}
                className="flex min-h-[220px] flex-col rounded-2xl border border-[#262626] bg-[#141414] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1c1c1c] text-[12px] font-bold tracking-wide text-[#d4d4d8]">
                    {initials(lead)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2
                      className="truncate text-[14px] font-semibold text-[#fafafa]"
                      title={title}
                    >
                      {title}
                    </h2>
                    <p className="mt-0.5 truncate text-[12px] text-[#a1a1aa]">
                      {lead.email || "No email"}
                    </p>
                    {lead.telegramUsername ? (
                      <p className="truncate text-[11px] text-[#71717a]">
                        @{lead.telegramUsername.replace(/^@/, "")}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex rounded-full border border-[#262626] bg-[#0f0f0f] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#d4d4d8] uppercase">
                    {sourceLabel(lead.source)}
                  </span>
                  {crossTags.map((tag) => (
                    <span
                      key={`${lead.id}-${tag.id}-${tag.via}`}
                      title={`Also on ${tag.label} · matched by ${tag.via}`}
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${leadTagTone(tag.id)}`}
                    >
                      +{tag.label}
                    </span>
                  ))}
                  {substackMeta?.stripe &&
                  substackMeta.stripe.lifetimeUsd > 0 ? (
                    <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                      Stripe {formatUsd(substackMeta.stripe.lifetimeUsd)}
                    </span>
                  ) : null}
                </div>

                {substackMeta ? (
                  <SubstackPaymentBlock meta={substackMeta} />
                ) : lead.note ? (
                  <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-[#71717a]">
                    {lead.note}
                  </p>
                ) : (
                  <p className="mt-3 text-[11px] text-[#52525b]">No note</p>
                )}

                <div className="mt-auto space-y-3 pt-4">
                  <select
                    disabled={pending}
                    value={lead.status}
                    onChange={(e) =>
                      setStatus(lead.id, e.target.value as LeadStatus)
                    }
                    className={`w-full cursor-pointer rounded-full border border-transparent px-2.5 py-1.5 text-[12px] font-semibold outline-none ${statusTone(lead.status)}`}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {LEAD_STATUS_LABEL[status]}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between gap-2">
                    {profileHref ? (
                      <a
                        href={profileHref}
                        className="inline-flex rounded-full border border-[#262626] bg-[#0f0f0f] px-2.5 py-1.5 text-[11px] font-semibold text-[#70a7ff] hover:border-[#3f3f46] hover:bg-[#1c1c1c]"
                      >
                        Profile
                      </a>
                    ) : (
                      <span className="text-[11px] text-[#52525b]">—</span>
                    )}
                    <time className="text-[10px] text-[#52525b]">
                      {new Date(lead.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
