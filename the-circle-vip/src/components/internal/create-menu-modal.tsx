"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

type Panel = "menu" | "lead" | "whop";

type CreateOption = {
  id: string;
  title: string;
  description: string;
  badge?: string;
  kind: "href" | "comp" | "lead" | "whop";
  href?: string;
};

type CreateGroup = {
  title: string;
  options: CreateOption[];
};

const GROUPS: CreateGroup[] = [
  {
    title: "Members & access",
    options: [
      {
        id: "membership",
        title: "Membership",
        description: "Add a complimentary Stripe member and Telegram invite.",
        badge: "Trial",
        kind: "href",
        href: "/internal/memberships#create",
      },
      {
        id: "comp",
        title: "Comp a month",
        description: "Gift free access via invite or shareable gift link.",
        badge: "Quick",
        kind: "comp",
      },
      {
        id: "checkout",
        title: "Checkout link",
        description: "One-time claim URL at a custom price (early access, deals).",
        badge: "Paid",
        kind: "href",
        href: "/internal/checkout-links#create",
      },
      {
        id: "crypto-receipt",
        title: "Crypto receipt",
        description:
          "Ingest a USDC tx, mark preferred payment as crypto, and generate a Stripe invoice with no card charge.",
        badge: "USDC",
        kind: "href",
        href: "/internal/crypto#ingest",
      },
    ],
  },
  {
    title: "Pipeline",
    options: [
      {
        id: "lead",
        title: "Lead",
        description: "Capture a prospect email / Telegram to follow up later.",
        badge: "CRM",
        kind: "lead",
      },
      {
        id: "waitlist",
        title: "Waitlist / leads board",
        description: "Browse and update your captured leads pipeline.",
        kind: "href",
        href: "/internal/leads",
      },
      {
        id: "whop",
        title: "Whop → Stripe",
        description:
          "One-time migrate into Stripe (source of truth). Dashboard always reads Stripe.",
        badge: "Migrate",
        kind: "whop",
      },
    ],
  },
  {
    title: "Growth & catalog",
    options: [
      {
        id: "affiliate",
        title: "Affiliate",
        description: "Create a referral code, share link, and commission.",
        badge: "Partner",
        kind: "href",
        href: "/internal/affiliates#create",
      },
      {
        id: "promo",
        title: "Promo code",
        description: "Create a Stripe amount-off promotion code.",
        kind: "href",
        href: "/internal/promos#create",
      },
      {
        id: "product",
        title: "Product / price",
        description: "Edit plan copy or push a new recurring price.",
        kind: "href",
        href: "/internal/products",
      },
    ],
  },
];

function OptionIcon({ id }: { id: string }) {
  const common = "h-5 w-5";
  if (id === "membership" || id === "comp") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3 4.5 6.5v5.2c0 4.4 3 8.4 7.5 9.8 4.5-1.4 7.5-5.4 7.5-9.8V6.5L12 3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (id === "checkout") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 1 0-7.07-7.07L11 4.93"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13 19.07"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === "lead" || id === "waitlist" || id === "whop") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35M16.5 3.7a3.5 3.5 0 0 1 0 6.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === "affiliate") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M8 13.5 11 16.5l2-2M3.5 12.5l3.2-3.2a2 2 0 0 1 2.5-.2L11 10.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20.5 12.5 17.3 9.3a2 2 0 0 0-2.5-.2L13 10.5M8.5 9 10 7.5a2 2 0 0 1 2.5 0L14 9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 16.5c1.2 1.6 3 2.5 5 2.5h1.5M20 16.5c-1.2 1.6-3 2.5-5 2.5H13.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === "promo") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3.4 13.4a2 2 0 0 1 0-2.8L10.6 3.4a2 2 0 0 1 2.8 0l7.2 7.2a2 2 0 0 1 0 2.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <circle cx="9" cy="9" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5 12 4l8 4.5v9L12 22 4 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CreateMenuModal({
  open,
  onClose,
  onOpenComp,
}: {
  open: boolean;
  onClose: () => void;
  onOpenComp: () => void;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("menu");
  const [email, setEmail] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState("manual");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setPanel("menu");
    setError(null);
    setMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (panel !== "menu") {
          setPanel("menu");
          return;
        }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, panel]);

  if (!open) return null;

  function pick(option: CreateOption) {
    if (option.kind === "comp") {
      onClose();
      onOpenComp();
      return;
    }
    if (option.kind === "lead") {
      setPanel("lead");
      setError(null);
      setMessage(null);
      return;
    }
    if (option.kind === "whop") {
      setPanel("whop");
      setError(null);
      setMessage(null);
      loadWhopStripeStatus();
      return;
    }
    if (option.href) {
      onClose();
      router.push(option.href);
    }
  }

  function loadWhopStripeStatus() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/whop-import", {
          credentials: "include",
        });
        const data = (await res.json()) as {
          error?: string;
          counts?: {
            members: number;
            payments: number;
            grossUsd: number;
            activeMembers: number;
          };
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to read Stripe");
        const c = data.counts;
        if (!c) return;
        setMessage(
          `Stripe SoT: ${c.members} customers (${c.activeMembers} active) · ${c.payments} paid Whop invoices · $${c.grossUsd.toFixed(2)}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read Stripe");
      }
    });
  }

  function runWhopImport(dryRun: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/whop-import", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "import_stripe",
            dryRun,
            syncStripe: true,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          stripe?: {
            members: number;
            payments: number;
            grossUsd: number;
          };
          result?: {
            ok: boolean;
            members: {
              upserted: number;
              stripeCustomersCreated: number;
              stripeCustomersUpdated: number;
            };
            payments: {
              upserted: number;
              stripeInvoicesCreated: number;
              stripeInvoicesSkipped: number;
            };
            grossUsd: number;
            errors: string[];
          };
        };
        if (!res.ok) throw new Error(data.error ?? "Whop import failed");
        const result = data.result;
        if (!result) throw new Error("Empty import result");
        setMessage(
          [
            dryRun ? "Dry run OK." : "Stripe migration complete.",
            `${result.members.upserted} customers`,
            `${result.payments.upserted} paid invoices ($${result.grossUsd.toFixed(2)})`,
            dryRun
              ? null
              : `+${result.members.stripeCustomersCreated} new / ${result.members.stripeCustomersUpdated} updated · invoices +${result.payments.stripeInvoicesCreated} (skipped ${result.payments.stripeInvoicesSkipped})`,
            data.stripe
              ? `Live Stripe: ${data.stripe.members} cus · ${data.stripe.payments} inv · $${data.stripe.grossUsd.toFixed(2)}`
              : null,
            result.errors.length
              ? `${result.errors.length} warnings — check server logs`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Whop import failed");
      }
    });
  }

  function runWhopPersonsSync(dryRun: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/whop-import", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync_persons", dryRun }),
        });
        const data = (await res.json()) as {
          error?: string;
          result?: {
            dryRun?: boolean;
            totals?: {
              identified?: number;
              matched?: number;
              enriched?: number;
              createdLeads?: number;
              updatedLeads?: number;
              anonymousSkipped?: number;
            };
          };
        };
        if (!res.ok) throw new Error(data.error ?? "Persons sync failed");
        const t = data.result?.totals;
        setMessage(
          [
            dryRun ? "People dry run." : "People sync complete.",
            `identified ${t?.identified ?? 0}`,
            `matched ${t?.matched ?? 0}`,
            `enriched ${t?.enriched ?? 0}`,
            `leads +${t?.createdLeads ?? 0}/~${t?.updatedLeads ?? 0}`,
            `skipped anon ${t?.anonymousSkipped ?? 0}`,
          ].join(" · "),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Persons sync failed");
      }
    });
  }

  function createLead(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/leads", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            email: email.trim() || undefined,
            telegramUsername: telegramUsername.trim() || undefined,
            name: name.trim() || undefined,
            source: source.trim() || undefined,
            note: note.trim() || undefined,
          }),
        });
        const data = (await res.json()) as { error?: string; lead?: { id: string } };
        if (!res.ok) throw new Error(data.error ?? "Failed to create lead");
        setMessage(`Lead saved (${data.lead?.id.slice(0, 12)}…).`);
        setEmail("");
        setTelegramUsername("");
        setName("");
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create lead");
      }
    });
  }

  let body: ReactNode;

  if (panel === "lead") {
    body = (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setPanel("menu")}
          className="text-[13px] font-medium text-[#70a7ff] hover:underline"
        >
          ← Back to Create
        </button>
        <div>
          <h3 className="text-lg font-semibold text-[#fafafa]">Create lead</h3>
          <p className="mt-1 text-[13px] text-[#a1a1aa]">
            Park a prospect for follow-up — no payment, no membership yet.
          </p>
        </div>
        <form onSubmit={createLead} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[#a1a1aa]">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Erranza"
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[#a1a1aa]">
                Source
              </span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
              >
                <option value="manual">Manual</option>
                <option value="telegram">Telegram</option>
                <option value="whop_member">Whop member</option>
                <option value="referral">Referral</option>
                <option value="waitlist">Waitlist</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-[#a1a1aa]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@email.com"
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
                placeholder="@username"
                className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Wants early-access price, follow up Friday…"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          {error ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
              {message}{" "}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/internal/leads");
                }}
                className="font-semibold underline"
              >
                Open leads
              </button>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save lead"}
            </button>
            <button
              type="button"
              onClick={() => setPanel("menu")}
              className="rounded-full border border-[#262626] px-4 py-2.5 text-[13px] font-medium text-[#a1a1aa] hover:bg-[#1c1c1c]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  } else if (panel === "whop") {
    body = (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setPanel("menu")}
          className="text-[13px] font-medium text-[#70a7ff] hover:underline"
        >
          ← Back to Create
        </button>
        <div>
          <h3 className="text-lg font-semibold text-[#fafafa]">
            Whop → Stripe + People
          </h3>
          <p className="mt-1 text-[13px] text-[#a1a1aa]">
            Stripe is the source of truth for customers and payments. Migration
            writes Whop members as customers (
            <span className="text-[#d4d4d8]">source=whop_member</span>) and paid
            history as out-of-band invoices.{" "}
            <span className="text-[#d4d4d8]">People sync</span> enriches
            profiles from the persons export (identified users only) and creates
            missing lead stubs — anonymous storefront hits are skipped.
          </p>
        </div>
        {error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
            {message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => loadWhopStripeStatus()}
            className="rounded-full border border-[#262626] px-4 py-2.5 text-[13px] font-medium text-[#a1a1aa] hover:bg-[#1c1c1c] disabled:opacity-50"
          >
            {pending ? "Reading…" : "Refresh from Stripe"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runWhopImport(true)}
            className="rounded-full border border-[#262626] px-4 py-2.5 text-[13px] font-medium text-[#a1a1aa] hover:bg-[#1c1c1c] disabled:opacity-50"
          >
            Migrate dry run
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runWhopImport(false)}
            className="rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {pending ? "Writing…" : "Re-run migrate → Stripe"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runWhopPersonsSync(true)}
            className="rounded-full border border-[#262626] px-4 py-2.5 text-[13px] font-medium text-[#a1a1aa] hover:bg-[#1c1c1c] disabled:opacity-50"
          >
            People dry run
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => runWhopPersonsSync(false)}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-[13px] font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-50"
          >
            Sync → People
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/internal/people?tab=leads");
            }}
            className="rounded-full border border-[#262626] px-4 py-2.5 text-[13px] font-medium text-[#a1a1aa] hover:bg-[#1c1c1c]"
          >
            Open People
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-6">
        {GROUPS.map((group) => (
          <section key={group.title} className="space-y-3">
            <h3 className="text-[11px] font-semibold tracking-[0.16em] text-[#71717a] uppercase">
              {group.title}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => pick(option)}
                  className="group flex items-start gap-3 rounded-2xl border border-[#262626] bg-[#0f0f0f] px-4 py-3.5 text-left transition hover:border-[#3f3f46] hover:bg-[#161616]"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#262626] bg-[#141414] text-[#d4d4d8] group-hover:text-white">
                    <OptionIcon id={option.id} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[#fafafa]">
                        {option.title}
                      </span>
                      {option.badge ? (
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#d4d4d8] uppercase">
                          {option.badge}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-[#a1a1aa]">
                      {option.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#262626] bg-[#141414] p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#fafafa]">
              Create
            </h2>
            <p className="mt-1 text-[13px] text-[#a1a1aa]">
              Spin up memberships, deals, leads, and growth tools — full control
              of The Circle ops.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-[#a1a1aa] hover:bg-[#1c1c1c] hover:text-white"
          >
            Esc
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
