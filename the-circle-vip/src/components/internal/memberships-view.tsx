"use client";

import { useMemo, useState } from "react";

import { PaymentsDueBoard } from "@/components/internal/payments-due-board";
import { MemberTagChips } from "@/components/internal/member-tag-chips";
import type { StripeMemberRow } from "@/lib/internal-stats-types";
import {
  circleStripeSourceLabel,
  isCircleStripeMember,
} from "@/lib/circle-stripe-member";
import { formatUsd } from "@/lib/internal-money";
import {
  formatDueRelative,
  memberDueAt,
  memberDueStatus,
} from "@/lib/members-due";

type Props = {
  initialMembers: StripeMemberRow[];
  stripeConfigured: boolean;
};

type BusyAction =
  | { kind: "add" }
  | { kind: "transfer"; id: string }
  | { kind: "revoke"; id: string }
  | { kind: "invite"; id: string }
  | null;

function statusTone(status: string) {
  if (status === "active" || status === "trialing") {
    return "bg-emerald-500/10 text-emerald-400";
  }
  if (status === "past_due" || status === "unpaid") {
    return "bg-amber-500/10 text-amber-300";
  }
  if (status === "canceled" || status === "incomplete_expired") {
    return "bg-[#262626] text-[#a1a1aa]";
  }
  return "bg-sky-50 text-sky-700";
}

export function MembershipsView({ initialMembers, stripeConfigured }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "circle" | "all">("active");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteFlash, setInviteFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);

  const [addForm, setAddForm] = useState({
    telegramUsername: "",
    telegramUserId: "",
    email: "",
    planId: "month",
    note: "",
  });
  const [transferFor, setTransferFor] = useState<string | null>(null);
  const [transferForm, setTransferForm] = useState({
    toTelegramUsername: "",
    toTelegramUserId: "",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "active" && !["active", "trialing"].includes(m.status)) {
        return false;
      }
      if (filter === "circle" && !isCircleStripeMember(m)) {
        return false;
      }
      if (!q) return true;
      return [
        m.email,
        m.name,
        m.telegramUsername,
        m.telegramUserId,
        m.planLabel,
        m.status,
        m.id,
        m.note,
        m.source,
        ...(m.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [members, search, filter]);

  const circleCount = useMemo(
    () => members.filter((m) => isCircleStripeMember(m)).length,
    [members],
  );

  function upsertMember(member: StripeMemberRow) {
    setMembers((prev) => {
      const next = prev.filter((m) => m.id !== member.id);
      next.unshift(member);
      return next;
    });
  }

  async function runAction(
    body: Record<string, unknown>,
    action: BusyAction,
  ) {
    setBusy(action);
    setError(null);
    setMessage(null);
    setInviteFlash(null);
    try {
      const res = await fetch("/api/internal/memberships", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        member?: StripeMemberRow;
        inviteLink?: string | null;
        telegramNote?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (data.member) upsertMember(data.member);
      if (data.inviteLink) setInviteFlash(data.inviteLink);
      setMessage(data.telegramNote ?? "Updated.");
      if (body.action === "add") {
        setAddForm({
          telegramUsername: "",
          telegramUserId: "",
          email: "",
          planId: "month",
          note: "",
        });
      }
      if (body.action === "transfer") {
        setTransferFor(null);
        setTransferForm({ toTelegramUsername: "", toTelegramUserId: "" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
            Memberships
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#a1a1aa]">
            Add, transfer, or revoke paid-group access. Use{" "}
            <a href="#payments-due" className="text-[#70a7ff] underline">
              Payments due
            </a>{" "}
            to warn renewing members manually via Telegram or email. Group kicks
            and automated reminders come later with The Circle Guard.
          </p>
        </div>
      </div>

      <PaymentsDueBoard members={members} />

      {!stripeConfigured ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-300">
          Stripe is not configured — membership actions stay disabled.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-400">
          {message}
        </div>
      ) : null}
      {inviteFlash ? (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-[13px] text-blue-300">
          <p className="font-semibold">Invite link</p>
          <a
            href={inviteFlash}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all font-mono text-[12px] underline"
          >
            {inviteFlash}
          </a>
          <button
            type="button"
            className="mt-2 text-[12px] font-semibold text-[#70a7ff]"
            onClick={() => void navigator.clipboard.writeText(inviteFlash)}
          >
            Copy link
          </button>
        </div>
      ) : null}

      <form
        id="create"
        className="scroll-mt-24 space-y-4 rounded-2xl border border-[#262626] bg-[#141414] p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void runAction(
            {
              action: "add",
              planId: addForm.planId,
              telegramUsername: addForm.telegramUsername,
              telegramUserId: addForm.telegramUserId || undefined,
              email: addForm.email || undefined,
              note: addForm.note || undefined,
            },
            { kind: "add" },
          );
        }}
      >
        <div>
          <h2 className="text-[15px] font-semibold text-[#fafafa]">
            Add member manually
          </h2>
          <p className="mt-1 text-[13px] text-[#a1a1aa]">
            Creates a complimentary Stripe membership for the plan period (no
            card charge). Generate an invite and send it in Telegram yourself.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="block space-y-1.5 xl:col-span-1">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Telegram @username
            </span>
            <input
              required
              value={addForm.telegramUsername}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, telegramUsername: e.target.value }))
              }
              placeholder="traderjoe"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Telegram user id (optional)
            </span>
            <input
              value={addForm.telegramUserId}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, telegramUserId: e.target.value }))
              }
              placeholder="123456789"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Email (optional)
            </span>
            <input
              type="email"
              value={addForm.email}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, email: e.target.value }))
              }
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Plan</span>
            <select
              value={addForm.planId}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, planId: e.target.value }))
              }
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            >
              <option value="month">1 Month</option>
              <option value="quarter">3 Months</option>
              <option value="year">One Year</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Note</span>
            <input
              value={addForm.note}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, note: e.target.value }))
              }
              placeholder="Comp, partner, transfer…"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={!stripeConfigured || busy?.kind === "add"}
          className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {busy?.kind === "add" ? "Adding…" : "Add membership"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search telegram, email, plan, note…"
          className="min-w-[240px] flex-1 rounded-xl border border-[#262626] bg-[#141414] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
        />
        <div className="flex gap-2">
          {(
            [
              { value: "active", label: "Active" },
              {
                value: "circle",
                label: `Circle Stripe${circleCount ? ` · ${circleCount}` : ""}`,
              },
              { value: "all", label: "All" },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full border px-3 py-2 text-[13px] font-medium ${
                filter === item.value
                  ? item.value === "circle"
                    ? "border-[#ff6a00] bg-[#ff6a00]/15 text-[#ffb07a]"
                    : "border-white bg-white text-black"
                  : "border-[#262626] bg-[#141414] text-[#a1a1aa]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#262626] bg-[#141414] ">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#0f0f0f] text-[11px] tracking-wide text-[#a1a1aa] uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Due / ends</th>
                <th className="px-4 py-3 font-semibold">Invite</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => {
                const isCircle = isCircleStripeMember(member);
                return (
                <tr
                  key={member.id}
                  className={`border-t border-[#1f1f1f] align-top ${
                    isCircle ? "circle-stripe-member-glow" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#fafafa]">
                        {member.telegramUsername
                          ? `@${member.telegramUsername.replace(/^@/, "")}`
                          : member.name || member.email || member.id}
                      </p>
                      {isCircle ? (
                        <span className="circle-stripe-badge">Circle</span>
                      ) : null}
                    </div>
                    <MemberTagChips tags={member.tags} className="mt-1.5" />
                    <p className="text-[11px] text-[#71717a]">
                      {member.telegramUserId || member.email || "—"}
                      {member.source
                        ? ` · ${
                            isCircle
                              ? circleStripeSourceLabel(member.source)
                              : member.source
                          }`
                        : isCircle
                          ? " · Circle Stripe"
                          : ""}
                    </p>
                    {member.note ? (
                      <p className="mt-1 text-[11px] text-[#a1a1aa]">
                        {member.note}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p>{member.planLabel || member.planId || "—"}</p>
                    <p className="text-[11px] text-[#71717a]">
                      {formatUsd(member.mrr)}/mo
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${statusTone(member.status)}`}
                    >
                      {member.status.replaceAll("_", " ")}
                    </span>
                    {member.cancelAtPeriodEnd ? (
                      <p className="mt-1 text-[11px] text-amber-300">
                        Cancels at period end
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#a1a1aa]">
                    {(() => {
                      const due = memberDueAt(member);
                      const status = memberDueStatus(member, 14);
                      return (
                        <>
                          <p
                            className={
                              status === "overdue"
                                ? "font-semibold text-amber-300"
                                : status === "due_soon"
                                  ? "font-semibold text-[#fafafa]"
                                  : ""
                            }
                          >
                            {due
                              ? new Date(due).toLocaleDateString()
                              : "—"}
                          </p>
                          {due ? (
                            <p className="mt-0.5 text-[11px] text-[#71717a]">
                              {formatDueRelative(due)}
                              {member.dueKind === "whop_estimate"
                                ? " · est."
                                : ""}
                            </p>
                          ) : null}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {member.inviteLink ? (
                      <a
                        href={member.inviteLink}
                        target="_blank"
                        rel="noreferrer"
                        className="block max-w-[160px] truncate font-mono text-[11px] text-[#70a7ff] underline"
                      >
                        {member.inviteLink}
                      </a>
                    ) : (
                      <span className="text-[11px] text-[#71717a]">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 sm:min-w-[150px]">
                      <button
                        type="button"
                        disabled={
                          !stripeConfigured ||
                          (busy?.kind === "invite" && busy.id === member.id)
                        }
                        onClick={() =>
                          void runAction(
                            {
                              action: "refresh_invite",
                              subscriptionId: member.id,
                            },
                            { kind: "invite", id: member.id },
                          )
                        }
                        className="rounded-full border border-[#262626] px-2.5 py-1.5 text-[12px] font-semibold text-[#e4e4e7] hover:bg-[#0f0f0f] disabled:opacity-50"
                      >
                        {busy?.kind === "invite" && busy.id === member.id
                          ? "…"
                          : "New invite"}
                      </button>
                      <button
                        type="button"
                        disabled={!stripeConfigured}
                        onClick={() => {
                          setTransferFor(
                            transferFor === member.id ? null : member.id,
                          );
                          setTransferForm({
                            toTelegramUsername: "",
                            toTelegramUserId: "",
                          });
                        }}
                        className="rounded-full border border-[#262626] px-2.5 py-1.5 text-[12px] font-semibold text-[#e4e4e7] hover:bg-[#0f0f0f] disabled:opacity-50"
                      >
                        Transfer
                      </button>
                      <button
                        type="button"
                        disabled={
                          !stripeConfigured ||
                          member.status === "canceled" ||
                          (busy?.kind === "revoke" && busy.id === member.id)
                        }
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Cancel membership for ${member.telegramUsername || member.id}? Ends at period close. Remove them from Telegram manually.`,
                            )
                          ) {
                            return;
                          }
                          void runAction(
                            {
                              action: "revoke",
                              subscriptionId: member.id,
                              immediate: false,
                            },
                            { kind: "revoke", id: member.id },
                          );
                        }}
                        className="rounded-full border border-red-500/20 px-2.5 py-1.5 text-[12px] font-semibold text-red-400 hover:bg-red-500/100/10 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                      <button
                        type="button"
                        disabled={
                          !stripeConfigured ||
                          member.status === "canceled" ||
                          (busy?.kind === "revoke" && busy.id === member.id)
                        }
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Immediately cancel ${member.telegramUsername || member.id}? Also remove them from Telegram manually.`,
                            )
                          ) {
                            return;
                          }
                          void runAction(
                            {
                              action: "revoke",
                              subscriptionId: member.id,
                              immediate: true,
                            },
                            { kind: "revoke", id: member.id },
                          );
                        }}
                        className="rounded-full px-2.5 py-1.5 text-[12px] font-semibold text-[#71717a] hover:text-red-400 disabled:opacity-50"
                      >
                        Cancel now
                      </button>
                    </div>

                    {transferFor === member.id ? (
                      <form
                        className="mt-3 space-y-2 rounded-xl border border-[#262626] bg-[#0f0f0f] p-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void runAction(
                            {
                              action: "transfer",
                              subscriptionId: member.id,
                              toTelegramUsername:
                                transferForm.toTelegramUsername,
                              toTelegramUserId:
                                transferForm.toTelegramUserId || undefined,
                            },
                            { kind: "transfer", id: member.id },
                          );
                        }}
                      >
                        <p className="text-[12px] font-semibold text-[#e4e4e7]">
                          Transfer to
                        </p>
                        <input
                          required
                          value={transferForm.toTelegramUsername}
                          onChange={(e) =>
                            setTransferForm((f) => ({
                              ...f,
                              toTelegramUsername: e.target.value,
                            }))
                          }
                          placeholder="new_username"
                          className="w-full rounded-lg border border-[#262626] bg-[#141414] px-2.5 py-2 text-[13px] outline-none focus:border-[#52525b]"
                        />
                        <input
                          value={transferForm.toTelegramUserId}
                          onChange={(e) =>
                            setTransferForm((f) => ({
                              ...f,
                              toTelegramUserId: e.target.value,
                            }))
                          }
                          placeholder="Telegram user id (optional)"
                          className="w-full rounded-lg border border-[#262626] bg-[#141414] px-2.5 py-2 text-[13px] outline-none focus:border-[#52525b]"
                        />
                        <button
                          type="submit"
                          disabled={
                            busy?.kind === "transfer" && busy.id === member.id
                          }
                          className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black disabled:opacity-50"
                        >
                          {busy?.kind === "transfer" && busy.id === member.id
                            ? "Transferring…"
                            : "Confirm transfer"}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-[#71717a]"
                  >
                    No memberships match this filter.
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
