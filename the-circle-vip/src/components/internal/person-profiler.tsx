"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { MemberTagChips } from "@/components/internal/member-tag-chips";
import { PersonAvatar } from "@/components/internal/person-avatar";
import { SocialQuickLinks } from "@/components/internal/social-quick-links";
import { useInternalToast } from "@/components/internal/toast";
import type { VisitorProfile } from "@/lib/analytics-types";
import type { StripeMemberRow } from "@/lib/internal-stats-types";
import { formatUsd } from "@/lib/internal-money";
import { formatDueRelative, memberDueAt } from "@/lib/members-due";
import {
  paymentsForPerson,
  type CryptoPaymentLike,
  type StripePaymentLike,
} from "@/lib/payment-people";
import {
  PERSON_CRM_TAG_CATALOG,
  PERSON_QUALIFICATION_LABELS,
  PERSON_QUALIFICATIONS,
  personCrmTagTone,
  personQualificationTone,
  type PersonQualification,
} from "@/lib/person-crm";
import type { PersonEnrichment, PersonKind } from "@/lib/people-types";
import { personEnrichmentId } from "@/lib/people-types";

type ProfileTab = "reach" | "crm" | "profile" | "money" | "more";

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
  tags: string[];
  qualification: PersonQualification;
  linkedMemberId: string;
  linkedVisitorId: string;
};

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "reach", label: "Reach" },
  { id: "crm", label: "CRM" },
  { id: "profile", label: "Profile" },
  { id: "money", label: "Money" },
  { id: "more", label: "More" },
];

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
    tags: enrichment?.tags ?? [],
    qualification: enrichment?.qualification ?? "unqualified",
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
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-[#a1a1aa]">{label}</span>
      {children}
    </label>
  );
}

function digitsOnlyPhone(raw: string) {
  return raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

function whatsappHref(phone: string, name: string) {
  const digits = digitsOnlyPhone(phone).replace(/^\+/, "");
  if (digits.length < 8) return null;
  const text = encodeURIComponent(
    name.trim() ? `Hey ${name.trim().split(/\s+/)[0]}, ` : "Hey, ",
  );
  return `https://wa.me/${digits}?text=${text}`;
}

function mailtoHref(email: string, name: string) {
  const addr = email.trim();
  if (!addr.includes("@")) return null;
  const subject = encodeURIComponent("The Circle");
  const body = encodeURIComponent(
    name.trim() ? `Hi ${name.trim().split(/\s+/)[0]},\n\n` : "Hi,\n\n",
  );
  return `mailto:${addr}?subject=${subject}&body=${body}`;
}

const inputClass =
  "w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2 text-[13px] text-[#fafafa] outline-none focus:border-[#52525b]";

const quickBtnClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

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
  const toast = useInternalToast();
  const entityId = kind === "member" ? member?.id : visitor?.id;
  const [tab, setTab] = useState<ProfileTab>("reach");
  const [form, setForm] = useState<FormState>(() =>
    formFromSources(kind, member, visitor, enrichment),
  );
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(formFromSources(kind, member, visitor, enrichment)),
  );
  const [customTag, setCustomTag] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const next = formFromSources(kind, member, visitor, enrichment);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setCustomTag("");
    setTab("reach");
  }, [kind, member, visitor, enrichment]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!entityId || pending) return;
        const snapshot = form;
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
                ...snapshot,
              }),
            });
            const data = (await res.json()) as {
              error?: string;
              enrichment?: PersonEnrichment;
            };
            if (!res.ok) throw new Error(data.error ?? "Save failed");
            if (data.enrichment) {
              onSaved(data.enrichment);
              const synced = formFromSources(
                kind,
                member,
                visitor,
                data.enrichment,
              );
              setForm(synced);
              setBaseline(JSON.stringify(synced));
              toast.push("Profile saved", "success");
            }
          } catch (e) {
            toast.push(
              e instanceof Error ? e.message : "Save failed",
              "error",
            );
          }
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    onClose,
    onSaved,
    entityId,
    pending,
    form,
    kind,
    member,
    visitor,
    toast,
  ]);

  const dirty = JSON.stringify(form) !== baseline;
  const waHref = useMemo(
    () => whatsappHref(form.phone, form.name),
    [form.phone, form.name],
  );
  const mailHref = useMemo(
    () => mailtoHref(form.email, form.name),
    [form.email, form.name],
  );
  const telegramHref = form.telegramUsername.trim()
    ? `https://t.me/${form.telegramUsername.trim().replace(/^@/, "")}`
    : null;

  if (!entityId) return null;

  const displayName =
    form.name ||
    (form.telegramUsername
      ? `@${form.telegramUsername.replace(/^@/, "")}`
      : "") ||
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
        tags: form.tags,
        qualification: form.qualification,
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
          note: form.note || null,
          tags: form.tags,
          qualification: form.qualification,
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
          telegramUsername: form.telegramUsername || member.telegramUsername,
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

  function persist(next: FormState, successMessage: string) {
    if (!entityId) return;
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
            ...next,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          enrichment?: PersonEnrichment;
        };
        if (!res.ok) throw new Error(data.error ?? "Save failed");
        if (data.enrichment) {
          onSaved(data.enrichment);
          const synced = formFromSources(
            kind,
            member,
            visitor,
            data.enrichment,
          );
          setForm(synced);
          setBaseline(JSON.stringify(synced));
          toast.push(successMessage, "success");
        }
      } catch (e) {
        toast.push(e instanceof Error ? e.message : "Save failed", "error");
      }
    });
  }

  function save(successMessage = "Profile saved.") {
    persist(form, successMessage);
  }

  function markAsLead() {
    const next = { ...form, qualification: "lead" as const };
    if (!next.tags.some((t) => t.toLowerCase() === "lead")) {
      next.tags = [...next.tags, "Lead"];
    }
    setForm(next);
    persist(next, "Tagged as lead");
  }

  function setQualification(qualification: PersonQualification) {
    const next = { ...form, qualification };
    setForm(next);
    persist(
      next,
      `Marked ${PERSON_QUALIFICATION_LABELS[qualification].toLowerCase()}`,
    );
  }

  function toggleTag(tag: string) {
    const exists = form.tags.some(
      (row) => row.toLowerCase() === tag.toLowerCase(),
    );
    const tags = exists
      ? form.tags.filter((row) => row.toLowerCase() !== tag.toLowerCase())
      : [...form.tags, tag].slice(0, 24);
    const next = { ...form, tags };
    setForm(next);
    persist(next, exists ? `Removed “${tag}”` : `Tagged “${tag}”`);
  }

  function addCustomTag() {
    const tag = customTag.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!tag) return;
    if (form.tags.some((row) => row.toLowerCase() === tag.toLowerCase())) {
      setCustomTag("");
      return;
    }
    const next = { ...form, tags: [...form.tags, tag].slice(0, 24) };
    setForm(next);
    setCustomTag("");
    persist(next, `Tagged “${tag}”`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (dirty) {
          toast.push("Unsaved changes — save or discard first", "info");
          return;
        }
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName} profile`}
        className="relative flex h-[min(720px,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#262626] bg-[#0f0f0f] shadow-[0_30px_120px_rgba(0,0,0,0.65)] sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-[#1f1f1f] px-4 py-3 sm:px-5">
          <PersonAvatar
            id={personEnrichmentId(kind, entityId)}
            name={displayName}
            pfpUrl={form.pfpUrl || null}
            size={44}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[16px] font-semibold text-[#fafafa]">
                {displayName}
              </p>
              {dirty ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                  Unsaved
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[#71717a]">
              {kind === "member" ? "Member" : "Visitor"} ·{" "}
              <span className="font-mono">{entityId.slice(0, 16)}</span>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${personQualificationTone(form.qualification)}`}
              >
                {PERSON_QUALIFICATION_LABELS[form.qualification]}
              </span>
              {form.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${personCrmTagTone(tag)}`}
                >
                  {tag}
                </span>
              ))}
              {kind === "member" && member?.tags?.length ? (
                <MemberTagChips tags={member.tags} />
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-[#262626] text-[14px] text-[#a1a1aa] hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#1f1f1f] px-3 py-2 sm:px-4">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap transition ${
                tab === item.id
                  ? "bg-white text-black"
                  : "text-[#a1a1aa] hover:bg-white/5 hover:text-[#fafafa]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          {tab === "reach" ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <a
                  href={waHref ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (!waHref) {
                      event.preventDefault();
                      toast.push("Add a phone with country code first", "info");
                      setTab("reach");
                    }
                  }}
                  className={`${quickBtnClass} border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15 ${!waHref ? "opacity-50" : ""}`}
                >
                  WhatsApp
                </a>
                <a
                  href={mailHref ?? undefined}
                  onClick={(event) => {
                    if (!mailHref) {
                      event.preventDefault();
                      toast.push("Add an email first", "info");
                    }
                  }}
                  className={`${quickBtnClass} border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15 ${!mailHref ? "opacity-50" : ""}`}
                >
                  Email
                </a>
                {telegramHref ? (
                  <a
                    href={telegramHref}
                    target="_blank"
                    rel="noreferrer"
                    className={`${quickBtnClass} border-[#70a7ff]/30 bg-[#70a7ff]/10 text-[#9ec5ff] hover:bg-[#70a7ff]/15`}
                  >
                    Telegram
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={pending || form.qualification === "lead"}
                  onClick={markAsLead}
                  className={`${quickBtnClass} border-amber-500/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/20`}
                >
                  {form.qualification === "lead" ? "Lead ✓" : "Tag as lead"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setQualification("qualified")}
                  className={`${quickBtnClass} border-emerald-500/30 bg-[#0f0f0f] text-emerald-200 hover:bg-emerald-500/10`}
                >
                  Qualified
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setQualification("nurture")}
                  className={`${quickBtnClass} border-sky-500/30 bg-[#0f0f0f] text-sky-200 hover:bg-sky-500/10`}
                >
                  Nurture
                </button>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Phone (WhatsApp)">
                  <input
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="+34…"
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
                <Field label="Name">
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </Field>
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
              </div>

              <Field label="Quick note">
                <textarea
                  className={`${inputClass} min-h-[88px]`}
                  value={form.note}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, note: e.target.value }))
                  }
                  placeholder="Last touch, objection, next step…"
                />
              </Field>
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
              />
            </>
          ) : null}

          {tab === "crm" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-wide text-[#71717a] uppercase">
                  Qualification
                </p>
                <select
                  value={form.qualification}
                  disabled={pending}
                  onChange={(e) =>
                    setQualification(e.target.value as PersonQualification)
                  }
                  className="rounded-full border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-[#fafafa] outline-none"
                >
                  {PERSON_QUALIFICATIONS.map((value) => (
                    <option key={value} value={value}>
                      {PERSON_QUALIFICATION_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PERSON_CRM_TAG_CATALOG.map((tag) => {
                  const active = form.tags.some(
                    (row) => row.toLowerCase() === tag.toLowerCase(),
                  );
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={pending}
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                        active
                          ? personCrmTagTone(tag)
                          : "border-[#262626] bg-[#0f0f0f] text-[#71717a] hover:border-[#3f3f46] hover:text-[#d4d4d8]"
                      }`}
                    >
                      {active ? `✓ ${tag}` : tag}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  className={`${inputClass} flex-1`}
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  placeholder="Custom tag…"
                />
                <button
                  type="button"
                  disabled={pending || !customTag.trim()}
                  onClick={addCustomTag}
                  className="rounded-full border border-[#262626] bg-[#0f0f0f] px-4 text-[12px] font-semibold text-[#fafafa] hover:bg-[#1c1c1c] disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              <Field label="Operator notes">
                <textarea
                  className={`${inputClass} min-h-[140px]`}
                  value={form.note}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, note: e.target.value }))
                  }
                  placeholder="Upsell angle, objections, VIP context…"
                />
              </Field>
              <button
                type="button"
                disabled={pending}
                onClick={() => setQualification("disqualified")}
                className={`${quickBtnClass} border-rose-500/30 bg-[#0f0f0f] text-rose-300 hover:bg-rose-500/10`}
              >
                Disqualify
              </button>
            </>
          ) : null}

          {tab === "profile" ? (
            <>
              <div className="grid gap-2.5 sm:grid-cols-2">
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
                    placeholder="+34…"
                  />
                </Field>
                <Field label="Avatar seed">
                  <input
                    className={inputClass}
                    value={form.pfpUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pfpUrl: e.target.value }))
                    }
                    placeholder="avatar.vercel.sh seed"
                  />
                </Field>
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

              <div className="space-y-2">
                <p className="text-[11px] font-semibold tracking-wide text-[#71717a] uppercase">
                  Photos
                </p>
                {form.photoUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {form.photoUrls.map((url, index) => (
                      <div
                        key={`${index}-${url.slice(0, 24)}`}
                        className="relative h-16 w-16 overflow-hidden rounded-xl border border-[#262626] bg-[#0f0f0f]"
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
                              photoUrls: f.photoUrls.filter(
                                (_, i) => i !== index,
                              ),
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
                    Upload
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        if (file.size > 320_000) {
                          toast.push("Photo too large — keep under ~320KB", "error");
                          return;
                        }
                        if (form.photoUrls.length >= 6) {
                          toast.push("Max 6 photos per profile", "info");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = String(reader.result || "");
                          if (!result.startsWith("data:image/")) {
                            toast.push("Could not read image", "error");
                            return;
                          }
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
                        toast.push("Photo URLs must start with https://", "error");
                        return;
                      }
                      setForm((f) => ({
                        ...f,
                        photoUrls: [...f.photoUrls, url.trim()].slice(0, 6),
                      }));
                    }}
                    className="rounded-full border border-[#262626] bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-[#fafafa] hover:bg-[#1c1c1c]"
                  >
                    Add URL
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {tab === "money" ? (
            <>
              {kind === "member" && member ? (
                <dl className="grid grid-cols-2 gap-2 rounded-xl border border-[#262626] bg-[#141414] p-3 text-[12px]">
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
              ) : null}

              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold tracking-wide text-[#71717a] uppercase">
                  Payments
                </p>
                <p className="text-[12px] text-[#a1a1aa]">
                  {personPayments.length} · {formatUsd(paymentsTotal)}
                </p>
              </div>
              {personPayments.length === 0 ? (
                <p className="text-[13px] text-[#71717a]">
                  No matched Stripe or crypto payments yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {personPayments.slice(0, 8).map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-[#1f1f1f] bg-[#141414] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#fafafa]">
                          {payment.amountLabel}{" "}
                          <span className="text-[10px] font-bold tracking-wide text-[#71717a] uppercase">
                            {payment.tag}
                          </span>
                        </p>
                        <p className="truncate text-[11px] text-[#a1a1aa]">
                          {payment.title}
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

              <Field label="Payment methods">
                <input
                  className={inputClass}
                  value={form.paymentMethods}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, paymentMethods: e.target.value }))
                  }
                  placeholder="Visa •••• 4242, Apple Pay…"
                />
              </Field>
              <Field label="Wallets (one per line)">
                <textarea
                  className={`${inputClass} min-h-[72px] font-mono text-[12px]`}
                  value={form.wallets}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, wallets: e.target.value }))
                  }
                  placeholder="0x…"
                />
              </Field>
            </>
          ) : null}

          {tab === "more" ? (
            <>
              {visitor ? (
                <dl className="grid grid-cols-2 gap-2 rounded-xl border border-[#262626] bg-[#141414] p-3 text-[12px]">
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
                    <dd className="truncate font-mono text-[11px] text-[#70a7ff]">
                      {visitor.lastPath || "—"}
                    </dd>
                  </div>
                </dl>
              ) : null}
              <div className="grid gap-2.5 sm:grid-cols-2">
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
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#1f1f1f] px-4 py-3 sm:px-5">
          <p className="text-[11px] text-[#52525b]">
            ⌘/Ctrl+S to save · Esc to close
          </p>
          <div className="flex gap-2">
            {dirty ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const next = formFromSources(
                    kind,
                    member,
                    visitor,
                    enrichment,
                  );
                  setForm(next);
                  setBaseline(JSON.stringify(next));
                  toast.push("Changes discarded", "info");
                }}
                className="rounded-full border border-[#262626] px-4 py-2 text-[12px] font-semibold text-[#a1a1aa] hover:bg-[#1c1c1c]"
              >
                Discard
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending || !dirty}
              onClick={() => save()}
              className="rounded-full bg-white px-5 py-2 text-[12px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
