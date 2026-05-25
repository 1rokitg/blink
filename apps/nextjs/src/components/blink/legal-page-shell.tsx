import Link from "next/link";

interface LegalSection {
  bullets?: string[];
  paragraphs: string[];
  title: string;
}

interface LegalPageShellProps {
  description: string;
  sections: LegalSection[];
  title: string;
  updatedAt: string;
}

export function LegalPageShell({
  description,
  sections,
  title,
  updatedAt,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-[#060510] px-4 py-10 text-[#f4f7fb] sm:px-6 lg:px-8">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.14), transparent 28%), radial-gradient(circle at 80% 14%, rgba(96,165,250,0.12), transparent 24%), radial-gradient(circle at 50% 80%, rgba(59,130,246,0.08), transparent 32%)",
        }}
      />

      <div className="relative mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.96),rgba(6,9,18,0.98))] p-7 shadow-[0_28px_100px_rgba(0,0,0,0.45)] sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9bddff]">
              Blink Legal
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              {title}
            </h1>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/58">
            Updated {updatedAt}
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-base leading-7 text-white/68 sm:text-lg">
          {description}
        </p>

        <div className="mt-8 space-y-5">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6"
            >
              <h2 className="text-xl font-semibold text-white">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-white/65 sm:text-[15px]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul className="space-y-2 pl-5 text-white/62">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="list-disc">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-white/52">
          <Link
            href="/"
            className="font-medium text-[#9bddff] underline-offset-4 transition hover:text-white hover:underline"
          >
            Back to Blink
          </Link>
          <Link
            href="/pro"
            className="underline-offset-4 transition hover:text-white hover:underline"
          >
            Blink Pro
          </Link>
          <a
            href="https://discord.gg/Myu962DMMA"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 transition hover:text-white hover:underline"
          >
            Discord support
          </a>
        </div>
      </div>
    </main>
  );
}
