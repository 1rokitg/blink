"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { VisitorAvatar } from "@/components/internal/visitor-avatar";
import type { VisitorPin } from "@/lib/traffic-live-types";

const WorldTrafficMapCanvas = dynamic(
  () =>
    import("@/components/internal/world-traffic-map-canvas").then(
      (mod) => mod.WorldTrafficMapCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center bg-[#0b1220] text-[13px] text-[#71717a] sm:h-[420px]">
        Loading world map…
      </div>
    ),
  },
);

function countryFlag(code: string) {
  if (!code || code.length !== 2 || code === "XX" || code === "T1") return "·";
  const base = 127397;
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((char) => base + char.charCodeAt(0)),
  );
}

export function WorldTrafficMap({
  pins,
  mode,
  title,
  subtitle,
}: {
  pins: VisitorPin[];
  mode: "pageviews" | "uniques";
  title: string;
  subtitle: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => pins.find((pin) => pin.id === selectedId) ?? null,
    [pins, selectedId],
  );

  return (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[#fafafa]">{title}</p>
          <p className="mt-1 text-[12px] text-[#71717a]">{subtitle}</p>
        </div>
        <p className="text-[12px] font-medium text-[#a1a1aa]">
          {pins.length.toLocaleString()}{" "}
          {mode === "uniques" ? "visitors" : "impressions"} on map
        </p>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-xl border border-[#1f1f1f]">
        <WorldTrafficMapCanvas
          pins={pins}
          mode={mode}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {selected ? (
          <div className="pointer-events-auto absolute bottom-3 left-3 right-3 z-[1000] flex max-w-md items-start gap-3 rounded-xl border border-[#262626] bg-[#0f0f0f]/95 p-3 backdrop-blur sm:right-auto">
            <VisitorAvatar pin={selected} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[13px] font-semibold text-[#fafafa]">
                  {selected.shortId}
                </p>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#d4d4d8] uppercase">
                  {selected.device}
                </span>
                <span className="text-[12px] text-[#a1a1aa]">
                  {countryFlag(selected.country)}{" "}
                  {selected.city || selected.country}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-[#70a7ff]">
                {selected.path}
              </p>
              <p className="mt-1 text-[11px] text-[#71717a]">
                {selected.timezone} · {selected.language} · {selected.screen} ·{" "}
                {selected.pageviews} impressions
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-[12px] text-[#71717a] hover:text-white"
            >
              ✕
            </button>
          </div>
        ) : null}

        {pins.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-[#0b1220]/35">
            <p className="rounded-xl border border-dashed border-[#262626] bg-[#0f0f0f]/80 px-4 py-3 text-[13px] text-[#a1a1aa]">
              Waiting for live visitors in this window…
            </p>
          </div>
        ) : null}
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {pins.slice(0, mode === "pageviews" ? 12 : 9).map((pin) => (
          <li key={`card-${pin.id}`}>
            <button
              type="button"
              onClick={() => setSelectedId(pin.id)}
              className={`flex w-full items-center gap-3 rounded-full border px-3 py-2.5 text-left transition ${
                selectedId === pin.id
                  ? mode === "uniques"
                    ? "border-emerald-400/40 bg-emerald-500/10"
                    : "border-[#70a7ff]/50 bg-[#70a7ff]/10"
                  : "border-[#262626] bg-[#0f0f0f] hover:border-[#3f3f46]"
              }`}
            >
              <span
                className={`relative grid h-8 w-8 place-items-center rounded-full border ${
                  mode === "uniques"
                    ? "border-emerald-400/30 bg-emerald-500/10"
                    : "border-[#70a7ff]/30 bg-[#70a7ff]/10"
                }`}
                aria-hidden
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    mode === "uniques" ? "bg-emerald-300" : "bg-[#70a7ff]"
                  } shadow-[0_0_10px_rgba(112,167,255,0.7)]`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-semibold text-[#fafafa]">
                    {pin.shortId}
                  </span>
                  <span className="text-[11px] text-[#a1a1aa]">
                    {countryFlag(pin.country)} {pin.country}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[#71717a]">
                  {pin.city || pin.region || "—"} · {pin.device} · {pin.path}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

    </div>
  );
}
