"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  SEARCH_GROUP_LABEL,
  SEARCH_GROUP_ORDER,
  type SearchGroup,
  type SearchIndexItem,
  type SearchIndexResponse,
} from "@/lib/internal-search-types";
import { SEARCH_SHORTCUTS } from "@/lib/internal-search-static";

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function mergeSearchItems(
  shortcuts: SearchIndexItem[],
  remote: SearchIndexItem[],
) {
  const byId = new Map<string, SearchIndexItem>();
  for (const row of shortcuts) byId.set(row.id, row);
  for (const row of remote) byId.set(row.id, row);
  // Keep shortcut pages/actions first, then the rest in API order.
  const shortcutIds = new Set(shortcuts.map((row) => row.id));
  const rest = remote.filter((row) => !shortcutIds.has(row.id));
  return [...shortcuts.map((row) => byId.get(row.id)!), ...rest];
}

export function CommandSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchIndexItem[]>(SEARCH_SHORTCUTS);
  const [indexReady, setIndexReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const loadedAt = useRef<number>(0);

  const loadIndex = useCallback((force = false) => {
    const fresh = Date.now() - loadedAt.current < 45_000;
    if (!force && indexReady && fresh) return;
    startTransition(async () => {
      try {
        setError(null);
        const res = await fetch("/api/internal/search", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Search unavailable");
        const data = (await res.json()) as SearchIndexResponse;
        setItems(mergeSearchItems(SEARCH_SHORTCUTS, data.items ?? []));
        setIndexReady(true);
        loadedAt.current = Date.now();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search unavailable");
      }
    });
  }, [indexReady]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    // Always show shortcuts immediately — never blank while datasets load.
    setItems((prev) =>
      prev.length > 0 ? prev : SEARCH_SHORTCUTS,
    );
    loadIndex();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, loadIndex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  function select(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  const hasQuery = query.trim().length > 0;
  const emptyCap: Partial<Record<SearchGroup, number>> = {
    pages: 20,
    actions: 12,
    products: 12,
    members: 8,
    people: 8,
    leads: 8,
    payments: 8,
    checkout: 8,
    comps: 8,
  };

  const grouped = SEARCH_GROUP_ORDER.map((group) => {
    const rows = items.filter((row) => row.group === group);
    return {
      group,
      label: SEARCH_GROUP_LABEL[group],
      items: hasQuery ? rows : rows.slice(0, emptyCap[group] ?? 8),
    };
  }).filter((section) => section.items.length > 0);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 p-3 pt-[12vh] backdrop-blur-sm sm:p-6 sm:pt-[14vh]"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <Command
        label="Internal search"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#262626] bg-[#0f0f0f] shadow-[0_30px_120px_rgba(0,0,0,0.65)]"
        onClick={(event) => event.stopPropagation()}
        filter={(value, search, keywords) => {
          const q = search.trim().toLowerCase();
          if (!q) return 1;
          const hay = `${value} ${(keywords ?? []).join(" ")}`.toLowerCase();
          if (hay.includes(q)) return 1;
          const tokens = q.split(/\s+/).filter(Boolean);
          return tokens.every((token) => hay.includes(token)) ? 0.5 : 0;
        }}
      >
        <div className="flex items-center gap-3 border-b border-[#1f1f1f] px-4">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 text-[#71717a]"
            aria-hidden
          >
            <circle
              cx="11"
              cy="11"
              r="6.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="m16 16 4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages, members, people, payments…"
            className="h-14 w-full bg-transparent text-[15px] text-[#fafafa] outline-none placeholder:text-[#52525b]"
            autoFocus
          />
          <kbd className="hidden rounded-md border border-[#262626] bg-[#141414] px-1.5 py-0.5 text-[10px] font-medium text-[#71717a] sm:inline">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[min(480px,58vh)] overflow-y-auto overscroll-contain px-2 py-2">
          {error ? (
            <div className="px-3 py-3 text-center text-[12px] text-red-400">
              {error} · showing page shortcuts
            </div>
          ) : null}

          <Command.Empty className="px-3 py-8 text-center text-[13px] text-[#71717a]">
            No matches for “{query}”.
          </Command.Empty>

          {grouped.map((section) => (
            <Command.Group
              key={section.group}
              heading={section.label}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[#71717a] [&_[cmdk-group-heading]]:uppercase"
            >
              {section.items.map((row) => (
                <Command.Item
                  key={row.id}
                  value={row.value}
                  keywords={[row.title, row.subtitle ?? "", row.group]}
                  onSelect={() => select(row.href)}
                  className="flex cursor-pointer items-start gap-3 rounded-full px-3 py-2.5 text-left aria-selected:bg-white/[0.06]"
                >
                  <GroupGlyph group={row.group} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-[#fafafa]">
                      {row.title}
                    </span>
                    {row.subtitle ? (
                      <span className="mt-0.5 block truncate text-[12px] text-[#71717a]">
                        {row.subtitle}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 shrink-0 text-[10px] font-semibold tracking-wide text-[#52525b] uppercase">
                    {SEARCH_GROUP_LABEL[row.group]}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1f1f1f] px-4 py-2.5 text-[11px] text-[#52525b]">
          <span>
            {indexReady
              ? `${items.length.toLocaleString()} indexed · members, people, leads, payments, links`
              : pending
                ? `Shortcuts ready · indexing datasets…`
                : `${SEARCH_SHORTCUTS.length} shortcuts`}
          </span>
          <span className="flex items-center gap-2">
            <span>
              <kbd className="rounded border border-[#262626] bg-[#141414] px-1">↵</kbd>{" "}
              open
            </span>
            <span>
              <kbd className="rounded border border-[#262626] bg-[#141414] px-1">↑↓</kbd>{" "}
              move
            </span>
          </span>
        </div>
      </Command>
    </div>
  );
}

function GroupGlyph({ group }: { group: SearchGroup }) {
  const tone =
    group === "members" || group === "people" || group === "leads"
      ? "text-[#70a7ff]"
      : group === "payments" || group === "checkout" || group === "comps"
        ? "text-emerald-400"
        : group === "products"
          ? "text-amber-300"
          : "text-[#a1a1aa]";

  return (
    <span
      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#262626] bg-[#141414] text-[11px] font-bold ${tone}`}
      aria-hidden
    >
      {group === "pages"
        ? "PG"
        : group === "actions"
          ? "→"
          : group === "members"
            ? "MB"
            : group === "people"
              ? "PP"
              : group === "leads"
                ? "LD"
                : group === "payments"
                  ? "$"
                  : group === "checkout"
                    ? "CK"
                    : group === "comps"
                      ? "CP"
                      : "PR"}
    </span>
  );
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  const mod = isMac() ? "⌘" : "Ctrl";
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="relative hidden w-full max-w-md items-center gap-3 rounded-full border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-left text-sm text-[#71717a] transition hover:border-[#3f3f46] hover:bg-[#141414] md:flex"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0"
          aria-hidden
        >
          <circle
            cx="11"
            cy="11"
            r="6.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m16 16 4 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span className="flex-1 truncate">
          Search members, people, payments…
        </span>
        <kbd className="rounded-full border border-[#262626] bg-[#141414] px-2 py-0.5 text-[10px] font-medium text-[#a1a1aa]">
          {mod}K
        </kbd>
      </button>
      <button
        type="button"
        onClick={onClick}
        aria-label="Search"
        className="grid h-9 w-9 place-items-center rounded-full border border-[#262626] bg-[#0f0f0f] text-[#a1a1aa] hover:bg-[#141414] md:hidden"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle
            cx="11"
            cy="11"
            r="6.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m16 16 4 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </>
  );
}
