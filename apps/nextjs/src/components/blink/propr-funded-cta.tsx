"use client";

import { ArrowUpRight, BadgeCheck, Banknote, Sparkles } from "lucide-react";
import { motion } from "motion/react";

import {
  PROPR_BADGE,
  PROPR_FOUNDER_TWEET_URL,
  PROPR_HEADLINE,
  PROPR_SUBCOPY,
  PROPR_TAGLINE,
  proprAffiliateUrl,
} from "~/lib/blink/propr";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function ProprFundedCta(props: {
  variant?: "card" | "compact" | "footer";
  className?: string;
  source?: string;
}) {
  const variant = props.variant ?? "card";
  const href = proprAffiliateUrl(props.source);

  if (variant === "footer") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 text-[#ffd166] transition hover:text-[#ffe9a8]",
          props.className,
        )}
      >
        <Banknote className="size-3.5" />
        Get funded · Propr
        <ArrowUpRight className="size-3" />
      </a>
    );
  }

  if (variant === "compact") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "group flex items-start gap-3 rounded-2xl border border-[#ffd166]/25 bg-[linear-gradient(135deg,rgba(255,209,102,0.12),rgba(44,107,255,0.08))] px-4 py-3.5 transition hover:border-[#ffd166]/45 hover:bg-[linear-gradient(135deg,rgba(255,209,102,0.16),rgba(44,107,255,0.12))]",
          props.className,
        )}
      >
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#ffd166]/15 text-[#ffd166] shadow-[0_0_20px_rgba(255,209,102,0.15)]">
          <Banknote className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {PROPR_HEADLINE}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#ffd166]/30 bg-[#ffd166]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#ffe9a8]">
              <BadgeCheck className="size-2.5" />
              {PROPR_BADGE}
            </span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-white/50">
            {PROPR_SUBCOPY}
          </span>
        </span>
        <ArrowUpRight className="mt-1 size-4 shrink-0 text-[#ffd166]/70 transition group-hover:text-[#ffd166]" />
      </a>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn("relative", props.className)}
    >
      <div className="pointer-events-none absolute -inset-2 rounded-[24px] bg-[radial-gradient(circle,rgba(255,209,102,0.22),transparent_70%)] blur-xl" />
      <div className="pointer-events-none absolute -inset-px rounded-[22px] border border-[#ffd166]/30 shadow-[0_0_32px_4px_rgba(255,209,102,0.12)]" />

      <div className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(18,14,8,0.96),rgba(10,12,24,0.98))] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,209,102,0.14),transparent_55%)]" />

        <div className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd166]/30 bg-[#ffd166]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffe9a8]">
              <Sparkles className="size-3" />
              Funded accounts
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#3be1ba]/25 bg-[#3be1ba]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8ef5dc]">
              <BadgeCheck className="size-3" />
              {PROPR_BADGE}
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-[-0.03em] text-white sm:text-2xl">
            {PROPR_HEADLINE}
          </h2>
          <p className="mt-1 text-sm font-medium text-[#ffd166]/90">
            {PROPR_TAGLINE}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/50">
            {PROPR_SUBCOPY} Perfect if you want more size without depositing your
            own stack.
          </p>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-[#ffd166]/35 bg-[linear-gradient(180deg,#ffd166_0%,#e6a800_100%)] px-5 text-sm font-bold tracking-[-0.02em] text-[#1a1200] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_16px_40px_rgba(255,209,102,0.28)] transition hover:brightness-110"
            >
              Start Propr challenge
              <ArrowUpRight className="size-4" />
            </a>
            <a
              href={PROPR_FOUNDER_TWEET_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-xs font-medium text-white/55 transition hover:border-white/20 hover:text-white/80"
            >
              Why rokit recommends it
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
