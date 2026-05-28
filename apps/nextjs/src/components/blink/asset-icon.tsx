"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

// ── Colour palette for fallback initials ─────────────────────────────────────
// Deterministic per-symbol so the colour never changes on re-render.
const PALETTE = [
  "#2c6bff", // blue
  "#9b5de5", // purple
  "#f15bb5", // pink
  "#00bbf9", // cyan
  "#00f5d4", // teal
  "#fee440", // yellow
  "#fb5607", // orange
  "#3a86ff", // cornflower
];

function symbolColor(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index] ?? PALETTE[0];
}

// ── Well-known overrides ──────────────────────────────────────────────────────
// Map ticker → CoinGecko asset id for the few coins whose CoinGecko ID differs
// significantly from the ticker, or where we want a guaranteed high-res icon.
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  DOT: "polkadot",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  OP: "optimism",
  ARB: "arbitrum",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  WIF: "dogwifcoin",
  BONK: "bonk",
  HYPE: "hyperliquid",
  TIA: "celestia",
  SEI: "sei-network",
  SUI: "sui",
  APT: "aptos",
  INJ: "injective-protocol",
  ATOM: "cosmos",
  NEAR: "near",
  FTM: "fantom",
  CRV: "curve-dao-token",
  MKR: "maker",
  LDO: "lido-dao",
  RUNE: "thorchain",
  STRK: "starknet",
  JTO: "jito-governance-token",
  PYTH: "pyth-network",
  W: "wormhole",
  ENA: "ethena",
  EIGEN: "eigenlayer",
  ZK: "zksync",
  POPCAT: "popcat",
  MOODENG: "moo-deng",
  PNUT: "peanut-the-squirrel",
};

const HIP3_COMPANY_LOGO_DOMAINS: Record<string, string> = {
  AAPL: "apple.com",
  APPL: "apple.com",
  AMZN: "amazon.com",
  AMD: "amd.com",
  ANTHROPIC: "anthropic.com",
  ASML: "asml.com",
  AVGO: "broadcom.com",
  GOOGL: "google.com",
  HOOD: "robinhood.com",
  INTC: "intel.com",
  META: "meta.com",
  MSFT: "microsoft.com",
  MU: "micron.com",
  NVDA: "nvidia.com",
  OPENAI: "openai.com",
  SNDK: "sandisk.com",
  TSLA: "tesla.com",
  TSM: "tsmc.com",
  GOLD: "gold.org",
  XAU: "gold.org",
  SP500: "spglobal.com",
  US500: "spglobal.com",
  USA500: "spglobal.com",
  SPX: "spglobal.com",
  MAG7: "roundhillinvestments.com",
  USTECH: "nasdaq.com",
  USA100: "nasdaq.com",
  NAS100: "nasdaq.com",
};

const SYMBOL_ALIASES: Record<string, string> = {
  APPL: "AAPL",
  SPX500: "SP500",
  SPX: "SP500",
  XAUUSD: "XAU",
  GOLDUSD: "GOLD",
  NASDAQ100: "USA100",
  NDX: "USA100",
};

const HIP3_BADGE_OVERRIDES: Record<
  string,
  { bg: string; fg?: string; label: string }
> = {
  BRENTOIL: { label: "BR", bg: "#0f766e" },
  BTCD: { label: "D", bg: "#6b21a8" },
  CL: { label: "CL", bg: "#155e75" },
  DRAM: { label: "DR", bg: "#2563eb" },
  GOLD: { label: "AU", bg: "#ca8a04", fg: "#201300" },
  H100: { label: "H1", bg: "#0f766e" },
  MAG7: { label: "M7", bg: "#7c3aed" },
  OTHERS: { label: "OT", bg: "#334155" },
  SEMIS: { label: "CH", bg: "#1d4ed8" },
  SP500: { label: "500", bg: "#1d4ed8" },
  TOTAL2: { label: "T2", bg: "#0f766e" },
  USA100: { label: "100", bg: "#1e3a8a" },
  USA500: { label: "500", bg: "#1d4ed8" },
  US500: { label: "500", bg: "#1d4ed8" },
  USBOND: { label: "10Y", bg: "#475569" },
  USTECH: { label: "Q", bg: "#0f766e" },
  WTI: { label: "WTI", bg: "#155e75" },
  XYZ100: { label: "X1", bg: "#4338ca" },
};

// Primary source: cryptocurrency-icons via npm CDN (pinned, stable)
function cryptoIconUrl(symbol: string) {
  return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${symbol.toLowerCase()}.svg`;
}

// Fallback: CoinGecko thumb (PNG, reliable but slower)
function coinGeckoUrl(symbol: string) {
  const id = COINGECKO_IDS[symbol.toUpperCase()] ?? symbol.toLowerCase();
  return `https://assets.coingecko.com/coins/images/1/thumb/${id}.png`;
}

function companyLogoUrl(symbol: string) {
  const domain = HIP3_COMPANY_LOGO_DOMAINS[symbol];
  return domain ? `https://logo.clearbit.com/${domain}` : null;
}

function badgeLogoUrl(symbol: string) {
  const override = HIP3_BADGE_OVERRIDES[symbol];
  const label = override?.label ?? symbol.slice(0, Math.min(symbol.length, 3));
  const bg = override?.bg ?? symbolColor(symbol);
  const fg = override?.fg ?? "#f8fbff";
  const fontSize = label.length >= 4 ? 18 : label.length === 3 ? 22 : 26;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bg}" stop-opacity="1" />
          <stop offset="100%" stop-color="#060b16" stop-opacity="1" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill="url(#g)" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2" />
      <text x="32" y="38" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">
        ${label}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getAssetIconSources(asset: string) {
  const rawSymbol = asset.includes(":")
    ? (asset.split(":").at(-1)?.toUpperCase() ?? asset.toUpperCase())
    : asset.toUpperCase();
  const normalizedSymbol = rawSymbol.replace(/[^A-Z0-9]/g, "");
  const symbol = SYMBOL_ALIASES[normalizedSymbol] ?? normalizedSymbol;
  const isHip3 = asset.includes(":");
  const sources: string[] = [];

  const companyLogo = companyLogoUrl(symbol);
  if (companyLogo) {
    sources.push(companyLogo);
  }

  if (!isHip3 || COINGECKO_IDS[symbol]) {
    sources.push(cryptoIconUrl(symbol), coinGeckoUrl(symbol));
  }

  if (isHip3) {
    sources.push(badgeLogoUrl(symbol));
    if (!COINGECKO_IDS[symbol]) {
      sources.push(cryptoIconUrl(symbol), coinGeckoUrl(symbol));
    }
  }

  return [...new Set(sources)];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AssetIconProps {
  asset: string;
  className?: string;
  size?: number;
}

function AssetIconImage({ asset, className = "size-7", size }: AssetIconProps) {
  const rawSymbol = asset.includes(":")
    ? (asset.split(":").at(-1)?.toUpperCase() ?? asset.toUpperCase())
    : asset.toUpperCase();
  const normalizedSymbol = rawSymbol.replace(/[^A-Z0-9]/g, "");
  const symbol = SYMBOL_ALIASES[normalizedSymbol] ?? normalizedSymbol;
  const [sourceIndex, setSourceIndex] = useState(0);

  const color = symbolColor(symbol);
  const initials = symbol.slice(0, 2);
  const sizeStyle: CSSProperties | undefined = size
    ? {
        height: size,
        width: size,
      }
    : undefined;
  const sources = getAssetIconSources(asset);

  // Both image sources failed → render initials avatar
  if (sourceIndex >= sources.length) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold uppercase leading-none ${className}`}
        style={{ ...sizeStyle, backgroundColor: color, fontSize: "0.5em" }}
        aria-label={symbol}
      >
        {initials}
      </span>
    );
  }

  const src = sources[sourceIndex] ?? sources[0];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={sizeStyle}
      onError={() => setSourceIndex((current) => current + 1)}
    />
  );
}

export function AssetIcon(props: AssetIconProps) {
  return <AssetIconImage key={props.asset} {...props} />;
}
