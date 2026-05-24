"use client";

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

// Primary source: cryptocurrency-icons via npm CDN (pinned, stable)
function cryptoIconUrl(symbol: string) {
  return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${symbol.toLowerCase()}.svg`;
}

// Fallback: CoinGecko thumb (PNG, reliable but slower)
function coinGeckoUrl(symbol: string) {
  const id = COINGECKO_IDS[symbol.toUpperCase()] ?? symbol.toLowerCase();
  return `https://assets.coingecko.com/coins/images/1/thumb/${id}.png`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AssetIconProps {
  asset: string;
  className?: string;
}

export function AssetIcon({ asset, className = "size-7" }: AssetIconProps) {
  const symbol = asset.toUpperCase();
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const color = symbolColor(symbol);
  const initials = symbol.slice(0, 2);

  // Both image sources failed → render initials avatar
  if (fallbackFailed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold uppercase leading-none ${className}`}
        style={{ backgroundColor: color, fontSize: "0.5em" }}
        aria-label={symbol}
      >
        {initials}
      </span>
    );
  }

  const src = primaryFailed ? coinGeckoUrl(symbol) : cryptoIconUrl(symbol);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol}
      className={`shrink-0 rounded-full object-cover ${className}`}
      onError={() => {
        if (!primaryFailed) {
          setPrimaryFailed(true);
        } else {
          setFallbackFailed(true);
        }
      }}
    />
  );
}
