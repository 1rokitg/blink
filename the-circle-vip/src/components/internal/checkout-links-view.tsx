"use client";

import { useState, useTransition } from "react";

type ClaimLinkRow = {
  id: string;
  url: string;
  amountUsd: number;
  amountUsdCents: number;
  interval: "month" | "year";
  intervalCount: number;
  email: string | null;
  telegramUsername: string | null;
  note: string | null;
  label: string | null;
  status: "pending" | "claimed" | "completed" | "revoked" | "expired";
  createdAt: string;
  createdBy: string;
  expiresAt: string | null;
  claimedAt: string | null;
  completedAt: string | null;
};

function formatMoney(amount: number) {
  return amount.toLocaleString("en-IE", {
    style: "currency",
    currency: "EUR",
  });
}

function statusTone(status: ClaimLinkRow["status"]) {
  switch (status) {
    case "pending":
      return "bg-sky-500/10 text-sky-300";
    case "claimed":
      return "bg-amber-500/10 text-amber-300";
    case "completed":
      return "bg-emerald-500/10 text-emerald-300";
    case "revoked":
      return "bg-red-500/10 text-red-300";
    case "expired":
      return "bg-zinc-500/10 text-zinc-400";
  }
}

export function CheckoutLinksView({
  initialLinks,
}: {
  initialLinks: ClaimLinkRow[];
}) {
  const [links, setLinks] = useState(initialLinks);
  const [amount, setAmount] = useState("2.50");
  const [email, setEmail] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [label, setLabel] = useState("Early access");
  const [note, setNote] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("14");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const res = await fetch("/api/internal/claim-links", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { links: ClaimLinkRow[] };
    setLinks(data.links);
  }

  function createLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setCreatedUrl(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/claim-links", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountUsd: Number(amount),
            interval: "month",
            intervalCount: 1,
            planId: "month",
            email: email.trim() || undefined,
            telegramUsername: telegramUsername.trim() || undefined,
            label: label.trim() || undefined,
            note: note.trim() || undefined,
            expiresInDays: Number(expiresInDays) || 14,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          link?: ClaimLinkRow;
        };
        if (!res.ok || !data.link) {
          throw new Error(data.error ?? "Failed to create claim link");
        }
        setCreatedUrl(data.link.url);
        setMessage(`Link ready for ${formatMoney(data.link.amountUsd)}/month.`);
        setEmail("");
        setTelegramUsername("");
        setNote("");
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create link");
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/internal/claim-links", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revoke", id }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to revoke");
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revoke");
      }
    });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Copied claim URL.");
    } catch {
      setMessage(url);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
          Checkout links
        </h1>
        <p className="mt-1 text-[14px] text-[#a1a1aa]">
          One-time secure links at{" "}
          <span className="text-[#d4d4d8]">rokitg.com/claim/…</span> for custom
          prices (early access, migrations). Customer claims → Stripe Checkout →
          membership updates automatically. Claim links stamp Stripe with an{" "}
          <span className="text-[#d4d4d8]">Early customer discount</span> tag
          shown on Memberships and People.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-400">
          {message}
          {createdUrl ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-lg bg-black/30 px-2 py-1 text-[12px] text-[#fafafa]">
                {createdUrl}
              </code>
              <button
                type="button"
                onClick={() => void copy(createdUrl)}
                className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-black"
              >
                Copy
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <form
        id="create"
        onSubmit={createLink}
        className="scroll-mt-24 space-y-4 rounded-2xl border border-[#262626] bg-[#141414] p-6"
      >
        <div>
          <h2 className="text-[15px] font-semibold text-[#fafafa]">
            Create customer claim link
          </h2>
          <p className="mt-1 text-[13px] text-[#a1a1aa]">
            Example: early-access Whop migrant at $2.50/month USD list (billed
            in EUR at the current FX rate). Prefill email / Telegram so Stripe
            Checkout is ready for them.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Price (USD list / month → EUR)
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              required
              placeholder="2.50"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Customer email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lsevillanopereira@gmail.com"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Telegram @username
            </span>
            <input
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="Erranza"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Expires in (days)
            </span>
            <input
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              inputMode="numeric"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Early access"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Internal note
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Whop migrant · kept $2.50/mo"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Generate claim link"}
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-[18px] font-semibold text-[#fafafa]">
            Recent links
          </h2>
          <button
            type="button"
            onClick={() => startTransition(() => void refresh())}
            className="text-[13px] font-medium text-[#70a7ff] hover:underline"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#262626]">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-[#141414] text-[#a1a1aa]">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Link</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] bg-[#0f0f0f]">
              {links.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[#71717a]"
                  >
                    No claim links yet. Create one for Erranza at $2.50 above.
                  </td>
                </tr>
              ) : (
                links.map((link) => (
                  <tr key={link.id}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-[#fafafa]">
                        {link.label || "Custom claim"}
                      </p>
                      <p className="text-[#a1a1aa]">
                        {link.email || "—"}
                        {link.telegramUsername
                          ? ` · @${link.telegramUsername}`
                          : ""}
                      </p>
                      {link.note ? (
                        <p className="mt-1 text-[12px] text-[#71717a]">
                          {link.note}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top text-[#fafafa]">
                      {formatMoney(link.amountUsd)}/{link.interval}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-[12px] font-semibold capitalize ${statusTone(link.status)}`}
                      >
                        {link.status}
                      </span>
                      <p className="mt-1 text-[11px] text-[#71717a]">
                        {new Date(link.createdAt).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <code className="break-all text-[11px] text-[#d4d4d8]">
                        {link.url}
                      </code>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => void copy(link.url)}
                          className="rounded-full border border-[#262626] px-2.5 py-1 text-[12px] font-medium text-[#fafafa] hover:bg-[#1c1c1c]"
                        >
                          Copy
                        </button>
                        {link.status === "pending" ||
                        link.status === "claimed" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => revoke(link.id)}
                            className="rounded-full border border-red-500/30 px-2.5 py-1 text-[12px] font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            Revoke
                          </button>
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
