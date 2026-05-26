"use client";

import {
  ArrowUpRight,
  Binary,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  type OutcomeMarket,
  getHip4MarketPath,
} from "~/lib/blink/hip4/markets";

function formatProbability(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function formatMid(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(4);
}

function formatPeriod(value: string | null) {
  if (!value) return "Recurring";
  if (value === "1d") return "Daily";
  if (value === "1h") return "Hourly";
  if (value === "15m") return "15 min";
  return value;
}

export function OutcomesDiscovery(props: { markets: OutcomeMarket[] }) {
  const [query, setQuery] = useState("");
  const [selectedUnderlying, setSelectedUnderlying] = useState<string>("all");
  const [activeMarketIndex, setActiveMarketIndex] = useState(0);

  const underlyings = useMemo(
    () =>
      Array.from(
        new Set(
          props.markets
            .map((market) => market.underlying?.toUpperCase())
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [props.markets],
  );

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return props.markets.filter((market) => {
      const matchesUnderlying =
        selectedUnderlying === "all" ||
        market.underlying?.toUpperCase() === selectedUnderlying;

      if (!matchesUnderlying) return false;
      if (!normalizedQuery) return true;

      const searchableText = [
        market.title,
        market.subtitle,
        market.name,
        market.underlying,
        market.period,
        market.targetPrice !== null ? String(market.targetPrice) : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [props.markets, query, selectedUnderlying]);

  useEffect(() => {
    if (props.markets.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveMarketIndex((currentIndex) =>
        currentIndex >= props.markets.length - 1 ? 0 : currentIndex + 1,
      );
    }, 5000);

    return () => window.clearInterval(timer);
  }, [props.markets]);

  useEffect(() => {
    if (activeMarketIndex < props.markets.length) return;
    setActiveMarketIndex(0);
  }, [activeMarketIndex, props.markets.length]);

  const featuredMarket = props.markets[activeMarketIndex] ?? null;

  return (
    <main className="min-h-screen bg-[#060510] px-4 py-8 text-[#f4f7fb] sm:px-6 lg:px-8">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 22%, rgba(56,189,248,0.22), transparent 18%), radial-gradient(circle at 50% 36%, rgba(59,130,246,0.14), transparent 28%), radial-gradient(circle at 18% 18%, rgba(56,189,248,0.12), transparent 28%), radial-gradient(circle at 82% 16%, rgba(96,165,250,0.09), transparent 24%), radial-gradient(circle at 50% 75%, rgba(14,165,233,0.06), transparent 30%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <section className="flex min-h-[72vh] flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/20 bg-[#38bdf8]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#9bddff]">
            <Binary className="size-3.5" />
            HIP-4 Outcomes
          </div>

          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.06em] text-white sm:text-6xl">
            Search the tiny but very real world of onchain outcome markets.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
            Blink should treat HIP-4 like a new product, not a perp side panel.
            Search a market, jump into the live contracts, and let the interface
            breathe while the category is still small.
          </p>

          <div className="relative mt-10 w-full max-w-3xl">
            <div className="pointer-events-none absolute inset-x-12 -top-10 h-28 rounded-full bg-[#38bdf8]/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[30px] border border-[#8ddcff33] bg-[linear-gradient(180deg,rgba(10,20,36,0.88),rgba(6,12,24,0.96))] p-3 shadow-[0_30px_120px_rgba(7,14,30,0.65)]">
              <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-4">
                <Search className="size-5 shrink-0 text-[#8ad9ff]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search BTC daily, 77363, hourly ETH..."
                  className="h-8 w-full bg-transparent text-base text-white outline-none placeholder:text-white/32 sm:text-lg"
                />
                <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/42 sm:inline-flex">
                  {filteredMarkets.length} live
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedUnderlying("all")}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                selectedUnderlying === "all"
                  ? "border-[#7fd6ff66] bg-[#38bdf8]/12 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white/78"
              }`}
            >
              All markets
            </button>
            {underlyings.map((underlying) => (
              <button
                key={underlying}
                type="button"
                onClick={() => setSelectedUnderlying(underlying)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  selectedUnderlying === underlying
                    ? "border-[#7fd6ff66] bg-[#38bdf8]/12 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white/78"
                }`}
              >
                {underlying}
              </button>
            ))}
          </div>

          {featuredMarket ? (
            <div className="mt-8 w-full max-w-5xl">
              <div className="relative overflow-hidden rounded-[32px] border border-[#7fd6ff24] bg-[linear-gradient(180deg,rgba(12,22,39,0.94),rgba(7,12,24,0.98))] p-5 shadow-[0_26px_100px_rgba(0,0,0,0.45)] sm:p-6">
                <div className="pointer-events-none absolute inset-x-20 top-0 h-24 rounded-full bg-[#38bdf8]/10 blur-3xl" />

                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9bddff]">
                      Live carousel
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-white sm:text-3xl">
                      {featuredMarket.title}
                    </h2>
                    <p className="mt-2 text-sm text-white/56">
                      {featuredMarket.subtitle}
                    </p>
                    <Link
                      href={getHip4MarketPath(featuredMarket.slug)}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#9bddff] transition hover:text-white"
                    >
                      Open trading screen
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMarketIndex((currentIndex) =>
                          currentIndex <= 0
                            ? props.markets.length - 1
                            : currentIndex - 1,
                        )
                      }
                      className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                      aria-label="Previous live HIP-4 market"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMarketIndex((currentIndex) =>
                          currentIndex >= props.markets.length - 1
                            ? 0
                            : currentIndex + 1,
                        )
                      }
                      className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                      aria-label="Next live HIP-4 market"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="relative mt-6 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                  <div className="group rounded-[28px] border border-[#7fd6ff22] bg-[linear-gradient(180deg,rgba(56,189,248,0.10),rgba(8,15,24,0.28))] p-5 text-left transition hover:border-[#7fd6ff44] hover:bg-[linear-gradient(180deg,rgba(56,189,248,0.13),rgba(8,15,24,0.34))]">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#9bddff]">
                      <span>{formatPeriod(featuredMarket.period)}</span>
                      <span className="text-white/20">•</span>
                      <span>{featuredMarket.underlying ?? "Outcome"}</span>
                      <span className="text-white/20">•</span>
                      <span>#{featuredMarket.outcome}</span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-[#08101d80] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                          Target
                        </p>
                        <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                          {featuredMarket.targetPrice ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-[#08101d80] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                          Yes
                        </p>
                        <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-emerald-300">
                          {formatProbability(featuredMarket.yes.probabilityPct)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-[#08101d80] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                          No
                        </p>
                        <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-rose-300">
                          {formatProbability(featuredMarket.no.probabilityPct)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Link
                        href={getHip4MarketPath(featuredMarket.slug)}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[#9bddff] transition hover:text-white"
                      >
                        Trade this market
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(featuredMarket.title);
                          setSelectedUnderlying(
                            featuredMarket.underlying?.toUpperCase() ?? "all",
                          );
                        }}
                        className="inline-flex items-center gap-2 text-sm font-medium text-white/58 transition hover:text-white"
                      >
                        Filter search to this market
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {props.markets.map((market, index) => {
                      const isActive = index === activeMarketIndex;

                      return (
                        <button
                          key={market.slug}
                          type="button"
                          onClick={() => setActiveMarketIndex(index)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            isActive
                              ? "border-[#7fd6ff44] bg-[#38bdf8]/10 shadow-[0_18px_45px_rgba(56,189,248,0.10)]"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#9bddff]">
                                {market.underlying ?? "Outcome"}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-white">
                                {market.title}
                              </p>
                            </div>
                            <span className="text-xs text-white/38">
                              {formatPeriod(market.period)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="relative mt-5 flex items-center justify-center gap-2">
                  {props.markets.map((market, index) => (
                    <button
                      key={market.slug}
                      type="button"
                      onClick={() => setActiveMarketIndex(index)}
                      className={`h-2 rounded-full transition ${
                        index === activeMarketIndex
                          ? "w-8 bg-[#8ad9ff]"
                          : "w-2 bg-white/20 hover:bg-white/35"
                      }`}
                      aria-label={`View ${market.title}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-white/46">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
              <Sparkles className="size-4 text-[#8ad9ff]" />
              Discovery-first UX
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
              Few markets, high signal
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
              Binary recurring contracts first
            </span>
          </div>
        </section>

        <section className="pb-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9bddff]">
                Search results
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                Active HIP-4 binary markets
              </h2>
            </div>
            <Link
              href="/trade/BTC"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#9bddff] transition hover:text-white"
            >
              Open perp terminal
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          {filteredMarkets.length === 0 ? (
            <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
              <p className="text-lg font-medium text-white">
                No markets match that search yet.
              </p>
              <p className="mt-2 text-sm text-white/55">
                Try an underlying like BTC, a target price, or clear the filter.
              </p>
            </div>
          ) : (
            <div className="mx-auto grid max-w-4xl gap-5">
              {filteredMarkets.map((market) => (
                <article
                  key={market.slug}
                  className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#9bddff]">
                        <span>{formatPeriod(market.period)}</span>
                        <span className="text-white/24">•</span>
                        <span>{market.marketClass ?? "Outcome"}</span>
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                        {market.title}
                      </h3>
                      <p className="mt-2 text-sm text-white/58">
                        {market.subtitle}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/52">
                      #{market.outcome}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
                    <div className="rounded-2xl border border-[#7fd6ff24] bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(10,15,24,0.25))] px-4 py-4">
                      <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/38">
                        <Target className="size-3" />
                        Target
                      </p>
                      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                        {market.targetPrice ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4">
                      <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/38">
                        <Clock3 className="size-3" />
                        Expiry
                      </p>
                      <p className="mt-3 text-sm font-semibold text-white">
                        {market.expiryLabel ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/38">
                        Underlying
                      </p>
                      <p className="mt-3 text-sm font-semibold text-white">
                        {market.underlying ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {[market.yes, market.no].map((side) => (
                      <div
                        key={side.tradeCoin}
                        className="rounded-2xl border border-white/10 bg-[#020817]/45 px-4 py-5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">
                            {side.name}
                          </p>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/45">
                            {side.tradeCoin}
                          </span>
                        </div>
                        <p className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white">
                          {formatProbability(side.probabilityPct)}
                        </p>
                        <p className="mt-2 text-sm text-white/52">
                          Mid price {formatMid(side.mid)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5">
                    <Link
                      href={getHip4MarketPath(market.slug)}
                      className="inline-flex items-center gap-2 text-sm font-medium text-[#9bddff] transition hover:text-white"
                    >
                      Open trading screen
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
