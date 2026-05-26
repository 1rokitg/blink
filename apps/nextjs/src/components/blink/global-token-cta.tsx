"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArrowUpRight, Disc } from "lucide-react";

import {
  BLINK_TOKEN_HEADLINE,
  BLINK_TOKEN_ROUTE,
  BLINK_TOKEN_SUBHEAD,
} from "~/lib/blink/token";

export function GlobalTokenCta() {
  const pathname = usePathname();

  if (
    pathname === BLINK_TOKEN_ROUTE ||
    pathname.startsWith("/trade") ||
    pathname.startsWith("/outcomes")
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-5">
      <Link
        href={BLINK_TOKEN_ROUTE}
        className="pointer-events-auto group flex w-full max-w-[360px] items-center gap-3 rounded-2xl border border-[#8fbaff80] bg-[linear-gradient(180deg,rgba(20,32,58,0.97),rgba(10,18,32,0.98))] px-4 py-3 text-left shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl transition hover:border-[#9bddff] hover:shadow-[0_24px_70px_rgba(37,90,224,0.28)] sm:w-[360px]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/12 text-[#8ad9ff]">
          <Disc className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">
            {BLINK_TOKEN_HEADLINE}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-white/58">
            {BLINK_TOKEN_SUBHEAD}
          </span>
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-[#8ad9ff] transition group-hover:text-white" />
      </Link>
    </div>
  );
}
