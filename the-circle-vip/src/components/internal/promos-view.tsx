"use client";

import { useState } from "react";

export function PromosView() {
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("20");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/internal/store", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_promo",
          code,
          amountOffUsd: Number(amount),
        }),
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create promo");
      setMessage(`Promo ${data.code ?? code.toUpperCase()} is live in Stripe.`);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create promo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
          Promo codes
        </h1>
        <p className="mt-1 text-[14px] text-[#a1a1aa]">
          Create one-time EUR amount-off promotion codes in Stripe.
          Enter the USD list discount; we convert at the current FX rate.
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
        </div>
      ) : null}

      <form
        id="create"
        onSubmit={createPromo}
        className="scroll-mt-24 space-y-4 rounded-2xl border border-[#262626] bg-[#141414] p-6"
      >
        <label className="block space-y-1.5">
          <span className="text-[12px] font-medium text-[#a1a1aa]">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="STREAM20"
            required
            minLength={3}
            className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[12px] font-medium text-[#a1a1aa]">
            Amount off (USD list → EUR)
          </span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            required
            className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create promo"}
        </button>
      </form>
    </div>
  );
}
