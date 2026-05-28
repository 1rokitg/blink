import { postInfo } from "./hyperliquid";

export type PortfolioPeriodKey = "day" | "week" | "month" | "allTime";

export type PortfolioSnapshot = {
  accountValueHistory: [number, string][];
  pnlHistory: [number, string][];
  vlm: string;
};

export type UserPortfolio = Map<string, PortfolioSnapshot>;

export type ProfileEquityPeriod = "24H" | "7D" | "30D" | "ALL";

const PROFILE_PERIOD_TO_HL: Record<ProfileEquityPeriod, PortfolioPeriodKey> = {
  "24H": "day",
  "7D": "week",
  "30D": "month",
  ALL: "allTime",
};

export async function fetchUserPortfolio(
  user: `0x${string}`,
): Promise<UserPortfolio> {
  const rows = await postInfo<Array<[string, PortfolioSnapshot]>>({
    type: "portfolio",
    user,
  });

  return new Map(rows);
}

export function getPortfolioPeriod(
  portfolio: UserPortfolio,
  period: PortfolioPeriodKey,
): PortfolioSnapshot | undefined {
  return portfolio.get(period);
}

/** Net account value change over the selected HL portfolio window. */
export function getEquityChangeForPeriod(
  portfolio: UserPortfolio,
  period: PortfolioPeriodKey,
): number {
  const history = portfolio.get(period)?.accountValueHistory ?? [];
  if (history.length < 2) return 0;

  const start = Number(history[0]?.[1] ?? 0);
  const end = Number(history[history.length - 1]?.[1] ?? 0);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return end - start;
}

export function getEquityChangeForProfilePeriod(
  portfolio: UserPortfolio,
  period: ProfileEquityPeriod,
): number {
  return getEquityChangeForPeriod(portfolio, PROFILE_PERIOD_TO_HL[period]);
}

function formatChartLabel(timestamp: number, period: PortfolioPeriodKey) {
  const date = new Date(timestamp);
  if (period === "day") {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (period === "week") {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getEquityChartSeries(
  portfolio: UserPortfolio,
  period: ProfileEquityPeriod,
): Array<{ t: string; equity: number }> {
  const hlPeriod = PROFILE_PERIOD_TO_HL[period];
  const history = portfolio.get(hlPeriod)?.accountValueHistory ?? [];

  return history
    .map(([timestamp, value]) => ({
      t: formatChartLabel(timestamp, hlPeriod),
      equity: Number(value),
    }))
    .filter((point) => Number.isFinite(point.equity));
}

export function profilePeriodLabel(period: ProfileEquityPeriod) {
  switch (period) {
    case "24H":
      return "24h";
    case "7D":
      return "7d";
    case "30D":
      return "30d";
    default:
      return "all time";
  }
}
