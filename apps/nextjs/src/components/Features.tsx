import { Users, CalendarCheck, MessagesSquare, BookOpenCheck } from 'lucide-react';

const features = [
  {
    icon: Users,
    title: '1-on-1 mentorship',
    desc: 'Personalized guidance built around your schedule and goals — no fluff, just the real system installed step by step.',
  },
  {
    icon: CalendarCheck,
    title: 'Weekly check-in calls',
    desc: 'Regular accountability calls to review your trades, tighten your execution, and keep your progress on track.',
  },
  {
    icon: MessagesSquare,
    title: 'Private Discord desk',
    desc: 'Direct access to Chase and the inner circle. Get real-time trade feedback and community support.',
  },
  {
    icon: BookOpenCheck,
    title: 'Resources & trade breakdowns',
    desc: 'Full access to trade breakdowns, playbooks, and a growing library of reference material.',
  },
];

export default function Features() {
  return (
    <section id="inside" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal mx-auto max-w-2xl text-center">
          <span className="text-xs font-600 uppercase tracking-[0.2em] text-accent-400">
            The program
          </span>
          <h2 className="mt-3 font-display text-3xl font-800 tracking-tight text-white sm:text-4xl lg:text-5xl">
            What happens inside the mentorship.
          </h2>
          <p className="mt-4 text-base text-ink-300">
            Four pillars that take you from wherever you are now to a working, repeatable process.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="card-glow reveal group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-ink-800/60"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500/20 to-accent-600/10 text-accent-400 ring-1 ring-accent-500/20 transition-transform group-hover:scale-110">
                <f.icon className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <h3 className="font-display text-lg font-700 text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{f.desc}</p>
              <span className="mt-5 block text-xs font-600 text-ink-500">
                0{i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
