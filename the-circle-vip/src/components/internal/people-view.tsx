"use client";

import { useEffect, useMemo, useState } from "react";

import { CountryFlag } from "@/components/internal/country-flag";
import { MemberTagChips } from "@/components/internal/member-tag-chips";
import { PersonAvatar } from "@/components/internal/person-avatar";
import { PersonProfiler } from "@/components/internal/person-profiler";
import { SocialQuickLinks } from "@/components/internal/social-quick-links";
import type { VisitorProfile } from "@/lib/analytics-types";
import type { StripeMemberRow } from "@/lib/internal-stats-types";
import {
  circleStripeSourceLabel,
  isCircleStripeMember,
} from "@/lib/circle-stripe-member";
import { formatUsd } from "@/lib/internal-money";
import { isMemberConversionLead } from "@/lib/lead-classification";
import {
  paymentsForPerson,
  type CryptoPaymentLike,
  type StripePaymentLike,
} from "@/lib/payment-people";
import {
  isCrmLeadQualification,
  PERSON_CRM_TAG_CATALOG,
  personCrmTagTone,
  personQualificationTone,
  PERSON_QUALIFICATION_LABELS,
  type PersonQualification,
} from "@/lib/person-crm";
import type { PersonEnrichment, PersonKind } from "@/lib/people-types";
import { personEnrichmentId } from "@/lib/people-types";

type PeopleTab = "leads" | "members" | "visitors";

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

type SelectedPerson =
  | { kind: "member"; member: StripeMemberRow }
  | { kind: "visitor"; visitor: VisitorProfile };

export function PeopleView({
  people,
  members,
  initialEnrichments = [],
}: {
  people: VisitorProfile[];
  members: StripeMemberRow[];
  initialEnrichments?: PersonEnrichment[];
}) {
  const [tab, setTab] = useState<PeopleTab>("leads");
  const [search, setSearch] = useState("");
  const [enrichments, setEnrichments] = useState(initialEnrichments);
  const [selected, setSelected] = useState<SelectedPerson | null>(null);
  const [stripePayments, setStripePayments] = useState<StripePaymentLike[]>([]);
  const [cryptoPayments, setCryptoPayments] = useState<CryptoPaymentLike[]>([]);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [qualificationFilter, setQualificationFilter] = useState<
    "all" | PersonQualification
  >("all");
  const q = search.trim().toLowerCase();

  // Deep-link from Leads: /internal/people?kind=member&id=…&tab=leads
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (
      tabParam === "leads" ||
      tabParam === "members" ||
      tabParam === "visitors"
    ) {
      setTab(tabParam);
    }
    const kind = params.get("kind");
    const id = params.get("id");
    if (!kind || !id) return;
    if (kind === "member") {
      const member = members.find((row) => row.id === id);
      if (member) setSelected({ kind: "member", member });
      return;
    }
    if (kind === "visitor") {
      const visitor = people.find((row) => row.id === id);
      if (visitor) setSelected({ kind: "visitor", visitor });
    }
  }, [members, people]);

  const payingMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          !isMemberConversionLead(m) &&
          (m.status === "active" || (m.mrr ?? 0) > 0),
      ),
    [members],
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/internal/people?limit=200", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          enrichments?: PersonEnrichment[];
        };
        if (data.enrichments) setEnrichments(data.enrichments);
      } catch {
        // keep SSR enrichments
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [stripeRes, cryptoRes] = await Promise.all([
          fetch("/api/internal/payments?rail=stripe-payments", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/internal/payments", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);
        if (stripeRes.ok) {
          const data = (await stripeRes.json()) as {
            payments?: StripePaymentLike[];
          };
          setStripePayments(data.payments ?? []);
        }
        if (cryptoRes.ok) {
          const data = (await cryptoRes.json()) as {
            payments?: CryptoPaymentLike[];
          };
          setCryptoPayments(data.payments ?? []);
        }
      } catch {
        // profile still works without payment overlay
      }
    })();
  }, []);

  const enrichmentById = useMemo(() => {
    const map = new Map<string, PersonEnrichment>();
    for (const row of enrichments) map.set(row.id, row);
    return map;
  }, [enrichments]);

  const leadMembers = useMemo(() => {
    return members.filter((m) => {
      const enrichment = enrichmentById.get(personEnrichmentId("member", m.id));
      return (
        isMemberConversionLead(m) ||
        (enrichment
          ? isCrmLeadQualification(enrichment.qualification)
          : false)
      );
    });
  }, [members, enrichmentById]);

  function enrichmentFor(kind: PersonKind, entityId: string) {
    return enrichmentById.get(personEnrichmentId(kind, entityId)) ?? null;
  }

  function paymentSummaryForMember(member: StripeMemberRow) {
    const rows = paymentsForPerson({
      kind: "member",
      entityId: member.id,
      member,
      visitor: null,
      enrichment: enrichmentFor("member", member.id),
      stripePayments,
      cryptoPayments,
    });
    return {
      count: rows.length,
      total: rows.reduce((sum, row) => sum + row.amountUsd, 0),
    };
  }

  function paymentSummaryForVisitor(visitor: VisitorProfile) {
    const rows = paymentsForPerson({
      kind: "visitor",
      entityId: visitor.id,
      member: null,
      visitor,
      enrichment: enrichmentFor("visitor", visitor.id),
      stripePayments,
      cryptoPayments,
    });
    return {
      count: rows.length,
      total: rows.reduce((sum, row) => sum + row.amountUsd, 0),
    };
  }

  function memberMatchesQuery(m: StripeMemberRow) {
    if (!q) return true;
    const enrichment = enrichmentFor("member", m.id);
    return [
      m.email,
      m.name,
      m.telegramUsername,
      m.planLabel,
      m.status,
      m.source,
      m.id,
      ...(m.tags ?? []),
      ...(enrichment?.tags ?? []),
      enrichment?.qualification,
      enrichment?.phone,
      enrichment?.discordUsername,
      enrichment?.xUsername,
      enrichment?.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  }

  function matchesCrmFilters(enrichment: PersonEnrichment | null) {
    if (
      qualificationFilter !== "all" &&
      (enrichment?.qualification ?? "unqualified") !== qualificationFilter
    ) {
      return false;
    }
    if (tagFilter !== "all") {
      const tags = enrichment?.tags ?? [];
      if (
        !tags.some((tag) => tag.toLowerCase() === tagFilter.toLowerCase())
      ) {
        return false;
      }
    }
    return true;
  }

  const filteredLeads = useMemo(
    () =>
      leadMembers.filter(
        (m) =>
          memberMatchesQuery(m) &&
          matchesCrmFilters(enrichmentFor("member", m.id)),
      ),
    [leadMembers, q, enrichmentById, tagFilter, qualificationFilter],
  );

  const filteredMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          memberMatchesQuery(m) &&
          matchesCrmFilters(enrichmentFor("member", m.id)),
      ),
    [members, q, enrichmentById, tagFilter, qualificationFilter],
  );

  const filteredPeople = useMemo(
    () =>
      people.filter((p) => {
        const enrichment = enrichmentFor("visitor", p.id);
        if (!matchesCrmFilters(enrichment)) return false;
        if (!q) return true;
        return [
          p.ip,
          p.country,
          p.city,
          p.lastPath,
          p.ua,
          p.lastWalletAddress,
          p.lastWalletBrand,
          enrichment?.name,
          enrichment?.email,
          enrichment?.phone,
          enrichment?.telegramUsername,
          enrichment?.note,
          ...(enrichment?.tags ?? []),
          enrichment?.qualification,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      }),
    [people, q, enrichmentById, tagFilter, qualificationFilter],
  );

  const selectedEnrichment = selected
    ? enrichmentFor(
        selected.kind,
        selected.kind === "member"
          ? selected.member.id
          : selected.visitor.id,
      )
    : null;

  const profiledMembers = members.filter((m) =>
    Boolean(enrichmentFor("member", m.id)?.note || enrichmentFor("member", m.id)?.phone),
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">People</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#a1a1aa]">
            Open any profile to WhatsApp, email, tag as lead, add CRM tags, and
            notes. Leads include trialing members plus anyone you qualify.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["leads", `Leads (${leadMembers.length})`],
              ["members", `Members (${members.length})`],
              ["visitors", `Visitors (${people.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full border px-3 py-2 text-sm font-medium ${
                tab === id
                  ? "border-white bg-white text-black"
                  : "border-[#262626] bg-[#141414] text-[#a1a1aa]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <p className="text-[12px] text-amber-200/80">Leads</p>
          <p className="mt-1 text-2xl font-semibold text-amber-100">
            {leadMembers.length}
          </p>
          <p className="text-[11px] text-amber-100/60">
            Trialing · CRM qualified
          </p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-3">
          <p className="text-[12px] text-[#a1a1aa]">Paying members</p>
          <p className="mt-1 text-2xl font-semibold">{payingMembers.length}</p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-3">
          <p className="text-[12px] text-[#a1a1aa]">Unique visitors</p>
          <p className="mt-1 text-2xl font-semibold">{people.length}</p>
        </div>
        <div className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-3">
          <p className="text-[12px] text-[#a1a1aa]">Enriched</p>
          <p className="mt-1 text-2xl font-semibold">{enrichments.length}</p>
          <p className="text-[11px] text-[#71717a]">
            {profiledMembers} noted profiles
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === "visitors"
              ? "Search IP, country, wallet, tags, notes…"
              : "Search name, email, telegram, tags, notes…"
          }
          className="w-full rounded-xl border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm outline-none focus:border-[#52525b]"
        />
        <select
          value={qualificationFilter}
          onChange={(e) =>
            setQualificationFilter(
              e.target.value as "all" | PersonQualification,
            )
          }
          className="rounded-xl border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm text-[#fafafa] outline-none sm:w-44"
        >
          <option value="all">All qualifications</option>
          {(
            Object.keys(PERSON_QUALIFICATION_LABELS) as PersonQualification[]
          ).map((value) => (
            <option key={value} value={value}>
              {PERSON_QUALIFICATION_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-xl border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm text-[#fafafa] outline-none sm:w-44"
        >
          <option value="all">All tags</option>
          {PERSON_CRM_TAG_CATALOG.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414] shadow-sm">
        <div className="overflow-x-auto">
          {tab === "leads" || tab === "members" ? (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#0f0f0f] text-xs tracking-wide text-[#a1a1aa] uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Person</th>
                  <th className="px-4 py-3 font-semibold">Socials</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Paid</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">MRR</th>
                </tr>
              </thead>
              <tbody>
                {(tab === "leads" ? filteredLeads : filteredMembers).map(
                  (member) => {
                  const enrichment = enrichmentFor("member", member.id);
                  const isLead = isMemberConversionLead(member);
                  const paid = paymentSummaryForMember(member);
                  const label =
                    enrichment?.name ||
                    (member.telegramUsername
                      ? `@${member.telegramUsername.replace(/^@/, "")}`
                      : null) ||
                    member.name ||
                    member.email ||
                    member.id;
                  return (
                    <tr
                      key={member.id}
                      className={`cursor-pointer border-t border-[#1f1f1f] hover:bg-white/[0.03] ${
                        isCircleStripeMember(member)
                          ? "circle-stripe-member-glow"
                          : ""
                      }`}
                      onClick={() => setSelected({ kind: "member", member })}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <PersonAvatar
                            id={personEnrichmentId("member", member.id)}
                            name={label}
                            pfpUrl={enrichment?.pfpUrl}
                            size={36}
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-[#fafafa]">{label}</p>
                              {isCircleStripeMember(member) ? (
                                <span className="circle-stripe-badge">
                                  Circle
                                </span>
                              ) : null}
                              {enrichment?.qualification &&
                              enrichment.qualification !== "unqualified" ? (
                                <span
                                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${personQualificationTone(enrichment.qualification)}`}
                                >
                                  {
                                    PERSON_QUALIFICATION_LABELS[
                                      enrichment.qualification
                                    ]
                                  }
                                </span>
                              ) : isLead ? (
                                <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300 uppercase">
                                  Lead
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <MemberTagChips tags={member.tags} />
                              {(enrichment?.tags ?? []).slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${personCrmTagTone(tag)}`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-[#71717a]">
                              {enrichment?.note
                                ? enrichment.note.slice(0, 48)
                                : member.source === "whop_member" &&
                                    !member.lastPaidAt
                                  ? "Whop · unpaid"
                                  : isCircleStripeMember(member)
                                    ? circleStripeSourceLabel(member.source)
                                    : member.source || "Open profile"}
                              {enrichment?.note && enrichment.note.length > 48
                                ? "…"
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <SocialQuickLinks
                          enrichment={enrichment}
                          fallbacks={{
                            telegramUsername: member.telegramUsername,
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#a1a1aa]">
                        <p>{enrichment?.email || member.email || "—"}</p>
                        <p>
                          {enrichment?.phone ||
                            (member.telegramUsername
                              ? `@${member.telegramUsername.replace(/^@/, "")}`
                              : "—")}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {paid.count > 0 ? (
                          <>
                            <p className="font-semibold text-[#fafafa]">
                              {formatUsd(paid.total)}
                            </p>
                            <p className="text-[#71717a]">
                              {paid.count} payment{paid.count === 1 ? "" : "s"}
                            </p>
                          </>
                        ) : (
                          <span className="text-[#52525b]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {member.planLabel || member.planId || "—"}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {member.status.replaceAll("_", " ")}
                        {member.cancelAtPeriodEnd ? " · ending" : ""}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatUsd(member.mrr)}
                      </td>
                    </tr>
                  );
                })}
                {(tab === "leads" ? filteredLeads : filteredMembers).length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-[#71717a]"
                    >
                      {tab === "leads"
                        ? "No conversion leads — every trialing member is converted."
                        : "No members found."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#0f0f0f] text-xs tracking-wide text-[#a1a1aa] uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Person</th>
                  <th className="px-4 py-3 font-semibold">Socials</th>
                  <th className="px-4 py-3 font-semibold">Paid</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Wallet</th>
                  <th className="px-4 py-3 font-semibold">Visits</th>
                  <th className="px-4 py-3 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((person) => {
                  const enrichment = enrichmentFor("visitor", person.id);
                  const paid = paymentSummaryForVisitor(person);
                  const label =
                    enrichment?.name ||
                    (enrichment?.telegramUsername
                      ? `@${enrichment.telegramUsername}`
                      : null) ||
                    person.ip;
                  return (
                    <tr
                      key={person.id}
                      className="cursor-pointer border-t border-[#1f1f1f] hover:bg-white/[0.03]"
                      onClick={() =>
                        setSelected({ kind: "visitor", visitor: person })
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <PersonAvatar
                            id={personEnrichmentId("visitor", person.id)}
                            name={label}
                            pfpUrl={enrichment?.pfpUrl}
                            size={36}
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-[#fafafa]">{label}</p>
                              {enrichment?.qualification &&
                              enrichment.qualification !== "unqualified" ? (
                                <span
                                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${personQualificationTone(enrichment.qualification)}`}
                                >
                                  {
                                    PERSON_QUALIFICATION_LABELS[
                                      enrichment.qualification
                                    ]
                                  }
                                </span>
                              ) : null}
                            </div>
                            {(enrichment?.tags?.length ?? 0) > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {enrichment!.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${personCrmTagTone(tag)}`}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <p className="max-w-[220px] truncate font-mono text-[11px] text-[#71717a]">
                              {enrichment?.email || person.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <SocialQuickLinks enrichment={enrichment} />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {paid.count > 0 ? (
                          <>
                            <p className="font-semibold text-[#fafafa]">
                              {formatUsd(paid.total)}
                            </p>
                            <p className="text-[#71717a]">
                              {paid.count} payment{paid.count === 1 ? "" : "s"}
                            </p>
                          </>
                        ) : (
                          <span className="text-[#52525b]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CountryFlag code={person.country} size={18} />
                          <span>{person.country}</span>
                        </div>
                        <p className="text-xs text-[#a1a1aa]">
                          {[person.city, person.region]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-semibold">
                          {person.lastWalletBrand ||
                            enrichment?.wallets[0]?.slice(0, 8) ||
                            "—"}
                        </p>
                        <p className="max-w-[160px] truncate font-mono text-[11px] text-[#a1a1aa]">
                          {person.lastWalletAddress ||
                            enrichment?.wallets[0] ||
                            "no wallet"}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {person.visitDays}
                        <span className="ml-1 text-xs font-normal text-[#a1a1aa]">
                          / {person.pageviews} imp
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {relativeTime(person.lastSeen)}
                      </td>
                    </tr>
                  );
                })}
                {filteredPeople.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-[#71717a]"
                    >
                      No visitors yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected ? (
        <PersonProfiler
          kind={selected.kind}
          member={selected.kind === "member" ? selected.member : null}
          visitor={selected.kind === "visitor" ? selected.visitor : null}
          enrichment={selectedEnrichment}
          stripePayments={stripePayments}
          cryptoPayments={cryptoPayments}
          onClose={() => {
            setSelected(null);
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("kind");
              url.searchParams.delete("id");
              window.history.replaceState({}, "", url.pathname + url.search);
            }
          }}
          onSaved={(row) => {
            setEnrichments((prev) => [
              row,
              ...prev.filter((item) => item.id !== row.id),
            ]);
          }}
        />
      ) : null}
    </div>
  );
}
