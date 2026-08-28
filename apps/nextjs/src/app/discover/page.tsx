"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Heart, ExternalLink, RefreshCw, X } from "lucide-react";

type Trader = {
  rank: number;
  id: string;
  handle: string | null;
  label: string | null;
  avatarUrl: string | null;
  pnl: number | null;
  volume?: number | null;
  followers?: number | null;
  numTrades?: number | null;
};

type Profile = {
  id: string;
  handle: string;
  name: string | null;
  bio: string | null;
  profilePicture: string | null;
  twitter: string | null;
};

type ReelTrader = Trader & {
  profile?: Profile | null;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatPnl(value: number | null) {
  if (value == null) return "—";
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${currency.format(value)}`;
}

function displayName(trader: ReelTrader) {
  return trader.profile?.name || trader.label || trader.handle || "Unknown trader";
}

function handleName(trader: ReelTrader) {
  return trader.profile?.handle || trader.handle || "trader";
}

export default function Home() {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const loadBoard = useCallback(async (manual = false) => {
    setError(null);
    if (manual) setRefreshing(true);
    try {
      const response = await fetch("/api/discover", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Could not load traders");
      setTraders(json.data ?? []);
      setCycle((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load traders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    try {
      setLiked(JSON.parse(localStorage.getItem("fomo-liked") || "{}"));
      setSaved(JSON.parse(localStorage.getItem("fomo-saved") || "{}"));
    } catch {}
  }, []);

  const toggle = (
    key: "liked" | "saved",
    id: string,
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  ) => {
    setter((current) => {
      const next = { ...current, [id]: !current[id] };
      localStorage.setItem(key === "liked" ? "fomo-liked" : "fomo-saved", JSON.stringify(next));
      return next;
    });
  };

  // FomoScan caps the leaderboard at 100 entries. Once the user reaches the
  // end, revalidate the snapshot and loop back to the top so the UX remains
  // infinite while the data remains sourced from the current 24h board.
  const feed = useMemo(() => {
    if (!traders.length) return [];
    const repeated = Array.from({ length: 3 }, () => traders).flat();
    return repeated.map((trader, index) => ({
      ...trader,
      feedKey: `${cycle}-${index}-${trader.id}`,
    }));
  }, [traders, cycle]);

  const onScroll = () => {
    const node = feedRef.current;
    if (!node) return;
    const nearBottom =
      node.scrollTop + node.clientHeight >= node.scrollHeight - node.clientHeight * 0.75;

    if (nearBottom && !refreshing) {
      loadBoard();
    }
  };

  useEffect(() => {
    const node = feedRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (!visible) return;
        const id = (visible.target as HTMLElement).dataset.traderId;
        if (!id || profiles[id] !== undefined) return;

        try {
          const response = await fetch(`/api/traders/${id}`);
          const profile = response.ok ? await response.json() : null;
          setProfiles((current) => ({ ...current, [id]: profile }));
        } catch {
          setProfiles((current) => ({ ...current, [id]: null }));
        }
      },
      { root: node, rootMargin: "80% 0px" }
    );

    node.querySelectorAll("[data-trader-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [feed, profiles]);

  return (
    <main className="relative h-[100svh] overflow-hidden bg-ink-950">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="mask-top h-28 px-5 pt-5 sm:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div>
              <div className="font-display text-sm font-800 tracking-tight text-white">FOMO</div>
              <div className="mt-0.5 text-[10px] font-600 uppercase tracking-[0.18em] text-white/45">
                Traders
              </div>
            </div>
            <button
              onClick={() => loadBoard(true)}
              className="pointer-events-auto rounded-full border border-white/10 bg-black/20 p-2.5 text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
              aria-label="Refresh trader feed"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      <div
        ref={feedRef}
        onScroll={onScroll}
        className="feed h-[100svh] snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/15 border-t-white/80" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <div className="text-sm font-600 text-white">Couldn&apos;t load traders</div>
              <div className="mt-2 text-xs text-white/45">{error}</div>
              <button
                onClick={() => loadBoard(true)}
                className="mt-5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-600 text-white hover:bg-white/10"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          feed.map((trader) => {
            const profile = profiles[trader.id];
            const x = profile?.twitter;
            const isLiked = !!liked[trader.id];
            const isSaved = !!saved[trader.id];

            return (
              <section
                key={trader.feedKey}
                data-trader-id={trader.id}
                className="reel relative flex items-end justify-center overflow-hidden bg-ink-950"
              >
                {trader.avatarUrl || profile?.profilePicture ? (
                  <>
                    <img
                      src={trader.avatarUrl || profile?.profilePicture || ""}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-25 blur-3xl scale-110"
                    />
                    <div className="absolute inset-0 bg-ink-950/45" />
                  </>
                ) : null}

                <div className="absolute inset-0 mask-bottom" />
                <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/25 to-transparent" />

                <div className="relative z-10 flex w-full max-w-5xl items-end gap-5 px-5 pb-14 sm:px-8 sm:pb-16">
                  <div className="min-w-0 flex-1">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/5">
                        {(profile?.profilePicture || trader.avatarUrl) ? (
                          <img
                            src={profile?.profilePicture || trader.avatarUrl || ""}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-800 text-white/60">
                            {(displayName(trader)[0] || "?").toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-display text-lg font-800 tracking-tight text-white">
                          {displayName(trader)}
                        </div>
                        <div className="truncate text-xs text-white/45">@{handleName(trader)}</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="text-[10px] font-700 uppercase tracking-[0.2em] text-white/40">
                        24h PnL
                      </div>
                      <div className={`mt-1 font-display text-5xl font-800 tracking-[-0.04em] sm:text-7xl ${
                        (trader.pnl ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"
                      }`}>
                        {formatPnl(trader.pnl)}
                      </div>
                    </div>

                    <p className="max-w-xl text-sm leading-6 text-white/62 sm:text-base">
                      {profile?.bio || "FOMO trader"}
                    </p>
                  </div>

                  <div className="mb-0 flex shrink-0 flex-col items-center gap-4">
                    <button
                      onClick={() => toggle("liked", trader.id, setLiked)}
                      className="group flex w-12 flex-col items-center gap-1.5 text-white/70 transition hover:text-white"
                      aria-label={isLiked ? "Unlike trader" : "Like trader"}
                    >
                      <span className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition ${
                        isLiked ? "border-white/30 bg-white text-black" : "border-white/10 bg-black/20"
                      }`}>
                        <Heart className={`h-5 w-5 ${isLiked ? "fill-current" : ""}`} />
                      </span>
                      <span className="text-[10px] font-600">Like</span>
                    </button>

                    <button
                      onClick={() => toggle("saved", trader.id, setSaved)}
                      className="group flex w-12 flex-col items-center gap-1.5 text-white/70 transition hover:text-white"
                      aria-label={isSaved ? "Unsave trader" : "Save trader"}
                    >
                      <span className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition ${
                        isSaved ? "border-white/30 bg-white text-black" : "border-white/10 bg-black/20"
                      }`}>
                        <Bookmark className={`h-5 w-5 ${isSaved ? "fill-current" : ""}`} />
                      </span>
                      <span className="text-[10px] font-600">Save</span>
                    </button>

                    {x ? (
                      <a
                        href={x}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex w-12 flex-col items-center gap-1.5 text-white/70 transition hover:text-white"
                        aria-label={`Open ${handleName(trader)} on X`}
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/20 text-sm font-800 backdrop-blur-md transition group-hover:bg-white group-hover:text-black">
                          𝕏
                        </span>
                        <span className="text-[10px] font-600">X</span>
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="absolute bottom-3 left-5 z-10 text-[10px] font-600 text-white/25 sm:left-8">
                  #{trader.rank} · FomoScan · 24h
                </div>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}