import { Quote, BadgeCheck } from "lucide-react";

export default function About() {
  return (
    <section id="mentor" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-accent-500/[0.06] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Portrait */}
          <div className="reveal relative mx-auto max-w-md lg:mx-0">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40">
              <img
                src="./pfp.jpg"
                alt="RokitG, founder of Social Capital"
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-accent-400" />
                  <span className="font-display text-lg font-700 text-white">
                    RokitG
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-ink-300">
                  Founder, Social Capital
                </p>
              </div>
            </div>
            {/* Floating stat card */}
            <div className="absolute -right-4 top-8 hidden rounded-2xl border border-white/10 bg-ink-900/90 px-5 py-4 shadow-xl backdrop-blur-md sm:block">
              <p className="font-display text-2xl font-800 text-gradient-gold">
                Live daily
              </p>
              <p className="text-xs text-ink-300">Trades in public</p>
            </div>
          </div>

          {/* Bio */}
          <div className="reveal">
            <span className="text-xs font-600 uppercase tracking-[0.2em] text-accent-400">
              Your mentor
            </span>
            <h2 className="mt-3 font-display text-3xl font-800 tracking-tight text-white sm:text-4xl lg:text-5xl">
              Meet RokitG.
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-200">
              <p>
                RokitG is the founder and leader behind the Social Capital
                trading group, built for traders who want to learn in public and
                put a repeatable process behind their decisions.
              </p>
              <p>
                He is known online for trading live every day and bringing
                members into the process as markets move — from reading momentum
                and finding opportunity to managing risk when the trade does not
                go to plan.
              </p>
              <p>
                Inside the group, the focus is practical: real-time market
                perspective, transparent trade breakdowns, and a closer look at
                how a working trader makes decisions. No vague calls or
                black-box promises — just a direct view into the work behind the
                trade.
              </p>
            </div>

            <figure className="mt-8 rounded-2xl border border-white/[0.07] bg-ink-900/50 p-6">
              <Quote className="h-6 w-6 text-accent-400/60" />
              <blockquote className="mt-3 font-display text-lg font-600 leading-snug text-white">
                “No vague calls or black-box promises — just a direct view into
                the work behind the trade.”
              </blockquote>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
