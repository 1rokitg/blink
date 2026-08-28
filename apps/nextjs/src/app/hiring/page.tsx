import {
  ArrowUpRight,
  Code2,
  type LucideIcon,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hiring | Blink",
  description:
    "Blink is hiring for a founding engineer and a community moderator to help build the fastest terminal and community in crypto.",
};

type RoleCard = {
  idealFor: string[];
  icon: LucideIcon;
  summary: string;
  title: string;
  whatYouWillOwn: string[];
};

const roles: RoleCard[] = [
  {
    title: "Founding Engineer",
    icon: Code2,
    summary:
      "Own product velocity across trading UX, growth surfaces, infra, and the sharp edges that make Blink feel faster than everyone else.",
    whatYouWillOwn: [
      "Ship end-to-end product work across Next.js, trading flows, public surfaces, and growth systems.",
      "Work directly with the founder on product direction, monetization, and speed of execution.",
      "Turn rough ideas into polished features without waiting for heavy process.",
      "Help shape the engineering culture, architecture, and technical bar from day one.",
    ],
    idealFor: [
      "You move fast in TypeScript, React, and Next.js.",
      "You care about product taste as much as code quality.",
      "You want ownership, not just tickets.",
      "You are comfortable in an early-stage environment with lots of momentum and little bureaucracy.",
    ],
  },
  {
    title: "Community Moderator",
    icon: Users,
    summary:
      "Help turn Blink's Discord and social presence into a live extension of the product: sharp, welcoming, and always moving.",
    whatYouWillOwn: [
      "Moderate Discord and keep conversation high-signal without killing energy.",
      "Welcome new users, route support questions, and surface community sentiment quickly.",
      "Highlight trader wins, product drops, and Blink sightings worth amplifying.",
      "Help shape the culture around the token, Pro, and public community identity.",
    ],
    idealFor: [
      "You are online, responsive, and deeply comfortable in crypto-native communities.",
      "You know how to keep a server clean, active, and useful.",
      "You write clearly and know when to escalate issues fast.",
      "You want to help build community from the earliest days, not just maintain it later.",
    ],
  },
];

export default function HiringPage() {
  return (
    <main className="min-h-screen bg-[#060510] px-4 py-10 text-[#f4f7fb] sm:px-6 lg:px-8">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.14), transparent 28%), radial-gradient(circle at 82% 16%, rgba(96,165,250,0.12), transparent 24%), radial-gradient(circle at 50% 75%, rgba(14,165,233,0.08), transparent 30%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,24,0.96),rgba(6,9,18,0.98))] p-7 shadow-[0_28px_100px_rgba(0,0,0,0.45)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/20 bg-[#38bdf8]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#9bddff]">
            <Rocket className="size-3.5" />
            Hiring
          </div>

          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
            Join Blink early and help build the fastest terminal in
            crypto.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/68 sm:text-lg">
            Blink is in that rare stage where momentum is real, the product is
            live, and every strong person who joins can still bend the company
            in a major way. We are looking for builders who want leverage,
            speed, and real ownership.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              "Small team, direct founder access, high ownership",
              "Product, growth, and community are all moving at once",
              "Still early enough to shape the culture and the edge",
            ].map((point) => (
              <div
                key={point}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-white/62"
              >
                <Sparkles className="mb-3 size-4 text-[#8ad9ff]" />
                {point}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {roles.map(
            ({ idealFor, icon: Icon, summary, title, whatYouWillOwn }) => (
              <article
                key={title}
                className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
              >
                <div className="flex size-11 items-center justify-center rounded-2xl bg-[#38bdf8]/12 text-[#8ad9ff]">
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/62">
                  {summary}
                </p>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9bddff]">
                    What you will own
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-white/65">
                    {whatYouWillOwn.map((item) => (
                      <li key={item} className="list-disc pl-1 ml-5">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9bddff]">
                    Ideal for you if
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-white/65">
                    {idealFor.map((item) => (
                      <li key={item} className="list-disc pl-1 ml-5">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ),
          )}
        </section>

        <section className="rounded-[32px] border border-[#38bdf8]/15 bg-[linear-gradient(180deg,rgba(10,17,28,0.98),rgba(7,11,20,0.98))] p-7 shadow-[0_28px_100px_rgba(0,0,0,0.4)] sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/42">
            Apply
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            If you are strong, reach out now.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62">
            No formal process is needed at this stage. Send a short intro, links
            to your work, and why you want to help build Blink specifically.
            Conviction matters more than polish.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="https://discord.gg/Myu962DMMA"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#8fbaff80] bg-[linear-gradient(180deg,#3c76ff,#2457db)] px-5 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(37,90,224,0.35)] transition hover:brightness-110"
            >
              Apply via Discord
              <ArrowUpRight className="size-3.5" />
            </a>
            <a
              href="https://x.com/rokitdotgg"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
            >
              DM on X
              <ArrowUpRight className="size-3.5" />
            </a>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
            >
              Back to Blink
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
