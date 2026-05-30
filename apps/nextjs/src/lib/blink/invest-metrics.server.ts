const DEFILLAMA_FEES_URL = "https://api.llama.fi/summary/fees/blink-perps";
const DEFILLAMA_PROTOCOL_URL =
  "https://defillama.com/protocol/blink-perps";

type DefiLlamaFeesSummary = {
  total24h?: number;
  total7d?: number;
  total30d?: number;
  totalAllTime?: number;
  name?: string;
  description?: string;
  category?: string;
  chain?: string;
  twitter?: string;
};

export type InvestTractionMetrics = {
  sourceUrl: string;
  protocolName: string;
  description: string;
  fees24h: number;
  fees7d: number;
  fees30d: number;
  feesAllTime: number;
  feesAnnualized: number;
  /** DefiLlama public page — full volume + charts */
  defillamaUrl: string;
  fetchedAt: string;
};

function annualizeFrom30d(total30d: number) {
  if (total30d <= 0) return 0;
  return (total30d / 30) * 365;
}

export function formatInvestUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value >= 1) return `$${value.toFixed(0)}`;
  return `$${value.toFixed(2)}`;
}

export async function getInvestTractionMetrics(): Promise<InvestTractionMetrics> {
  const fallback: InvestTractionMetrics = {
    sourceUrl: DEFILLAMA_FEES_URL,
    protocolName: "Blink Perps",
    description:
      "Social-first Hyperliquid perps frontend using builder codes.",
    fees24h: 0,
    fees7d: 0,
    fees30d: 0,
    feesAllTime: 0,
    feesAnnualized: 0,
    defillamaUrl: DEFILLAMA_PROTOCOL_URL,
    fetchedAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(DEFILLAMA_FEES_URL, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return fallback;

    const json = (await response.json()) as DefiLlamaFeesSummary;
    const fees30d = Number(json.total30d ?? 0);

    return {
      sourceUrl: DEFILLAMA_FEES_URL,
      protocolName: json.name ?? fallback.protocolName,
      description: json.description ?? fallback.description,
      fees24h: Number(json.total24h ?? 0),
      fees7d: Number(json.total7d ?? 0),
      fees30d,
      feesAllTime: Number(json.totalAllTime ?? 0),
      feesAnnualized: annualizeFrom30d(fees30d),
      defillamaUrl: DEFILLAMA_PROTOCOL_URL,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return fallback;
  }
}
