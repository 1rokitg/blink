import Link from "next/link";

import { ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";

type BlinkProUpsellCardProps = {
  ctaHref?: string;
  ctaLabel?: string;
  description: string;
  eyebrow?: string;
  isPro?: boolean;
  perks?: string[];
  title: string;
};

export function BlinkProUpsellCard(props: BlinkProUpsellCardProps) {
  if (props.isPro) {
    return (
      <div className="rounded-[18px] border border-emerald-400/25 bg-[linear-gradient(180deg,rgba(18,47,34,0.92),rgba(9,24,20,0.94))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
          <CheckCircle2 className="size-3.5" />
          Blink Pro Active
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">{props.title}</h3>
        <p className="mt-2 text-sm leading-6 text-white/60">
          {props.description}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border border-[#7ea9ff40] bg-[linear-gradient(180deg,rgba(13,23,48,0.96),rgba(8,15,30,0.98))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#7ea9ff30] bg-[#2c6bff1a] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9fc0ff]">
        <Sparkles className="size-3.5" />
        {props.eyebrow ?? "Blink Pro"}
      </div>

      <h3 className="mt-4 text-lg font-semibold text-white">{props.title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/60">
        {props.description}
      </p>

      {props.perks?.length ? (
        <div className="mt-4 space-y-2">
          {props.perks.map((perk) => (
            <div
              key={perk}
              className="flex items-start gap-2 text-sm text-white/72"
            >
              <span className="mt-1 size-1.5 rounded-full bg-[#6fa8ff]" />
              <span>{perk}</span>
            </div>
          ))}
        </div>
      ) : null}

      {props.ctaHref && props.ctaLabel ? (
        <Link
          href={props.ctaHref}
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#9bddff] transition hover:text-white"
        >
          {props.ctaLabel}
          <ArrowUpRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
