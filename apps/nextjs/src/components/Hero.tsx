"use client";

import { useState } from "react";
import { Play, ArrowRight, ShieldCheck, Star } from "lucide-react";

const tickerItems = [
  { pair: "BTC/USDT", pnl: "+$28,740", dir: "up" },
  { pair: "ETH/USDT", pnl: "+$12,310", dir: "up" },
  { pair: "SOL/USDT", pnl: "+$8,920", dir: "up" },
  { pair: "MTFR", pnl: "+$28,700", dir: "up" },
  { pair: "OSOR", pnl: "+$34,300", dir: "up" },
  { pair: "Jan PNL", pnl: "+$546K", dir: "up" },
  { pair: "Jul PNL", pnl: "+$160K", dir: "up" },
];

export default function Hero() {
  const [track, setTrack] = useState<string>("new");

  return (
    <section
      id="top"
      className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28"
    >
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-faint [background-size:64px_64px] opacity-60" />
        <div className="absolute left-1/2 top-0 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-accent-500/10 blur-[140px]" />
        <div className="absolute right-0 top-40 h-[420px] w-[420px] rounded-full bg-gold-500/5 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-950" />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Eyebrow */}
        <div className="reveal mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-500 text-ink-200">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400" />
          </span>
          Capped intake — by application only
        </div>

        {/* Headline */}
        <h1 className="reveal mx-auto max-w-4xl text-center font-display text-4xl font-800 leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
          The last crypto terminal you'll{" "}
          <span className="text-gradient">ever</span> use.
        </h1>

        <p className="reveal mx-auto mt-7 max-w-2xl text-center text-base leading-relaxed text-ink-300 sm:text-lg">
          We've joined the best from both worlds.
        </p>

        {/* Video placeholder */}
        <div
          className="reveal mx-auto mt-12 max-w-3xl"
          onClick={() =>
            window.open(
              "https://whop.com/rokitg/exp_WvNuGuiGDJd0Ig/app/",
              "_blank",
            )
          }
        >
          <div className="group relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl shadow-black/40">
            <img
              src="./thumbnail.png"
              alt="Live crypto trading chart"
              className="h-full w-full object-cover opacity-50 transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" />
            <button
              className="absolute inset-0 flex items-center justify-center"
              aria-label="Play intro video"
            >
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:bg-accent-500">
                <span className="absolute -inset-2 animate-ping rounded-full bg-white/10 opacity-60" />
                <Play className="relative h-8 w-8 translate-x-0.5 fill-white text-white" />
              </span>
            </button>
            <div className="absolute bottom-4 left-5 flex items-center gap-2 text-sm font-500 text-ink-200">
              <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-700 uppercase tracking-wider text-white">
                Live
              </span>
              Watch this short video before applying
            </div>
          </div>
        </div>

        {/* Track selector */}
        <div className="reveal mx-auto mt-16 max-w-4xl">
          <h2 className="mb-2 text-center font-display text-xl font-700 text-white sm:text-2xl">
            Which best describes you?
          </h2>
          <p className="mb-7 text-center text-sm text-ink-300">
            Pick the closest match — this sets your track.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRACKS.map((t) => {
              const active = track === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTrack(t.id)}
                  className={`card-glow group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                    active
                      ? "border-accent-400/60 bg-accent-500/[0.08] shadow-lg shadow-accent-500/10"
                      : "border-white/[0.07] bg-ink-900/50 hover:border-white/15 hover:bg-ink-800/60"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                        active
                          ? "bg-accent-500 text-ink-950"
                          : "bg-white/5 text-accent-400"
                      }`}
                    >
                      <t.icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    {active && (
                      <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wider text-accent-300">
                        Selected
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-base font-700 text-white">
                    {t.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-300">
                    {t.desc}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-center gap-4">
            <a
              href="/trade/BTC/USDT"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-accent-500 px-7 py-3.5 text-sm font-600 text-ink-950 shadow-xl shadow-accent-500/25 transition-all hover:bg-accent-400 hover:shadow-accent-400/30"
            >
              Launch Terminal
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <div className="flex items-center gap-5 text-xs text-ink-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-accent-400" />{" "}
                Education only
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-gold-400" /> Reviewed within 2
                business days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div className="reveal mt-16 border-y border-white/[0.06] bg-ink-900/40 py-4">
        <div className="mask-fade-x overflow-hidden">
          <div className="flex w-max animate-ticker gap-10">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <span className="font-500 text-ink-300">{item.pair}</span>
                <span className="font-600 text-accent-400">{item.pnl}</span>
                <span className="text-ink-600">•</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { Briefcase, Clock, Rocket, Sprout } from "lucide-react";

const TRACKS = [
  {
    id: "new",
    title: "New to crypto",
    desc: "Starting from zero. Want a clear, repeatable process.",
    icon: Sprout,
  },
  {
    id: "part-time",
    title: "Part-time trader",
    desc: "Have a job. Want to compound without quitting.",
    icon: Clock,
  },
  {
    id: "full-time",
    title: "Full-time trader",
    desc: "Trading now but results are inconsistent.",
    icon: Briefcase,
  },
  {
    id: "scaling",
    title: "Scaling up",
    desc: "Already profitable. Want tighter risk and size.",
    icon: Rocket,
  },
];
