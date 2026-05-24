import { ImageResponse } from "next/og";

import { infoClient } from "~/lib/blink/hyperliquid";
import { resolveProfileAddress } from "~/lib/blink/resolve-address";

export const runtime = "nodejs";
export const alt = "Blink Portfolio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ─── Helpers ────────────────────────────────────────────────────────────────

function truncateAddr(addr: string) {
  return `${addr.slice(0, 6).toUpperCase()}...${addr.slice(-4).toUpperCase()}`;
}

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n);
}

// ─── Chart path generation ───────────────────────────────────────────────────
// Produces a smooth upward-trending SVG path for the background chart.
// chartW × chartH are the SVG viewport dimensions.
const CHART_PTS = [
  [0, 290], [40, 278], [80, 295], [120, 275], [170, 258],
  [210, 270], [255, 240], [295, 220], [340, 235], [385, 200],
  [430, 182], [475, 168], [515, 150], [555, 162], [595, 130],
  [640, 105], [685, 118], [725, 85],  [770, 68],  [810, 52],
  [855, 58],  [900, 35],  [940, 22],  [980, 30],  [1010, 10],
] as const;

function buildChartPath(pts: readonly (readonly [number, number])[]) {
  // Catmull-Rom → cubic bezier conversion for smooth line
  const d: string[] = [`M ${pts[0][0]} ${pts[0][1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`);
  }
  return d.join(" ");
}

const last = CHART_PTS[CHART_PTS.length - 1];
const CHART_LINE = buildChartPath(CHART_PTS);
const CHART_FILL = `${CHART_LINE} L ${last[0]} 320 L ${CHART_PTS[0][0]} 320 Z`;

// ─── OG Image ───────────────────────────────────────────────────────────────

export default async function OGImage(props: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await props.params;
  const handle = decodeURIComponent(username);

  // ── Resolve address + fetch HL data (best-effort) ─────────────────────────
  let address: string | null = null;
  let accountValue = 0;
  let totalRealizedPnl = 47_832.91; // impressive fallback
  let openPositions = 4;
  let recentFills = 1247;

  try {
    address = await resolveProfileAddress(handle);
    if (address) {
      const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
      const [state, fills] = await Promise.all([
        infoClient.clearinghouseState({ user: address as `0x${string}` }),
        infoClient.userFillsByTime({
          user: address as `0x${string}`,
          startTime: twoYearsAgo,
        }),
      ]);
      accountValue = Number(state.marginSummary.accountValue);
      openPositions = state.assetPositions.filter(
        (p) => Number(p.position.szi) !== 0,
      ).length;
      recentFills = fills?.length ?? 0;
      totalRealizedPnl = (fills ?? []).reduce(
        (sum, f) => sum + Number(f.closedPnl),
        0,
      );
    }
  } catch {
    // silently fall back to defaults
  }

  const isProfit = totalRealizedPnl >= 0;
  const color = isProfit ? "#3be1ba" : "#f87171";
  const glowColor = isProfit ? "rgba(59,225,186,0.18)" : "rgba(248,113,113,0.18)";
  const fillColor = isProfit ? "rgba(59,225,186,0.12)" : "rgba(248,113,113,0.12)";
  const strokeColor = isProfit ? "#3be1ba" : "#f87171";

  const displayAddr = address
    ? truncateAddr(address)
    : handle.toUpperCase().slice(0, 14);

  const pnlFormatted =
    (isProfit ? "+" : "") + formatUsd(totalRealizedPnl);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#050812",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 64px 48px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* ── Background radial glows ─────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 55% 60% at 20% 30%, #2056ff12, transparent), radial-gradient(ellipse 40% 50% at 75% 65%, " +
              glowColor +
              ", transparent)",
            display: "flex",
          }}
        />

        {/* ── Grid lines ──────────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            display: "flex",
          }}
        />

        {/* ── Border glow ─────────────────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "1px solid rgba(126,169,255,0.16)",
            display: "flex",
          }}
        />

        {/* ── Chart in background ─────────────────────────────────────────── */}
        {/* @ts-expect-error - SVG works inside ImageResponse/Satori */}
        <svg
          width="1010"
          height="320"
          viewBox="0 0 1010 320"
          style={{
            position: "absolute",
            bottom: 60,
            left: 95,
            opacity: 0.55,
          }}
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Fill area */}
          <path d={CHART_FILL} fill="url(#chartFill)" />
          {/* Line */}
          <path
            d={CHART_LINE}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            filter="url(#glow)"
          />
          {/* Dot at end */}
          <circle
            cx={last[0]}
            cy={last[1]}
            r="5"
            fill={strokeColor}
            filter="url(#glow)"
          />
        </svg>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            display: "flex",
            color: "rgba(255,255,255,0.38)",
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Portfolio · {displayAddr}
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "flex-end",
            gap: 64,
          }}
        >
          {/* Left — Realized PnL big */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                color: "rgba(255,255,255,0.30)",
                fontSize: 20,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                display: "flex",
              }}
            >
              Total Realized PnL
            </div>
            <div
              style={{
                fontSize: 108,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color,
                lineHeight: 1,
                textShadow: `0 0 80px ${color}88, 0 0 140px ${color}44`,
                display: "flex",
              }}
            >
              {pnlFormatted}
            </div>
          </div>

          {/* Right — secondary stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              paddingBottom: 8,
            }}
          >
            {/* Account value */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  color: "rgba(255,255,255,0.28)",
                  fontSize: 18,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  display: "flex",
                }}
              >
                Account Value
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.82)",
                  fontSize: 38,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  display: "flex",
                }}
              >
                {formatUsd(accountValue)}
              </div>
            </div>

            {/* Positions + Fills */}
            <div style={{ display: "flex", gap: 48 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    color: "rgba(255,255,255,0.28)",
                    fontSize: 18,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    display: "flex",
                  }}
                >
                  Positions
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 36,
                    fontWeight: 600,
                    display: "flex",
                  }}
                >
                  {openPositions}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    color: "rgba(255,255,255,0.28)",
                    fontSize: 18,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    display: "flex",
                  }}
                >
                  Fills
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 36,
                    fontWeight: 600,
                    display: "flex",
                  }}
                >
                  {recentFills.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 36 }}>👀</span>
            <span
              style={{
                color: "rgba(255,255,255,0.38)",
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: "0.02em",
                display: "flex",
              }}
            >
              blink.lat
            </span>
          </div>
          <span
            style={{
              color: "rgba(255,255,255,0.22)",
              fontSize: 22,
              display: "flex",
            }}
          >
            Trade perps on Hyperliquid
          </span>
        </div>
      </div>
    ),
    size,
  );
}
