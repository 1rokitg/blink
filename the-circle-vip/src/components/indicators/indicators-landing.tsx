"use client";

import Image from "next/image";
import { useState, useTransition } from "react";

import { formatEur, usdToEur } from "@/lib/fx-display";
import { INDICATORS_SITE } from "@/lib/indicators-site";

function amountLabel() {
  return formatEur(usdToEur(INDICATORS_SITE.amountUsd));
}

export function IndicatorsLanding({ canceled = false }: { canceled?: boolean }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const price = amountLabel();

  function checkout() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/indicators/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim() || undefined,
          }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          setError(data.error ?? "Checkout failed.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Network error starting checkout.");
      }
    });
  }

  return (
    <main className="indicators-site relative min-h-screen overflow-x-hidden text-white">
      <div className="pointer-events-none absolute inset-0 indicators-atmosphere" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <p className="font-[family-name:var(--font-syne)] text-lg font-semibold tracking-tight">
          {INDICATORS_SITE.brand}
          <span className="ml-1.5 text-sm font-medium text-white/45">
            by RokitG
          </span>
        </p>
        <a
          href={INDICATORS_SITE.articleUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-white/50 underline-offset-2 transition hover:text-white/80 hover:underline"
        >
          Read the essay
        </a>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-10 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-20">
        <div className="indicators-fade-up">
          <p className="text-[11px] font-bold tracking-[0.22em] text-[#7dffb3] uppercase">
            One-time pack · .zip
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-syne)] text-[clamp(2.75rem,8vw,4.75rem)] font-semibold leading-[0.95] tracking-tight">
            {INDICATORS_SITE.brand}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-white/70 sm:text-xl">
            {INDICATORS_SITE.heroSupport}
          </p>

          <div className="mt-8 flex flex-wrap items-end gap-4">
            <button
              type="button"
              onClick={checkout}
              disabled={pending}
              className="indicators-cta rounded-2xl px-6 py-3.5 text-sm font-bold text-[#04140c] transition hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Opening Stripe…" : `Buy the pack · ${price}`}
            </button>
            <p className="pb-1 text-xs text-white/45">
              One-time · delivered by email
            </p>
          </div>

          {canceled ? (
            <p className="mt-4 text-sm text-amber-200/90">
              Checkout canceled — nothing was charged.
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-red-300">{error}</p>
          ) : null}

          <label className="mt-6 block max-w-sm">
            <span className="text-[11px] font-semibold tracking-wide text-white/40 uppercase">
              Email for delivery (recommended)
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#7dffb3]/50"
            />
          </label>
        </div>

        <div className="indicators-fade-up indicators-fade-up-delay relative">
          <div className="indicators-hero-frame relative overflow-hidden">
            <Image
              src="/indicators-hero.png"
              alt="Aggregated OrderBook Depth — live bid and ask liquidity"
              width={1168}
              height={784}
              priority
              className="h-auto w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#04140c]/85 via-transparent to-transparent" />
            <p className="absolute bottom-4 left-4 right-4 text-[12px] font-medium text-white/75">
              {INDICATORS_SITE.primaryName} · indicators + video + aggr.trade
              templates
            </p>
          </div>
        </div>
      </section>

      {/* What’s in the pack */}
      <section className="relative z-10 border-t border-white/8 bg-black/25">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <p className="text-[11px] font-bold tracking-[0.18em] text-[#7dffb3] uppercase">
            What’s inside
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to run the same stack.
          </h2>
          <ul className="mt-12 grid gap-10 sm:grid-cols-3">
            {INDICATORS_SITE.deliverables.map((item, index) => (
              <li key={item.title} className="indicators-fade-up">
                <p className="font-mono text-[12px] font-semibold tracking-wide text-[#7dffb3]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-syne)] text-xl font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-2xl text-sm leading-relaxed text-white/45">
            Templates are for{" "}
            <a
              href={INDICATORS_SITE.aggrTradeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-white/70 underline-offset-2 hover:text-white hover:underline"
            >
              aggr.trade
            </a>
            — the open-source crypto tape app. Mine are customized layouts I
            actually trade with (same family as community packs like{" "}
            <a
              href={INDICATORS_SITE.aggrTemplatesReferenceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-white/70 underline-offset-2 hover:text-white hover:underline"
            >
              cryptorife/aggr-templates
            </a>
            ).
          </p>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/8">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/40 uppercase">
            The usual suspects
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Most indicators are just price + volume.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/60 sm:text-lg">
            RSI, MACD, moving averages, and a lot of fancy momentum tools —
            different ways of slicing the same two data points. That’s why they
            crowd together and stop working the moment too many people pile in.
            Funding, open interest, and liquidation spikes are useful… and
            mainstream for a reason. They’re table stakes.
          </p>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/8 bg-black/25">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <p className="text-[11px] font-bold tracking-[0.18em] text-[#7dffb3] uppercase">
            The needle-mover
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
            {INDICATORS_SITE.primaryName}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/60 sm:text-lg">
            A cross-exchange view of liquidity sitting on both sides of the book
            — bids (buyers) and asks (sellers) — right around the current price.
            It’s not just “volume.” It’s intent.
          </p>
          <p className="mt-4 text-base leading-relaxed text-white/60 sm:text-lg">
            When the bid side stacks and grows while price drifts higher,
            passive buyers are quietly supporting the move. No dramatic market
            buys required. The opposite is true when asks dominate. It’s subtle,
            it takes a minute to read properly, and almost no one is using the
            aggregated version across exchanges — that’s why it still works.
          </p>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/8">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/40 uppercase">
            How I use them together
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Depth first. Then the rest of the stack.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
            I don’t rely on order book depth in isolation. When all four line
            up, that’s when I get excited and size up — discipline beats hype.
          </p>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2">
            {INDICATORS_SITE.stack.map((item) => (
              <li key={item.step} className="indicators-fade-up">
                <p className="font-mono text-[12px] font-semibold tracking-wide text-[#7dffb3]">
                  {item.step}
                </p>
                <h3 className="mt-2 font-[family-name:var(--font-syne)] text-xl font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/8 bg-black/25">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-[11px] font-bold tracking-[0.18em] text-white/40 uppercase">
              Real world · $TON
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
              A steady grind — with bids underneath.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/60">
              $TON more than doubled, but it wasn’t a parabolic blow-off. It was
              a controlled grind higher. Throughout the move, aggregated order
              book depth on the bid side stayed positive and kept building —
              passive bids acting like a silent floor the entire way up.
            </p>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              That’s the kind of setup this pack is built to surface.
            </p>
          </div>
          <div className="indicators-hero-frame relative overflow-hidden">
            <Image
              src="/indicators-hero.png"
              alt="$TON rally with aggregated bid depth supporting price"
              width={1168}
              height={784}
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
        <p className="text-[11px] font-bold tracking-[0.18em] text-[#7dffb3] uppercase">
          Get the pack
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight sm:text-4xl">
          Indicators. Video. Templates. Done.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">
          One payment. Download the .zip, watch the setup video, import the
          aggr.trade templates I trust daily — then see you in the books.
        </p>
        <button
          type="button"
          onClick={checkout}
          disabled={pending}
          className="indicators-cta mt-10 inline-flex rounded-2xl px-7 py-3.5 text-sm font-bold text-[#04140c] transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Opening Stripe…" : `Buy · ${price} one-time`}
        </button>
        <p className="mt-6 text-xs text-white/40">
          <a
            href={INDICATORS_SITE.articleUrl}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-white/70 hover:underline"
          >
            {INDICATORS_SITE.articleTitle}
          </a>
          {" · "}
          <a
            href={INDICATORS_SITE.aggrTradeUrl}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-white/70 hover:underline"
          >
            aggr.trade
          </a>
          {" · "}
          <a
            href={INDICATORS_SITE.circleUrl}
            className="underline-offset-2 hover:text-white/70 hover:underline"
          >
            The Circle
          </a>
        </p>
      </section>
    </main>
  );
}
