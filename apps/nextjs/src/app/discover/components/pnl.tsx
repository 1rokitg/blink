"use client";

import { useMemo } from "react";

type PnlChartProps = {
  seed: string;
  positive: boolean;
  className?: string;
};

const WIDTH = 600;
const HEIGHT = 260;
const POINT_COUNT = 26;

// Deterministic PRNG (mulberry32) so a given trader always renders the same
// chart shape instead of the line jumping around on every re-render.
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return h;
}

// Random walk, biased toward the trader's real 24h direction so the shape
// stays honest to the actual number even though the path itself is
// synthetic placeholder data until a real history endpoint exists.
function generateSeries(seed: string, positive: boolean): [number, number][] {
  const rand = mulberry32(hashSeed(seed));
  const raw: number[] = [0];
  for (let i = 1; i < POINT_COUNT; i++) {
    raw.push(raw[i - 1] + (rand() - 0.5) * 10);
  }
  const drift = positive ? 1 : -1;
  const trendPerStep = (drift * 22) / POINT_COUNT;
  const biased = raw.map((v, i) => v + trendPerStep * i);

  const min = Math.min(...biased);
  const max = Math.max(...biased);
  const range = max - min || 1;
  const padding = 20;

  return biased.map((v, i) => {
    const x = (i / (POINT_COUNT - 1)) * WIDTH;
    const y = padding + (1 - (v - min) / range) * (HEIGHT - padding * 2);
    return [x, y];
  });
}

// Catmull-Rom -> cubic Bezier conversion for a smooth, rounded line
// (matches the reference chart's soft peaks instead of sharp zig-zags).
function smoothPath(points: [number, number][]) {
  if (points.length < 2) return "";
  const d: string[] = [`M ${points[0][0]},${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }
  return d.join(" ");
}

export default function PnlChart({ seed, positive, className }: PnlChartProps) {
  const points = useMemo(() => generateSeries(seed, positive), [seed, positive]);
  const linePath = useMemo(() => smoothPath(points), [points]);
  const areaPath = `${linePath} L ${WIDTH},${HEIGHT} L 0,${HEIGHT} Z`;
  const gradientId = `pnlFill-${seed}`;
  const color = positive ? "#34d399" : "#fb7185";

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}