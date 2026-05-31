"use client";

import { type ReactNode, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Megaphone, Twitter } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";

import { BlinkSlotFigure } from "~/components/blink/blink-slot-figure";
import { AssetIcon } from "~/components/blink/asset-icon";
import { resolvePerpMarket } from "~/lib/blink/hyperliquid";
import {
  formatCompactNumber,
  formatUsd,
  marketToSlug,
} from "~/lib/blink/markets";

// ─── Shill popover ─────────────────────────────────────────────────────────────

function ShillButton({
  market,
  price,
  changePct,
}: {
  market: string;
  price: number;
  changePct: number;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const positive = changePct >= 0;
  const changeStr = `${positive ? "+" : ""}${changePct.toFixed(2)}%`;
  const priceStr = price > 0 ? formatUsd(price) : "—";

  const shillText = `$${market} ${changeStr} 24h — trading on blink with 0 fees 🔥\n\nblink.lat/trade/${marketToSlug(market)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shillText)}`;

  function handleCopy() {
    void navigator.clipboard.writeText(shillText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-[#a78bfa55] hover:bg-[#a78bfa12] hover:text-[#c4b5fd]"
        >
          <Megaphone className="size-3.5" />
          Shill
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[300px] overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#080d1ad4] p-0 shadow-[0_16px_56px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="border-b border-white/[0.07] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-white">${market}</span>
              <span className="font-mono text-sm text-white/55">
                {priceStr}
              </span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                positive
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-rose-400/15 text-rose-300"
              }`}
            >
              {changeStr}
            </span>
          </div>
        </div>

        {/* Tweet preview */}
        <div className="px-4 py-3">
          <p className="whitespace-pre-line rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-white/75">
            {shillText}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-white/[0.09] bg-white/[0.04] py-2 text-xs font-semibold text-white/65 transition hover:bg-white/[0.09] hover:text-white"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> Copy
              </>
            )}
          </button>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-black py-2 text-xs font-semibold text-white transition hover:bg-black/80"
          >
            <Twitter className="size-3.5" />
            Post on X
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type MarketCtx = {
  markPx: number;
  prevDayPx: number;
  oraclePx: number;
  dayNtlVlm: number;
  openInterest: number;
  funding: number; // hourly funding rate
};

function formatFunding(hourly: number) {
  const annualized = hourly * 24 * 365 * 100;
  const sign = annualized >= 0 ? "+" : "";
  return `${sign}${annualized.toFixed(2)}% APR`;
}

function formatHourlyFunding(hourly: number) {
  const sign = hourly >= 0 ? "+" : "";
  return `${sign}${(hourly * 100).toFixed(4)}%/hr`;
}

export function MarketInfoBar(props: {
  market: string;
  rightSlot?: ReactNode;
  hideBalances?: boolean;
}) {
  const ctxQuery = useQuery({
    queryKey: ["blink", "market-ctx", props.market],
    queryFn: async (): Promise<MarketCtx | null> => {
      const market = await resolvePerpMarket(props.market);
      const ctx = market.assetCtx;
      if (!ctx) return null;
      return {
        dayNtlVlm: Number(ctx.dayNtlVlm ?? 0),
        funding: Number(ctx.funding ?? 0),
        markPx: Number(ctx.markPx ?? 0),
        openInterest: Number(ctx.openInterest ?? 0),
        oraclePx: Number(ctx.oraclePx ?? 0),
        prevDayPx: Number(ctx.prevDayPx ?? 0),
      };
    },
    staleTime: 2_000,
    refetchInterval: 3_000,
  });

  const ctx = ctxQuery.data;
  const displayPrice = ctx?.markPx ?? 0;
  const changePct =
    ctx && ctx.prevDayPx > 0
      ? ((ctx.markPx - ctx.prevDayPx) / ctx.prevDayPx) * 100
      : 0;
  const positive = changePct >= 0;

  const stats = [
    {
      label: "24h Change",
      value: ctx ? `${positive ? "+" : ""}${changePct.toFixed(2)}%` : "—",
      color: ctx
        ? positive
          ? "text-emerald-300"
          : "text-rose-300"
        : "text-foreground/45",
    },
    {
      label: "24h Volume",
      value: ctx ? `$${formatCompactNumber(ctx.dayNtlVlm)}` : "—",
      color: "text-foreground/72",
    },
    {
      label: "Open Interest",
      value: ctx ? `$${formatCompactNumber(ctx.openInterest)}` : "—",
      color: "text-foreground/72",
    },
    {
      label: "Funding",
      value: ctx ? formatHourlyFunding(ctx.funding) : "—",
      title: ctx ? formatFunding(ctx.funding) : undefined,
      color:
        ctx && ctx.funding >= 0 ? "text-emerald-300/80" : "text-rose-300/80",
    },
    {
      label: "Oracle",
      value: ctx ? formatUsd(ctx.oraclePx) : "—",
      color: "text-foreground/55",
    },
  ];

  return (
    <div className="glass-panel flex items-center gap-6 overflow-x-auto px-5 py-3">
      {/* Coin + live price */}
      <div className="flex shrink-0 items-center gap-2">
        <AssetIcon asset={props.market} size={22} />
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/45">
            {props.market}
          </span>
          <BlinkSlotFigure
            value={displayPrice}
            format={formatUsd}
            hidden={props.hideBalances}
            inactive={displayPrice <= 0}
            fallback={ctxQuery.isLoading ? "Loading…" : "—"}
            debounceMs={120}
            className="text-xl font-semibold text-white"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-6 w-px shrink-0 bg-white/8" />

      {/* Stats strip */}
      <div className="flex items-center gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="shrink-0" title={stat.title}>
            <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">
              {stat.label}
            </p>
            <p
              className={`mt-0.5 font-mono text-sm tabular-nums ${stat.color}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Shill button — always visible, uses live price from this component */}
      <div className="ml-auto shrink-0">
        <ShillButton
          market={props.market}
          price={displayPrice}
          changePct={changePct}
        />
      </div>

      {props.rightSlot ? (
        <div className="shrink-0">{props.rightSlot}</div>
      ) : null}
    </div>
  );
}
