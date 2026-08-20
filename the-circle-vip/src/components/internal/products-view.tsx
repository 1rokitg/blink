"use client";

import { useEffect, useState } from "react";

import type { StorePlanRow } from "@/lib/analytics-types";
import { formatUsd } from "@/lib/internal-money";
import type { PlanId } from "@/lib/plans";

const PLAN_ACCENT: Record<string, string> = {
  month: "from-sky-500/30 via-sky-500/5 to-transparent",
  quarter: "from-violet-500/30 via-violet-500/5 to-transparent",
  year: "from-amber-500/30 via-amber-500/5 to-transparent",
};

const PLAN_RING: Record<string, string> = {
  month: "border-sky-500/25",
  quarter: "border-violet-500/25",
  year: "border-amber-500/25",
};

function intervalCopy(plan: StorePlanRow) {
  if (plan.intervalCount > 1) {
    return `every ${plan.intervalCount} ${plan.interval}s`;
  }
  return `per ${plan.interval}`;
}

export function ProductsView({
  initialStore,
}: {
  initialStore?: StorePlanRow[];
}) {
  const [store, setStore] = useState<StorePlanRow[]>(initialStore ?? []);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/internal/store", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        store?: StorePlanRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load products");
      setStore(data.store ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    if (!initialStore?.length) void load();
  }, [initialStore]);

  async function runAction(body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/internal/store", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        store?: StorePlanRow[];
      };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      if (data.store) setStore(data.store);
      else await load();
      setMessage("Product updated in Stripe.");
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
          Products
        </h1>
        <p className="mt-1 text-[14px] text-[#a1a1aa]">
          Your paid membership SKUs. Tap a card to edit copy or push a new
          Stripe price.
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {store.map((plan) => {
          const isEditing = editingId === plan.id;
          return (
            <article
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-3xl border bg-[#141414] ${
                PLAN_RING[plan.id] ?? "border-[#262626]"
              }`}
            >
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${
                  PLAN_ACCENT[plan.id] ?? "from-white/10 to-transparent"
                }`}
              />

              <div className="relative flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-[#d4d4d8] uppercase">
                    {plan.id}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                      plan.active
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-zinc-500/15 text-zinc-400"
                    }`}
                  >
                    {plan.active ? "Live" : "Off"}
                  </span>
                </div>

                <h2 className="mt-5 text-[22px] font-semibold tracking-tight text-[#fafafa]">
                  {plan.label}
                </h2>

                <div className="mt-4">
                  <p className="text-[40px] font-semibold leading-none tracking-tight text-[#fafafa]">
                    {formatUsd(plan.amountEur)}
                  </p>
                  <p className="mt-2 text-[13px] text-[#a1a1aa]">
                    {plan.amountUsd} USDC crypto · {intervalCopy(plan)}
                    {plan.override ? " · override" : ""}
                  </p>
                </div>

                <p className="mt-4 line-clamp-3 flex-1 text-[13px] leading-relaxed text-[#a1a1aa]">
                  {plan.description || "No description yet."}
                </p>

                <dl className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-[#262626] bg-[#0f0f0f]/80 p-3 text-[12px]">
                  <div>
                    <dt className="text-[#71717a]">Subscribers</dt>
                    <dd className="mt-0.5 text-[16px] font-semibold text-[#fafafa]">
                      {plan.subscribers.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#71717a]">MRR</dt>
                    <dd className="mt-0.5 text-[16px] font-semibold text-[#fafafa]">
                      {formatUsd(plan.mrr)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[#71717a]">Checkout interest</dt>
                    <dd className="mt-0.5 font-medium text-[#d4d4d8]">
                      {plan.checkoutStarts.toLocaleString()} page hits
                    </dd>
                  </div>
                </dl>

                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setEditingId(plan.id)}
                    className="mt-4 w-full rounded-full border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[13px] font-semibold text-[#e4e4e7] hover:bg-[#1a1a1a]"
                  >
                    Manage product
                  </button>
                ) : (
                  <div className="mt-4 space-y-3 rounded-2xl border border-[#262626] bg-[#0f0f0f] p-3">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-[#a1a1aa]">
                        Display name
                      </span>
                      <input
                        defaultValue={plan.label}
                        id={`name-${plan.id}`}
                        className="w-full rounded-xl border border-[#262626] bg-[#141414] px-3 py-2 text-[13px] outline-none focus:border-[#52525b]"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-[#a1a1aa]">
                        Description
                      </span>
                      <textarea
                        defaultValue={plan.description}
                        id={`desc-${plan.id}`}
                        rows={3}
                        className="w-full rounded-xl border border-[#262626] bg-[#141414] px-3 py-2 text-[13px] outline-none focus:border-[#52525b]"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-[#a1a1aa]">
                        New USD list price (converted to EUR on Stripe)
                      </span>
                      <input
                        value={priceDrafts[plan.id] ?? String(plan.amountUsd)}
                        onChange={(e) =>
                          setPriceDrafts((prev) => ({
                            ...prev,
                            [plan.id]: e.target.value,
                          }))
                        }
                        inputMode="decimal"
                        className="w-full rounded-xl border border-[#262626] bg-[#141414] px-3 py-2 text-[13px] outline-none focus:border-[#52525b]"
                      />
                    </label>
                    <p className="truncate text-[10px] text-[#52525b]">
                      {plan.priceId || "no price id"}
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={busy || !plan.productId}
                        onClick={() => {
                          const name = (
                            document.getElementById(
                              `name-${plan.id}`,
                            ) as HTMLInputElement | null
                          )?.value;
                          const description = (
                            document.getElementById(
                              `desc-${plan.id}`,
                            ) as HTMLTextAreaElement | null
                          )?.value;
                          void runAction({
                            action: "update_product",
                            planId: plan.id as PlanId,
                            name,
                            description,
                          });
                        }}
                        className="rounded-full border border-[#262626] px-3 py-2 text-[12px] font-semibold text-[#e4e4e7] hover:bg-[#1a1a1a] disabled:opacity-50"
                      >
                        Save copy
                      </button>
                      <button
                        type="button"
                        disabled={busy || !plan.productId}
                        onClick={() =>
                          void runAction({
                            action: "set_price",
                            planId: plan.id as PlanId,
                            amountUsd: Number(
                              priceDrafts[plan.id] ?? plan.amountUsd,
                            ),
                          })
                        }
                        className="rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
                      >
                        Push price
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:text-[#d4d4d8]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {store.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#262626] bg-[#141414] px-6 py-16 text-center text-[14px] text-[#71717a]">
          No products loaded yet.
        </div>
      ) : null}
    </div>
  );
}
