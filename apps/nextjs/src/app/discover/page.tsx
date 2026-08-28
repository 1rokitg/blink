"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Heart, RefreshCw } from "lucide-react";
import type { NormalizedTrader } from "../api/discover/route";
import PnlChart from "./components/pnl";

type Trader = NormalizedTrader;

type Profile = {
  id: string;
  handle: string;
  name: string | null;
  bio: string | null;
  profilePicture: string | null;
  twitter: string | null;
};

type FeedItem = Trader & { feedKey: string };
type Batch = { batchId: number; traders: Trader[] };

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

function formatPercent(value: number | null) {
  if (value == null) return null;
  const prefix = value >= 0 ? "▲" : "▼";
  return `${prefix} ${Math.abs(value).toFixed(2)}%`;
}

function displayName(trader: Trader, profile: Profile | null | undefined) {
  return profile?.name || trader.label || trader.handle || "Unknown trader";
}

function handleName(trader: Trader, profile: Profile | null | undefined) {
  return profile?.handle || trader.handle || "trader";
}

export default function BlinkDiscoverFeed() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const batchCounter = useRef(0);
  const isFetchingBatch = useRef(false);
  const fetchingProfileIds = useRef<Set<string>>(new Set());

  const fetchBoard = useCallback(async (): Promise<Trader[]> => {
    const response = await fetch("/api/discover", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error || "Could not load traders");
    return json.data ?? [];
  }, []);

  // Initial load: one fresh batch.
  const loadInitial = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const traders = await fetchBoard();
      batchCounter.current += 1;
      setBatches([{ batchId: batchCounter.current, traders }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load traders");
    } finally {
      setLoading(false);
    }
  }, [fetchBoard]);

  // Manual refresh: reset to a single new batch and jump to the top.
  const refresh = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const traders = await fetchBoard();
      batchCounter.current += 1;
      setBatches([{ batchId: batchCounter.current, traders }]);
      feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load traders");
    } finally {
      setRefreshing(false);
    }
  }, [fetchBoard]);

  // Infinite scroll: APPEND a new batch instead of replacing the whole
  // feed. FomoScan caps the leaderboard at 100 entries, so once the user
  // nears the end we pull a revalidated snapshot and loop the board back
  // in as a fresh batch — existing DOM stays put, no remount/flicker.
  const loadMore = useCallback(async () => {
    if (isFetchingBatch.current) return;
    isFetchingBatch.current = true;
    try {
      const traders = await fetchBoard();
      batchCounter.current += 1;
      setBatches((current) => [...current, { batchId: batchCounter.current, traders }]);
    } catch {
      // Silent: infinite-scroll fetches shouldn't surface a full-page error.
    } finally {
      isFetchingBatch.current = false;
    }
  }, [fetchBoard]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

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

  const onScroll = () => {
    const node = feedRef.current;
    if (!node || isFetchingBatch.current) return;
    const nearBottom =
      node.scrollTop + node.clientHeight >= node.scrollHeight - node.clientHeight * 0.75;
    if (nearBottom) loadMore();
  };

  const feed: FeedItem[] = batches.flatMap((batch) =>
    batch.traders.map((trader, index) => ({
      ...trader,
      feedKey: `${batch.batchId}-${index}-${trader.id}`,
    }))
  );

  useEffect(() => {
    const node = feedRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (!entry.isIntersecting) return;
          const id = (entry.target as HTMLElement).dataset.traderId;
          if (!id || profiles[id] !== undefined || fetchingProfileIds.current.has(id)) return;

          fetchingProfileIds.current.add(id);
          try {
            const response = await fetch(`/api/traders/${id}`);
            const profile = response.ok ? await response.json() : null;
            setProfiles((current) => ({ ...current, [id]: profile }));
          } catch {
            setProfiles((current) => ({ ...current, [id]: null }));
          } finally {
            fetchingProfileIds.current.delete(id);
          }
        });
      },
      { root: node, rootMargin: "80% 0px" }
    );

    node.querySelectorAll("[data-trader-id]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [feed.length, profiles]);

  return (
    <main className="relative h-[100svh] overflow-hidden bg-[#05060a]">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="h-28 bg-gradient-to-b from-black/70 via-black/30 to-transparent px-5 pt-5 sm:px-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div>
              <div className="font-sans text-sm font-extrabold tracking-tight text-white">
                FOMO
              </div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Traders · 24H
              </div>
            </div>
            <button
              onClick={refresh}
              className="pointer-events-auto rounded-full border border-white/10 bg-black/30 p-2.5 text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white active:scale-95"
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
        className="h-[100svh] snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/15 border-t-white/80" />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <div className="text-sm font-semibold text-white">Couldn&apos;t load traders</div>
              <div className="mt-2 text-xs text-white/45">{error}</div>
              <button
                onClick={loadInitial}
                className="mt-5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
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
            const isUp = (trader.pnl ?? 0) >= 0;
            const isTopRank = trader.rank === 1;
            const avatar = trader.avatarUrl || profile?.profilePicture || "";
            const percentLabel = formatPercent(trader.pnlPercent);

            return (
                <section
                key={trader.feedKey}
                data-trader-id={trader.id}
                className="relative flex h-[100svh] w-full snap-start snap-always items-end justify-center overflow-hidden bg-[#05060a]"
                >
                {/* ================================
                    CHART BACKGROUND
                    ================================ */}
                    {/* PnL chart background */}
                    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
                    <div
                        className="
                        relative
                        h-[48svh] w-[150vw]
                        sm:h-[55svh] sm:w-[125vw]
                        lg:h-[72svh] lg:w-[90vw]
                        xl:h-[76svh] xl:w-full
                        "
                    >
                        <PnlChart
                        seed={trader.id}
                        positive={isUp}
                        className="h-full w-full"
                        />
                    </div>
                    </div>

                {/* ================================
                    AVATAR ATMOSPHERE
                    ================================ */}
                {avatar ? (
                    <img
                    src={avatar}
                    alt=""
                    className="absolute inset-0 z-[1] h-full w-full scale-110 object-cover opacity-[0.08] blur-3xl"
                    />
                ) : null}

                {/* ================================
                    DARKENING / READABILITY
                    ================================ */}
<div className="pointer-events-none absolute inset-0 z-10 bg-black/20" />

<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[65%] bg-gradient-to-t from-black via-black/60 to-transparent" />

<div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-black/50 to-transparent" />

                {/* ================================
                    CONTENT
                    ================================ */}
                <div
                className="
                    relative z-20
                    flex w-full max-w-5xl
                    items-end
                    gap-4
                    px-5
                    pb-12
                    sm:gap-6 sm:px-8 sm:pb-14
                    lg:gap-10 lg:px-10 lg:pb-16
                    xl:max-w-6xl xl:gap-12
                "
                >
                    <div className="min-w-0 flex-1">
                    <div className="mb-5 flex items-center gap-3">
                        <div
                        className={`
                            h-12 w-12
                            sm:h-14 sm:w-14
                            lg:h-20 lg:w-20
                            xl:h-24 xl:w-24
                            shrink-0 overflow-hidden rounded-full border bg-white/5
                            ${
                            isTopRank
                                ? "border-amber-300/70 shadow-[0_0_0_3px_rgba(252,211,77,0.15)]"
                                : "border-white/15"
                            }
                        `}
                        >
                        {avatar ? (
                            <img
                            src={avatar}
                            alt=""
                            className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-extrabold text-white/60">
                            {(displayName(trader, profile)[0] || "?").toUpperCase()}
                            </div>
                        )}
                        </div>

                        <div className="min-w-0">
                        <div className="flex items-center gap-2">
                        <span
  className="
    truncate
    text-lg font-extrabold tracking-tight text-white
    sm:text-xl
    lg:text-2xl
    xl:text-3xl
  "
>
                            {displayName(trader, profile)}
                            </span>

                            <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                isTopRank
                                ? "bg-amber-300 text-black"
                                : "bg-white/10 text-white/60"
                            }`}
                            >
                            #{trader.rank}
                            </span>
                        </div>

                        <div
  className="
    truncate
    text-xs text-white/45
    sm:text-sm
    lg:text-base
  "
>
                            @{handleName(trader, profile)}
                        </div>
                        </div>
                    </div>

                    <div className="mb-4">
                    <div
  className="
    text-[10px]
    font-bold
    uppercase
    tracking-[0.2em]
    text-white/40
    sm:text-xs
    lg:text-sm
  "
>
  24h PnL
</div>

                        <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
                        <span
  className={`
    font-mono
    text-5xl
    font-extrabold
    tracking-tight
    tabular-nums
    sm:text-6xl
    lg:text-7xl
    xl:text-8xl
    2xl:text-9xl
    ${
      isUp
        ? "text-emerald-300"
        : "text-rose-300"
    }
  `}
>
  {formatPnl(trader.pnl)}
</span>

                        {percentLabel ? (
                            <span
                            className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                                isUp
                                ? "bg-emerald-400/15 text-emerald-300"
                                : "bg-rose-400/15 text-rose-300"
                            }`}
                            >
                            {percentLabel}
                            </span>
                        ) : null}
                        </div>
                    </div>

                    {trader.followers != null && (
                        <div
  className="
    mb-3
    text-xs font-medium text-white/40
    sm:text-sm
    lg:text-base
  "
>
                        {trader.followers.toLocaleString()} followers
                        </div>
                    )}

<p
  className="
    max-w-xl
    text-sm leading-6 text-white/60
    sm:text-base
    lg:max-w-2xl lg:text-lg lg:leading-7
    xl:text-xl xl:leading-8
  "
>
                        {profile?.bio || "FOMO trader"}
                    </p>
                    </div>

                    {/* Actions */}
                    <div
  className="
    mb-0
    flex shrink-0 flex-col items-center
    gap-3
    sm:gap-4
    lg:gap-5
  "
>
<button
  onClick={() => toggle("liked", trader.id, setLiked)}
  className="
    group
    flex
    items-center
    gap-2
    text-white/70
    transition
    hover:text-white
    active:scale-95

    lg:w-36
    lg:justify-center
    lg:rounded-2xl
    lg:border
    lg:border-white/10
    lg:bg-black/25
    lg:px-5
    lg:py-4
    lg:backdrop-blur-xl

    xl:w-40
    xl:py-5
  "
  aria-label={isLiked ? "Unlike trader" : "Like trader"}
  aria-pressed={isLiked}
>
  <span
    className={`
      flex
      h-11 w-11
      items-center justify-center
      rounded-full
      border
      backdrop-blur-md
      transition

      lg:h-8
      lg:w-8
      lg:rounded-lg

      ${
        isLiked
          ? "border-white/30 bg-white text-black"
          : "border-white/10 bg-black/20"
      }
    `}
  >
    <Heart
      className={`
        h-5 w-5
        lg:h-5 lg:w-5
        ${isLiked ? "fill-current" : ""}
      `}
    />
  </span>

  <span
    className="
      hidden
      lg:block
      text-sm
      font-bold
      xl:text-base
    "
  >
    {isLiked ? "Liked" : "Like"}
  </span>
</button>

<button
  onClick={() => toggle("saved", trader.id, setSaved)}
  className="
    group
    flex
    items-center
    gap-2
    text-white/70
    transition
    hover:text-white
    active:scale-95

    lg:w-36
    lg:justify-center
    lg:rounded-2xl
    lg:border
    lg:border-white/10
    lg:bg-black/25
    lg:px-5
    lg:py-4
    lg:backdrop-blur-xl

    xl:w-40
    xl:py-5
  "
  aria-label={isSaved ? "Unsave trader" : "Save trader"}
  aria-pressed={isSaved}
>
  <span
    className={`
      flex
      h-11 w-11
      items-center justify-center
      rounded-full
      border
      backdrop-blur-md
      transition

      lg:h-8
      lg:w-8
      lg:rounded-lg

      ${
        isSaved
          ? "border-white/30 bg-white text-black"
          : "border-white/10 bg-black/20"
      }
    `}
  >
    <Bookmark
      className={`
        h-5 w-5
        ${isSaved ? "fill-current" : ""}
      `}
    />
  </span>

  <span
    className="
      hidden
      lg:block
      text-sm
      font-bold
      xl:text-base
    "
  >
    {isSaved ? "Saved" : "Save"}
  </span>
</button>

{x ? (
  <a
    href={x}
    target="_blank"
    rel="noopener noreferrer"
    className="
      group
      flex
      items-center
      gap-2
      text-white/70
      transition
      hover:text-white
      active:scale-95

      lg:w-36
      lg:justify-center
      lg:rounded-2xl
      lg:border
      lg:border-white/10
      lg:bg-black/25
      lg:px-5
      lg:py-4
      lg:backdrop-blur-xl

      xl:w-40
      xl:py-5
    "
    aria-label={`Open ${handleName(trader, profile)} on X`}
  >
    <span
      className="
        flex
        h-11 w-11
        items-center justify-center
        rounded-full
        border border-white/10
        bg-black/20
        text-sm font-extrabold
        backdrop-blur-md
        transition

        lg:h-8
        lg:w-8
        lg:rounded-lg

        group-hover:bg-white
        group-hover:text-black
      "
    >
      𝕏
    </span>

    <span
      className="
        hidden
        lg:block
        text-sm
        font-bold
        xl:text-base
      "
    >
      View on X
    </span>
  </a>
) : null}
                    </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-3 left-5 z-20 text-[10px] font-semibold text-white/25 sm:left-8">
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