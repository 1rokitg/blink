"use client";

import type { ReactNode } from "react";

import type { PersonEnrichment } from "@/lib/people-types";

export type SocialHandles = {
  telegramUsername?: string | null;
  xUsername?: string | null;
  instagramUsername?: string | null;
  discordUsername?: string | null;
};

type SocialLink = {
  key: string;
  label: string;
  href: string;
};

function cleanHandle(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/^@/, "") ?? "";
  return trimmed || null;
}

export function socialLinksFromHandles(handles: SocialHandles): SocialLink[] {
  const links: SocialLink[] = [];

  const telegram = cleanHandle(handles.telegramUsername);
  if (telegram) {
    links.push({
      key: "tg",
      label: "TG",
      href: `https://t.me/${encodeURIComponent(telegram)}`,
    });
  }

  const x = cleanHandle(handles.xUsername);
  if (x) {
    links.push({
      key: "x",
      label: "X",
      href: `https://x.com/${encodeURIComponent(x)}`,
    });
  }

  const ig = cleanHandle(handles.instagramUsername);
  if (ig) {
    links.push({
      key: "ig",
      label: "IG",
      href: `https://instagram.com/${encodeURIComponent(ig)}`,
    });
  }

  const discord = cleanHandle(handles.discordUsername);
  if (discord) {
    // Discord usernames aren't deep-linkable without snowflake ids — open search.
    links.push({
      key: "dc",
      label: "DC",
      href: `https://discord.com/users/${encodeURIComponent(discord)}`,
    });
  }

  return links;
}

export function socialLinksFromEnrichment(
  enrichment: PersonEnrichment | null | undefined,
  fallbacks?: SocialHandles,
): SocialLink[] {
  return socialLinksFromHandles({
    telegramUsername:
      enrichment?.telegramUsername || fallbacks?.telegramUsername,
    xUsername: enrichment?.xUsername || fallbacks?.xUsername,
    instagramUsername:
      enrichment?.instagramUsername || fallbacks?.instagramUsername,
    discordUsername: enrichment?.discordUsername || fallbacks?.discordUsername,
  });
}

/** Compact social chips — stop row click from opening the profiler. */
export function SocialQuickLinks({
  enrichment,
  fallbacks,
  className = "",
  empty = "—",
}: {
  enrichment: PersonEnrichment | null | undefined;
  fallbacks?: SocialHandles;
  className?: string;
  empty?: ReactNode;
}) {
  const links = socialLinksFromEnrichment(enrichment, fallbacks);
  if (links.length === 0) {
    if (empty == null) return null;
    return <span className="text-[11px] text-[#52525b]">{empty}</span>;
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          title={link.href}
          className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[#262626] bg-[#0f0f0f] px-1.5 text-[10px] font-bold tracking-wide text-[#d4d4d8] transition hover:border-[#3f3f46] hover:bg-[#1c1c1c] hover:text-white"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
