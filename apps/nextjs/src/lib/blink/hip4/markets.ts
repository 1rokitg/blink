import { infoClient } from "../hyperliquid";

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

type OutcomeMetaResponse = {
  outcomes: Array<{
    description: string;
    name: string;
    outcome: number;
    sideSpecs: Array<{
      name: string;
    }>;
  }>;
  questions: Array<{
    name?: string;
  }>;
};

export type OutcomeSide = {
  assetId: number;
  balanceCoin: string;
  mid: number | null;
  name: string;
  probabilityPct: number | null;
  side: 0 | 1;
  tradeCoin: string;
};

export type OutcomeMarket = {
  expiryIso: string | null;
  expiryLabel: string | null;
  marketClass: string | null;
  name: string;
  no: OutcomeSide;
  outcome: number;
  period: string | null;
  rawDescription: string;
  slug: string;
  subtitle: string;
  targetPrice: number | null;
  title: string;
  underlying: string | null;
  yes: OutcomeSide;
};

function buildOutcomeSlug(input: {
  expiryLabel: string | null;
  outcome: number;
  targetPrice: number | null;
  underlying: string | null;
}) {
  const base = [
    input.underlying?.toLowerCase() ?? "outcome",
    input.targetPrice !== null
      ? String(input.targetPrice).replace(/\./g, "-")
      : null,
    input.expiryLabel
      ?.replace(/\s+/g, "-")
      .replace(/[:,/()]/g, "")
      .toLowerCase() ?? null,
    String(input.outcome),
  ]
    .filter(Boolean)
    .join("-");

  return base || `outcome-${input.outcome}`;
}

export function encodeOutcomeCoin(outcome: number, side: 0 | 1) {
  return `#${outcome * 10 + side}`;
}

export function encodeOutcomeBalanceCoin(outcome: number, side: 0 | 1) {
  return `+${outcome * 10 + side}`;
}

export function encodeOutcomeAssetId(outcome: number, side: 0 | 1) {
  return 100_000_000 + outcome * 10 + side;
}

function formatOutcomeExpiry(date: Date | null) {
  if (!date) return null;

  return `${new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function parseOutcomeExpiry(value: string | undefined) {
  if (!value) return null;

  const match = value.match(
    /^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})-(?<hour>\d{2})(?<minute>\d{2})$/,
  );

  if (!match?.groups) return null;

  const { day, hour, minute, month, year } = match.groups;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    ),
  );
}

function parseOutcomeDescription(raw: string) {
  const parts = raw.split("|");
  const fields = new Map<string, string>();

  for (const part of parts) {
    const separatorIndex = part.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = part.slice(0, separatorIndex);
    const value = part.slice(separatorIndex + 1);
    fields.set(key, value);
  }

  const expiry = parseOutcomeExpiry(fields.get("expiry"));
  const targetPriceRaw = fields.get("targetPrice");
  const targetPrice =
    targetPriceRaw && Number.isFinite(Number(targetPriceRaw))
      ? Number(targetPriceRaw)
      : null;

  return {
    expiry,
    expiryIso: expiry?.toISOString() ?? null,
    expiryLabel: formatOutcomeExpiry(expiry),
    marketClass: fields.get("class") ?? null,
    period: fields.get("period") ?? null,
    targetPrice,
    underlying: fields.get("underlying") ?? null,
  };
}

function buildOutcomeCopy(params: {
  expiryLabel: string | null;
  name: string;
  targetPrice: number | null;
  underlying: string | null;
}) {
  if (params.underlying && params.targetPrice !== null) {
    return {
      subtitle: params.expiryLabel
        ? `Settles ${params.expiryLabel}`
        : "Binary outcome market",
      title: `${params.underlying} above ${params.targetPrice}`,
    };
  }

  return {
    subtitle: params.expiryLabel
      ? `Settles ${params.expiryLabel}`
      : "Binary outcome market",
    title: params.name,
  };
}

async function fetchOutcomeMeta(): Promise<OutcomeMetaResponse> {
  const response = await fetch(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ type: "outcomeMeta" }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch outcomeMeta (${response.status})`);
  }

  return (await response.json()) as OutcomeMetaResponse;
}

function buildOutcomeSide(params: {
  mids: Record<string, string>;
  outcome: number;
  side: 0 | 1;
  sideName: string;
}): OutcomeSide {
  const tradeCoin = encodeOutcomeCoin(params.outcome, params.side);
  const rawMid = params.mids[tradeCoin];
  const mid =
    rawMid !== undefined && Number.isFinite(Number(rawMid))
      ? Number(rawMid)
      : null;

  return {
    assetId: encodeOutcomeAssetId(params.outcome, params.side),
    balanceCoin: encodeOutcomeBalanceCoin(params.outcome, params.side),
    mid,
    name: params.sideName,
    probabilityPct: mid !== null ? mid * 100 : null,
    side: params.side,
    tradeCoin,
  };
}

export async function fetchHip4Markets(): Promise<OutcomeMarket[]> {
  const [{ outcomes }, mids] = await Promise.all([
    fetchOutcomeMeta(),
    infoClient.allMids() as Promise<Record<string, string>>,
  ]);

  return outcomes
    .map((outcome) => {
      const parsed = parseOutcomeDescription(outcome.description);
      const { subtitle, title } = buildOutcomeCopy({
        expiryLabel: parsed.expiryLabel,
        name: outcome.name,
        targetPrice: parsed.targetPrice,
        underlying: parsed.underlying,
      });

      const yes = buildOutcomeSide({
        mids,
        outcome: outcome.outcome,
        side: 0,
        sideName: outcome.sideSpecs[0]?.name ?? "Yes",
      });
      const no = buildOutcomeSide({
        mids,
        outcome: outcome.outcome,
        side: 1,
        sideName: outcome.sideSpecs[1]?.name ?? "No",
      });

      return {
        expiryIso: parsed.expiryIso,
        expiryLabel: parsed.expiryLabel,
        marketClass: parsed.marketClass,
        name: outcome.name,
        no,
        outcome: outcome.outcome,
        period: parsed.period,
        rawDescription: outcome.description,
        slug: buildOutcomeSlug({
          expiryLabel: parsed.expiryLabel,
          outcome: outcome.outcome,
          targetPrice: parsed.targetPrice,
          underlying: parsed.underlying,
        }),
        subtitle,
        targetPrice: parsed.targetPrice,
        title,
        underlying: parsed.underlying,
        yes,
      } satisfies OutcomeMarket;
    })
    .filter((market) => market.marketClass === "priceBinary")
    .sort((left, right) => {
      const leftExpiry = left.expiryIso
        ? new Date(left.expiryIso).getTime()
        : Number.POSITIVE_INFINITY;
      const rightExpiry = right.expiryIso
        ? new Date(right.expiryIso).getTime()
        : Number.POSITIVE_INFINITY;

      return leftExpiry - rightExpiry;
    });
}
