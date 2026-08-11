"use client";

import { useMemo, useState } from "react";

import { MemberTagChips } from "@/components/internal/member-tag-chips";
import type { StripeMemberRow } from "@/lib/internal-stats-types";
import { isCircleStripeMember } from "@/lib/circle-stripe-member";
import { formatUsd } from "@/lib/internal-money";
import {
  type DueHorizonDays,
  formatDueRelative,
  listMembersNeedingPaymentWarn,
  memberDueAt,
  memberDueStatus,
} from "@/lib/members-due";

const HORIZONS: { days: DueHorizonDays; label: string }[] = [
  { days: 7, label: "7d" },
  { days: 14, label: "14d" },
  { days: 30, label: "30d" },
];

function telegramHandle(member: StripeMemberRow) {
  if (!member.telegramUsername) return null;
  return `@${member.telegramUsername.replace(/^@/, "")}`;
}

function telegramDeepLink(member: StripeMemberRow) {
  const handle = member.telegramUsername?.replace(/^@/, "");
  if (handle) return `https://t.me/${handle}`;
  return null;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function PaymentsDueBoard({ members }: { members: StripeMemberRow[] }) {
  const [horizon, setHorizon] = useState<DueHorizonDays>(14);
  const [copied, setCopied] = useState<string | null>(null);

  const dueMembers = useMemo(
    () => listMembersNeedingPaymentWarn(members, horizon),
    [members, horizon],
  );

  const overdueCount = useMemo(
    () =>
      dueMembers.filter((m) => memberDueStatus(m, horizon) === "overdue")
        .length,
    [dueMembers, horizon],
  );

  const atRiskMrr = useMemo(
    () => dueMembers.reduce((sum, m) => sum + m.mrr, 0),
    [dueMembers],
  );

  async function onCopy(key: string, value: string) {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(key);
    window.setTimeout(() => {
      setCopied((prev) => (prev === key ? null : prev));
    }, 1500);
  }

  return (
    <section
      id="payments-due"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-amber-500/25 bg-[#141414] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#fafafa]">
            Payments due
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] text-[#a1a1aa]">
            Members to warn manually via Telegram or email before access should
            end. Automation (bot nudges + email) is planned later — use Copy /
            Open TG for now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
            Horizon
          </span>
          {HORIZONS.map((item) => (
            <button
              key={item.days}
              type="button"
              onClick={() => setHorizon(item.days)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                horizon === item.days
                  ? "border-amber-400/60 bg-amber-500/15 text-amber-200"
                  : "border-[#262626] bg-[#0f0f0f] text-[#a1a1aa] hover:bg-[#141414]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] px-4 py-3">
          <p className="text-[12px] text-[#a1a1aa]">Need a warning</p>
          <p className="mt-1 text-2xl font-semibold text-[#fafafa]">
            {dueMembers.length}
          </p>
        </div>
        <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] px-4 py-3">
          <p className="text-[12px] text-[#a1a1aa]">Overdue / past due</p>
          <p className="mt-1 text-2xl font-semibold text-amber-300">
            {overdueCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] px-4 py-3">
          <p className="text-[12px] text-[#a1a1aa]">At-risk MRR</p>
          <p className="mt-1 text-2xl font-semibold text-[#fafafa]">
            {formatUsd(atRiskMrr)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#262626]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#0f0f0f] text-[11px] tracking-wide text-[#a1a1aa] uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
              </tr>
            </thead>
            <tbody>
              {dueMembers.map((member) => {
                const due = memberDueAt(member);
                const status = memberDueStatus(member, horizon);
                const handle = telegramHandle(member);
                const tgLink = telegramDeepLink(member);
                return (
                  <tr
                    key={`due-${member.id}`}
                    className={`border-t border-[#1f1f1f] align-top ${
                      isCircleStripeMember(member)
                        ? "circle-stripe-member-glow"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#fafafa]">
                          {handle || member.name || member.email || member.id}
                        </p>
                        {isCircleStripeMember(member) ? (
                          <span className="circle-stripe-badge">Circle</span>
                        ) : null}
                      </div>
                      <MemberTagChips tags={member.tags} className="mt-1.5" />
                      <p className="text-[11px] text-[#71717a]">
                        {member.telegramUserId || member.email || "—"}
                        {member.source ? ` · ${member.source}` : ""}
                      </p>
                      {member.dueKind === "whop_estimate" ? (
                        <p className="mt-1 text-[11px] text-amber-300/90">
                          Whop estimate (last paid + 30d)
                          {member.lastPaidAt
                            ? ` · paid ${new Date(member.lastPaidAt).toLocaleDateString()}`
                            : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p
                        className={
                          status === "overdue"
                            ? "font-semibold text-amber-300"
                            : "font-semibold text-[#fafafa]"
                        }
                      >
                        {formatDueRelative(due)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#71717a]">
                        {due ? new Date(due).toLocaleDateString() : "—"}
                        {member.status === "past_due" ||
                        member.status === "unpaid"
                          ? ` · ${member.status.replaceAll("_", " ")}`
                          : ""}
                        {member.cancelAtPeriodEnd ? " · canceling" : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{member.planLabel || member.planId || "—"}</p>
                      <p className="text-[11px] text-[#71717a]">
                        {formatUsd(member.mrr)}/mo
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {handle ? (
                          <button
                            type="button"
                            onClick={() =>
                              void onCopy(`tg-${member.id}`, handle)
                            }
                            className="rounded-full border border-[#262626] px-2.5 py-1.5 text-[12px] font-semibold text-[#e4e4e7] hover:bg-[#0f0f0f]"
                          >
                            {copied === `tg-${member.id}`
                              ? "Copied"
                              : "Copy TG"}
                          </button>
                        ) : null}
                        {tgLink ? (
                          <a
                            href={tgLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-[#262626] px-2.5 py-1.5 text-[12px] font-semibold text-[#70a7ff] hover:bg-[#0f0f0f]"
                          >
                            Open TG
                          </a>
                        ) : null}
                        {member.email ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                void onCopy(`email-${member.id}`, member.email!)
                              }
                              className="rounded-full border border-[#262626] px-2.5 py-1.5 text-[12px] font-semibold text-[#e4e4e7] hover:bg-[#0f0f0f]"
                            >
                              {copied === `email-${member.id}`
                                ? "Copied"
                                : "Copy email"}
                            </button>
                            <a
                              href={`mailto:${member.email}?subject=${encodeURIComponent("The Circle — membership renewal")}`}
                              className="rounded-full border border-[#262626] px-2.5 py-1.5 text-[12px] font-semibold text-[#70a7ff] hover:bg-[#0f0f0f]"
                            >
                              Email
                            </a>
                          </>
                        ) : null}
                        {!handle && !member.email ? (
                          <span className="text-[11px] text-[#71717a]">
                            No Telegram / email on file
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {dueMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-[#71717a]"
                  >
                    Nobody overdue or due within the next {horizon} days.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
