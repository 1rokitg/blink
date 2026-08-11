"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";

import { MemberTagChips } from "@/components/internal/member-tag-chips";
import { PersonAvatar } from "@/components/internal/person-avatar";
import { SocialQuickLinks } from "@/components/internal/social-quick-links";
import type { VisitorProfile } from "@/lib/analytics-types";
import type { StripeMemberRow } from "@/lib/internal-stats-types";
import { formatUsd } from "@/lib/internal-money";
import {
  formatDueRelative,
  memberDueAt,
} from "@/lib/members-due";
import {
  paymentsForPerson,
  type CryptoPaymentLike,
  type StripePaymentLike,
} from "@/lib/payment-people";
import type { PersonEnrichment, PersonKind } from "@/lib/people-types";
import { personEnrichmentId } from "@/lib/people-types";

type FormState = {
  name: string;
  email: string;
  phone: string;
  telegramUsername: string;
  discordUsername: string;
  xUsername: string;
  instagramUsername: string;
  pfpUrl: string;
  photoUrls: string[];
  paymentMethods: string;
  wallets: string;
  note: string;
  linkedMemberId: string;
  linkedVisitorId: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    email: "",
    phone: "",
    telegramUsername: "",
    discordUsername: "",
    xUsername: "",
    instagramUsername: "",
    pfpUrl: "",
    photoUrls: [],
    paymentMethods: "",
    wallets: "",
    note: "",
    linkedMemberId: "",
    linkedVisitorId: "",
  };
}

function formFromSources(
  kind: PersonKind,
  member: StripeMemberRow | null,
  visitor: VisitorProfile | null,
  enrichment: PersonEnrichment | null,
): FormState {
  const wallets = [
    ...(enrichment?.wallets ?? []),
    ...(visitor?.wallets ?? []),
    visitor?.lastWalletAddress ? [visitor.lastWalletAddress] : [],
  ];
  return {
    name: enrichment?.name || member?.name || "",
    email: enrichment?.email || member?.email || "",
    phone: enrichment?.phone || "",
    telegramUsername:
      enrichment?.telegramUsername || member?.telegramUsername || "",
    discordUsername: enrichment?.discordUsername || "",
    xUsername: enrichment?.xUsername || "",
    instagramUsername: enrichment?.instagramUsername || "",
    pfpUrl: enrichment?.pfpUrl || "",
    photoUrls: enrichment?.photoUrls ?? [],
    paymentMethods: enrichment?.paymentMethods || "",
    wallets: [...new Set(wallets.filter(Boolean))].join("\n"),
    note: enrichment?.note || member?.note || "",
    linkedMemberId:
      enrichment?.linkedMemberId ||
      (kind === "visitor" ? "" : member?.id || ""),
    linkedVisitorId:
      enrichment?.linkedVisitorId ||
      (kind === "member" ? "" : visitor?.id || ""),
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-[#a1a1aa]">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] text-[#fafafa] outline-none focus:border-[#52525b]";

export function PersonProfiler({
  kind,
  member,
  visitor,
  enrichment,
  stripePayments = [],
  cryptoPayments = [],
  onClose,
  onSaved,
}: {
  kind: PersonKind;
  member: StripeMemberRow | null;
  visitor: VisitorProfile | null;
  enrichment: PersonEnrichment | null;
  stripePayments?: StripePaymentLike[];
  cryptoPayments?: CryptoPaymentLike[];
  onClose: () => void;
  onSaved: (row: PersonEnrichment) => void;
}) {
  const entityId = kind === "member" ? member?.id : visitor?.id;
  const [form, setForm] = useState<FormState>(() =>
    formFromSources(kind, member, visitor, enrichment),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(formFromSources(kind, member, visitor, enrichment));
    setError(null);
    setMessage(null);
  }, [kind, member, visitor, enrichment]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!entityId) return null;

  const displayName =
    form.name ||
    (form.telegramUsername ? `@${form.telegramUsername.replace(/^@/, "")}` : "") ||
    form.email ||
    entityId;
  const due = member ? memberDueAt(member) : null;
  const formWallets = form.wallets
    .split(/[\n,]+/)
    .map((row) => row.trim())
    .filter(Boolean);
  const matchEnrichment: PersonEnrichment | null = enrichment
    ? {
        ...enrichment,
        telegramUsername:
          form.telegramUsername || enrichment.telegramUsername,
        email: form.email || enrichment.email,
        wallets: formWallets.length > 0 ? formWallets : enrichment.wallets,
      }
    : form.telegramUsername || form.email || formWallets.length > 0
      ? {
          id: personEnrichmentId(kind, entityId),
          kind,
          memberId: kind === "member" ? entityId : null,
          visitorId: kind === "visitor" ? entityId : null,
          name: form.name || null,
          email: form.email || null,
          phone: form.phone || null,
          telegramUsername: form.telegramUsername || null,
          discordUsername: null,
          xUsername: null,
          instagramUsername: null,
          pfpUrl: null,
          photoUrls: form.photoUrls,
          paymentMethods: null,
          wallets: formWallets,
          note: null,
          linkedMemberId: null,
          linkedVisitorId: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          updatedBy: "",
        }
      : null;
  const personPayments = paymentsForPerson({
    kind,
    entityId,
    member: member
      ? {
          ...member,
          telegramUsername:
            form.telegramUsername || member.telegramUsername,
          email: form.email || member.email,
        }
      : null,
    visitor,
    enrichment: matchEnrichment,
    stripePayments,
    cryptoPayments,
  });
  const paymentsTotal = personPayments.reduce(
    (sum, row) => sum + row.amountUsd,
    0,
  );

  function save() {
    if (!entityId) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/people", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upsert_enrichment",
            kind,
            entityId,
            ...form,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          enrichment?: PersonEnrichment;
        };
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.enrichment) {
          onSaved(data.enrichment);
          setMessage("Profile saved.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName} profile`}
        className="relative flex max-h-[min(900px,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#262626] bg-[#0f0f0f] shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[#1f1f1f] px-5 py-4 sm:px-6">
          <PersonAvatar
            id={personEnrichmentId(kind, entityId)}
            name={displayName}
            pfpUrl={form.pfpUrl || null}
            size={52}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-semibold text-[#fafafa]">
              {displayName}
            </p>
            <p className="mt-0.5 text-[12px] text-[#71717a]">
              {kind === "member" ? "Member profile" : "Visitor profile"} ·{" "}
              <span className="font-mono">{entityId.slice(0, 18)}</span>
            </p>
            {kind === "member" && member?.tags?.length ? (
              <MemberTagChips tags={member.tags} className="mt-2" />
            ) : null}
            <SocialQuickLinks
              enrichment={enrichment}
              fallbacks={{
                telegramUsername:
                  form.telegramUsername || member?.telegramUsername,
                discordUsername: form.discordUsername,
                xUsername: form.xUsername,
                instagramUsername: form.instagramUsername,
              }}
              empty={null}
              className="mt-2"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#262626] text-[15px] text-[#a1a1aa] hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
          {kind === "member" && member ? (
            <section className="rounded-xl border border-[#262626] bg-[#141414] p-4">
              <p className="text-[12px] font-semibold tracking-wide text-[#71717a] uppercase">
                Stripe membership
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-[#71717a]">Plan</dt>
                  <dd className="font-medium text-[#fafafa]">
                    {member.planLabel || member.planId || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71717a]">Status</dt>
                  <dd className="font-medium capitalize text-[#fafafa]">
                    {member.status.replaceAll("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71717a]">MRR</dt>
                  <dd className="font-medium text-[#fafafa]">
                    {formatUsd(member.mrr)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71717a]">Due</dt>
                  <dd className="font-medium text-[#fafafa]">
                    {due
                      ? `${new Date(due).toLocaleDateString()} · ${formatDueRelative(due)}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section className="rounded-xl border border-[#262626] bg-[#141414] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-semibold tracking-wide text-[#71717a] uppercase">
                Payments
              </p>
              <p className="text-[12px] text-[#a1a1aa]">
                {personPayments.length} · {formatUsd(paymentsTotal)}
              </p>
            </div>
            {personPayments.length === 0 ? (
              <p className="mt-3 text-[13px] text-[#71717a]">
                No matched Stripe or crypto payments for this identity yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {personPayments.slice(0, 12).map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#fafafa]">
                          {payment.amountLabel}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                            payment.rail === "crypto"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-[#70a7ff]/15 text-[#9ec5ff]"
                          }`}
                        >
                          {payment.tag}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-[#a1a1aa]">
                        {payment.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#71717a]">
                        {new Date(payment.at).toLocaleString()}
                        {payment.subtitle ? ` · ${payment.subtitle}` : ""}
                      </p>
                    </div>
                    {payment.externalHref ? (
                      <a
                        href={payment.externalHref}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-[11px] font-semibold text-[#70a7ff] hover:underline"
                      >
                        Open
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {personPayments.length > 12 ? (
              <p className="mt-2 text-[11px] text-[#52525b]">
                Showing latest 12 of {personPayments.length}.
              </p>
            ) : null}
          </section>

          {visitor ? (
            <section className="rounded-xl border border-[#262626] bg-[#141414] p-4">
              <p className="text-[12px] font-semibold tracking-wide text-[#71717a] uppercase">
                Site activity
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-[#71717a]">Location</dt>
                  <dd className="font-medium text-[#fafafa]">
                    {[visitor.city, visitor.region, visitor.country]
                      .filter(Boolean)
                      .join(", ") || visitor.country}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71717a]">Visits</dt>
                  <dd className="font-medium text-[#fafafa]">
                    {visitor.visitDays}d · {visitor.pageviews} imp
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[#71717a]">Last path</dt>
                  <dd className="truncate font-mono text-[12px] text-[#70a7ff]">
                    {visitor.lastPath || "—"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[#71717a]">Fingerprint</dt>
                  <dd className="text-[12px] text-[#a1a1aa]">
                    {visitor.fingerprint
                      ? `${visitor.fingerprint.platform} · ${visitor.fingerprint.timezone} · ${visitor.fingerprint.screen}`
                      : visitor.ua.slice(0, 120)}
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section className="space-y-3">
            <p className="text-[12px] font-semibold tracking-wide text-[#71717a] uppercase">
              Identity
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </Field>
              <Field label="Phone">
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+1…"
                />
              </Field>
              <Field label="Avatar seed">
                <input
                  className={inputClass}
                  value={form.pfpUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, pfpUrl: e.target.value }))
                  }
                  placeholder="Optional override for avatar.vercel.sh seed"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[12px] font-semibold tracking-wide text-[#71717a] uppercase">
              Photos
            </p>
            <p className="text-[12px] text-[#71717a]">
              Face / reference shots for CRM leads (Substack, Propr, Whop) —
              even when they never visited the site. Paste https image URLs or
              upload small photos (max 6).
            </p>
            {form.photoUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {form.photoUrls.map((url, index) => (
                  <div
                    key={`${index}-${url.slice(0, 24)}`}
                    className="relative h-20 w-20 overflow-hidden rounded-xl border border-[#262626] bg-[#0f0f0f]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          photoUrls: f.photoUrls.filter((_, i) => i !== index),
                        }))
                      }
                      className="absolute top-1 right-1 rounded-full bg-black/70 px-1.5 text-[10px] text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-full border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-[#fafafa] hover:bg-[#1c1c1c]">
                Upload photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (file.size > 320_000) {
                      setError("Photo too large — keep under ~320KB.");
                      return;
                    }
                    if (form.photoUrls.length >= 6) {
                      setError("Max 6 photos per profile.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = String(reader.result || "");
                      if (!result.startsWith("data:image/")) {
                        setError("Could not read image.");
                        return;
                      }
                      setError(null);
                      setForm((f) => ({
                        ...f,
                        photoUrls: [...f.photoUrls, result].slice(0, 6),
                      }));
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const url = window.prompt("Paste https image URL");
                  if (!url?.trim()) return;
                  if (!/^https:\/\//i.test(url.trim())) {
                    setError("Photo URLs must start with https://");
                    return;
                  }
                  setError(null);
                  setForm((f) => ({
                    ...f,
                    photoUrls: [...f.photoUrls, url.trim()].slice(0, 6),
                  }));
                }}
                className="cursor-pointer rounded-full border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-[#fafafa] hover:bg-[#1c1c1c]"
              >
                Add image URL
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[12px] font-semibold tracking-wide text-[#71717a] uppercase">
              Socials
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telegram">
                <input
                  className={inputClass}
                  value={form.telegramUsername}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      telegramUsername: e.target.value,
                    }))
                  }
                  placeholder="@username"
                />
              </Field>
              <Field label="Discord">
                <input
                  className={inputClass}
                  value={form.discordUsername}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      discordUsername: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="X / Twitter">
                <input
                  className={inputClass}
                  value={form.xUsername}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, xUsername: e.target.value }))
                  }
                />
              </Field>
              <Field label="Instagram">
                <input
                  className={inputClass}
                  value={form.instagramUsername}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      instagramUsername: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[12px] font-semibold tracking-wide text-[#71717a] uppercase">
              Money rails
            </p>
            <Field label="Payment methods">
              <input
                className={inputClass}
                value={form.paymentMethods}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paymentMethods: e.target.value }))
                }
                placeholder="Visa •••• 4242, Apple Pay, bank…"
              />
            </Field>
            <Field label="Wallets (one per line)">
              <textarea
                className={`${inputClass} min-h-[88px] font-mono text-[12px]`}
                value={form.wallets}
                onChange={(e) =>
                  setForm((f) => ({ ...f, wallets: e.target.value }))
                }
                placeholder="0x…"
              />
            </Field>
          </section>

          <section className="space-y-3">
            <p className="text-[12px] font-semibold tracking-wide text-[#71717a] uppercase">
              Notes & links
            </p>
            <Field label="Operator notes">
              <textarea
                className={`${inputClass} min-h-[120px]`}
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
                placeholder="Upsell angle, objections, VIP context…"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Linked member id">
                <input
                  className={`${inputClass} font-mono text-[12px]`}
                  value={form.linkedMemberId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      linkedMemberId: e.target.value,
                    }))
                  }
                  placeholder="sub_… or cus_…"
                />
              </Field>
              <Field label="Linked visitor id">
                <input
                  className={`${inputClass} font-mono text-[12px]`}
                  value={form.linkedVisitorId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      linkedVisitorId: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </section>

          {error ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-400">
              {message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1f1f1f] px-5 py-4 sm:px-6">
          <p className="text-[11px] text-[#52525b]">
            Enrichments save to KV — Stripe stays billing source of truth.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
