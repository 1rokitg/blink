
const results = [
  {
    src: "https://images.pexels.com/photos/38375328/pexels-photo-38375328.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    alt: "Monthly PNL calendar showing +$546K in January",
  },
  {
    src: "https://images.pexels.com/photos/38375327/pexels-photo-38375327.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    alt: "Monthly PNL calendar showing +$160K in July",
  },
  {
    src: "https://images.pexels.com/photos/30268013/pexels-photo-30268013.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    alt: "MTFR trade result +$28.7K",
  },
  {
    src: "https://images.pexels.com/photos/38375326/pexels-photo-38375326.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    alt: "OSOR trade result +$34.3K",
  },
];

const programFeatures = [
  {
    icon: "👤",
    title: "1-on-1 mentorship",
    desc: "Personalized guidance built around your schedule and goals — no fluff, just the real system installed step by step.",
  },
  {
    icon: "📞",
    title: "Weekly check-in calls",
    desc: "Regular accountability calls to review your trades, tighten your execution, and keep your progress on track.",
  },
  {
    icon: "💬",
    title: "Private Discord desk",
    desc: "Direct access to Chase and the inner circle. Get real-time trade feedback and community support.",
  },
  {
    icon: "📊",
    title: "Resources & trade breakdowns",
    desc: "Full access to trade breakdowns, playbooks, and a growing library of reference material.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090b] text-[#fafafa]">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#09090b]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg text-amber-400">✦</span>
            <span className="font-sans text-[0.95rem] font-extrabold tracking-[0.1em]">
              ASTRA CAPITAL
            </span>
          </div>

          <a
            href="#apply"
            className="border border-amber-400 bg-amber-400/10 px-5 py-2 text-sm font-semibold text-amber-400 transition hover:bg-amber-400 hover:text-black"
          >
            Apply Now
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/[0.08] px-0 py-16 sm:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:url(&quot;data:image/svg+xml,%3Csvg_viewBox='0_0_256_256'_xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter_id='noise'%3E%3CfeTurbulence_type='fractalNoise'_baseFrequency='0.9'_numOctaves='4'_stitchTiles='stitch'/%3E%3C/filter%3E%3Crect_width='100%25'_height='100%25'_filter='url(%23noise)'_opacity='0.03'/%3E%3C/svg%3E&quot;)]" />

        <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.08)_0%,transparent_70%)]" />

        <div className="relative mx-auto flex max-w-[1120px] flex-col items-center px-4 text-center sm:px-6">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-xs text-white/60">
            <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-emerald-400" />
            For traders who want real, repeatable results in crypto
          </div>

          <h1 className="mb-6 max-w-[820px] font-sans text-[clamp(2.2rem,5.5vw,4rem)] font-extrabold leading-[1.1] tracking-tight">
            Learn the crypto system our members use to make{" "}
            <em className="not-italic text-amber-400">
              5 figures per month
            </em>{" "}
            in under 5 hours a week.
          </h1>

          <p className="mb-8 text-base text-white/50">
            Watch this short video before applying
          </p>

          <div className="w-full max-w-[720px]">
            <div className="aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] transition hover:border-amber-400">
              <iframe
                className="block h-full w-full border-0"
                src="https://www.youtube.com/embed/hykPqtHMerE?rel=0"
                title="Astra Capital trading overview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* APPLICATION */}
      <section
        id="apply"
        className="bg-gradient-to-b from-[#09090b] to-[#111113] px-4 py-20 sm:px-6"
      >
        <div className="mx-auto max-w-[680px]">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-400">
            Apply for Astra Capital
          </div>

          <h2 className="max-w-[640px] font-sans text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.15] tracking-tight">
            Private 1 on 1 mentorship that installs the exact entries, risk
            rules and exits, so you can compound while keeping your job.
            Capped intake, by application.
          </h2>

        </div>
      </section>

      {/* PROOF LABEL */}
      <div className="border-y border-white/[0.08] bg-[#111113] py-6">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
          <span className="text-sm font-bold uppercase tracking-[0.15em] text-white/30">
            Real members, real results
          </span>
        </div>
      </div>

      {/* RESULTS */}
      <section className="bg-[#111113] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {results.map((result) => (
              <div
                key={result.src}
                className="group relative aspect-video overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04]"
              >
                <img
                  src={result.src}
                  alt={result.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />

                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="text-xs text-white/60">
                    {result.alt}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="mx-auto max-w-[560px] text-center text-xs leading-relaxed text-white/30">
            Trading involves substantial risk of loss. Astra Capital provides
            education only and does not offer financial advice, managed
            accounts or performance guarantees.
          </p>
        </div>
      </section>

      {/* PROGRAM */}
      <section className="bg-[#09090b] px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-[1120px] text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-400">
            The program
          </div>

          <h2 className="mx-auto max-w-[640px] font-sans text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.15] tracking-tight">
            What happens inside the mentorship.
          </h2>

          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
            {programFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-8 text-left transition hover:-translate-y-0.5 hover:border-amber-400"
              >
                <div className="mb-4 text-3xl">{feature.icon}</div>

                <h3 className="mb-2 font-sans text-[1.1rem] font-bold">
                  {feature.title}
                </h3>

                <p className="text-sm leading-relaxed text-white/50">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOUNDER */}
      <section className="border-y border-white/[0.08] bg-[#111113] px-4 py-24 sm:px-6">
        <div className="mx-auto grid max-w-[1120px] items-center gap-10 md:grid-cols-[420px_1fr] md:gap-[72px]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl md:aspect-[3/4] md:max-w-none">
            <img
              src="/images/pfp2026.jpg"
              alt="RokitG, founder of the Astra Capital group"
              loading="lazy"
              className="h-full w-full object-cover"
            />

            <div className="absolute bottom-5 left-5 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-black">
              Founder & Group Leader
            </div>
          </div>

          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-400">
              About the founder
            </div>

            <h2 className="mb-6 font-sans text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.15]">
              Meet RokitG.
            </h2>

            <div className="space-y-4 text-base leading-[1.75] text-white/50">
              <p>
                RokitG is the founder and leader behind the Astra Capital
                trading group, built for traders who want to learn in public
                and put a repeatable process behind their decisions.
              </p>

              <p>
                He is known online for trading live every day and bringing
                members into the process as markets move — from reading
                momentum and finding opportunity to managing risk when the
                trade does not go to plan.
              </p>

              <p>
                Inside the group, the focus is practical: real-time market
                perspective, transparent trade breakdowns, and a closer look
                at how a working trader makes decisions. No vague calls or
                black-box promises — just a direct view into the work behind
                the trade.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#09090b] px-4 py-24 text-center sm:px-6">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-400">
            The program
          </div>

          <h2 className="font-sans text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.15]">
            What you get inside the mentorship.
          </h2>

          <p className="mt-4 mb-10 max-w-[520px] text-base leading-relaxed text-white/50">
            Intake is limited and reviewed by application. Investment and terms
            are discussed directly on your call, once we know your situation.
          </p>

          <div className="mb-10 grid w-full max-w-[520px] grid-cols-1 gap-3 text-left sm:grid-cols-2 sm:gap-x-12">
            {programFeatures.map((feature) => (
              <div
                key={feature.title}
                className="flex items-center gap-2.5 text-[0.95rem]"
              >
                <span className="text-emerald-400">✓</span>
                <span>{feature.title}</span>
              </div>
            ))}
          </div>

          <p className="mb-8 text-xs text-white/30">
            Applications are reviewed manually. Expect a response within two
            business days.
          </p>

          <a
            href="#apply"
            className="inline-flex items-center justify-center bg-amber-400 px-10 py-4 text-base font-semibold text-black transition hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_8px_24px_rgba(245,158,11,0.35)]"
          >
            Apply for Mentorship
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.08] bg-[#111113] px-4 py-12 text-center sm:px-6">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-lg text-amber-400">✦</span>
            <span className="font-sans text-[0.95rem] font-extrabold tracking-[0.1em]">
              ASTRA CAPITAL
            </span>
          </div>

          <p className="max-w-[560px] text-xs leading-relaxed text-white/30">
            Educational content only. Nothing on this site constitutes
            financial, investment or tax advice. Trading digital assets carries
            a high level of risk and past results do not guarantee future
            outcomes.
          </p>

          <p className="text-xs text-white/30">
            © 2026 Astra Capital. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}