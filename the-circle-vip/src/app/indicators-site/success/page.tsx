import Link from "next/link";

import { INDICATORS_SITE } from "@/lib/indicators-site";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export default async function IndicatorsSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  let email: string | null = null;

  if (params.session_id && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(
        params.session_id,
      );
      email =
        session.customer_details?.email || session.customer_email || null;
    } catch {
      // ignore
    }
  }

  return (
    <main className="indicators-site relative flex min-h-screen items-center justify-center px-5 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 indicators-atmosphere" />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-black/40 p-8 text-center backdrop-blur-md">
        <p className="text-[11px] font-bold tracking-[0.2em] text-[#7dffb3] uppercase">
          Pack unlocked
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-syne)] text-3xl font-semibold tracking-tight">
          {INDICATORS_SITE.name}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Payment received
          {email ? (
            <>
              {" "}
              for <span className="text-white">{email}</span>
            </>
          ) : null}
          . Your .zip lands by email — indicators, the setup video, and the
          aggr.trade templates I use daily. Check inbox + spam.
        </p>
        <ul className="mt-6 space-y-2 text-left text-[13px] text-white/55">
          {INDICATORS_SITE.deliverables.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
            >
              <span className="font-semibold text-white/85">{item.title}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3">
          <a
            href={INDICATORS_SITE.aggrTradeUrl}
            target="_blank"
            rel="noreferrer"
            className="indicators-cta rounded-2xl px-5 py-3 text-sm font-bold text-[#04140c]"
          >
            Open aggr.trade
          </a>
          <a
            href={INDICATORS_SITE.articleUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Re-read the essay
          </a>
          <Link
            href="/"
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70 hover:bg-white/5"
          >
            Back to Indicators
          </Link>
        </div>
      </div>
    </main>
  );
}
