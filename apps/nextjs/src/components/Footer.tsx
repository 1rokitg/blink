import { TrendingUp } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-ink-950">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600">
                <TrendingUp
                  className="h-5 w-5 text-ink-950"
                  strokeWidth={2.5}
                />
              </span>
              <span className="font-display text-lg font-700 tracking-tight text-white">
                Social<span className="text-accent-400"> Capital</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-400">
              Private crypto trading mentorship. Capped intake, by application
              only.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-600 uppercase tracking-wider text-ink-300">
              Navigate
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                { label: "Inside the program", href: "#inside" },
                { label: "Your mentor", href: "#mentor" },
                { label: "What you get", href: "#included" },
                { label: "Apply", href: "#apply" },
              ].map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-ink-400 transition-colors hover:text-white"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-600 uppercase tracking-wider text-ink-300">
              Risk notice
            </h4>
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              Trading involves substantial risk of loss. Social Capital provides
              education only and does not offer financial advice, managed
              accounts, or performance guarantees. Trading digital assets
              carries a high level of risk and past results do not guarantee
              future outcomes.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-7 sm:flex-row">
          <p className="text-xs text-ink-500">
            © 2026 Social Capital. All rights reserved.
          </p>
          <p className="text-xs text-ink-500">
            Educational content only. Nothing on this site constitutes
            financial, investment, or tax advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
