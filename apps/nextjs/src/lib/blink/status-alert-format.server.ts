import { BUILDER_ADDRESS } from "./builder";
import { infoClient } from "./hyperliquid";
import type { SystemHealthReport } from "./system-health.types";

const CHECK_LABELS: Record<keyof SystemHealthReport["checks"], string> = {
  blinkApi: "Blink API",
  hyperliquidRest: "Hyperliquid REST",
  hyperliquidWebSocket: "Hyperliquid WebSocket",
  neonDatabase: "Neon database",
};

const ENV_NAME_PATTERN =
  /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b(?:DATABASE|AUTH|PRIVY|DISCORD|STRIPE|TWITTER|SECRET|TOKEN|PASSWORD|WEBHOOK)[_A-Z0-9]*\b/g;

/** Strip env var names and other sensitive tokens from text shown in Discord. */
export function sanitizeHealthDetail(detail: string) {
  const trimmed = detail.trim();
  if (!trimmed) return "Check failed";

  if (ENV_NAME_PATTERN.test(trimmed)) {
    ENV_NAME_PATTERN.lastIndex = 0;
    const withoutEnvNames = trimmed
      .replace(ENV_NAME_PATTERN, "configuration")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (/configuration/i.test(withoutEnvNames)) {
      if (/not configured|missing|unset/i.test(trimmed)) {
        return "Required configuration is missing";
      }
      if (/unauthorized|forbidden|401|403/i.test(trimmed)) {
        return "Authentication failed";
      }
      if (/timeout|timed out|ETIMEDOUT|ECONNREFUSED/i.test(trimmed)) {
        return "Connection timed out";
      }
      return "Service check failed";
    }
  }

  return trimmed.slice(0, 280);
}

export function formatCheckLabel(name: keyof SystemHealthReport["checks"]) {
  return CHECK_LABELS[name] ?? name;
}

export function formatFailingChecks(report: SystemHealthReport) {
  const lines = Object.entries(report.checks)
    .filter(([, check]) => check.status === "error")
    .map(([name, check]) => {
      const label = formatCheckLabel(name as keyof SystemHealthReport["checks"]);
      const detail = sanitizeHealthDetail(check.detail ?? "Check failed");
      return `• **${label}** — ${detail}`;
    });

  return lines.length > 0 ? lines.join("\n") : "No failing checks reported.";
}

function parseBtcMidFromRestDetail(detail: string | undefined) {
  if (!detail) return null;
  const match = /BTC\s+([\d,.]+)/i.exec(detail);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function parseBlinkApiSummary(detail: string | undefined) {
  if (!detail) return null;
  const feeMatch = /builder-fee\s+(\d+)u/i.exec(detail);
  const proMatch = /pro=(yes|no)/i.exec(detail);
  if (!feeMatch) return null;
  const parts = [`fee ${feeMatch[1]}u`];
  if (proMatch) parts.push(proMatch[1] === "yes" ? "Pro tier" : "standard tier");
  return parts.join(" · ");
}

export function getDeployRegion() {
  return (
    process.env.VERCEL_REGION ??
    process.env.CF_REGION ??
    process.env.AWS_REGION ??
    null
  );
}

export async function buildStatusAlertContext(report: SystemHealthReport) {
  const region = getDeployRegion();
  const btcMid = parseBtcMidFromRestDetail(report.checks.hyperliquidRest.detail);
  const blinkApiSummary = parseBlinkApiSummary(report.checks.blinkApi.detail);

  let builderBalanceUsd: number | null = null;
  if (report.checks.hyperliquidRest.status === "ok") {
    try {
      const state = await infoClient.clearinghouseState({
        user: BUILDER_ADDRESS,
      });
      const value = Number(state?.marginSummary?.accountValue ?? 0);
      builderBalanceUsd = Number.isFinite(value) ? value : null;
    } catch {
      builderBalanceUsd = null;
    }
  }

  const latencies = Object.entries(report.checks)
    .map(([name, check]) => ({
      label: formatCheckLabel(name as keyof SystemHealthReport["checks"]),
      durationMs: check.durationMs,
      status: check.status,
    }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 4)
    .map(
      (entry) =>
        `${entry.label}: ${entry.durationMs}ms (${entry.status === "ok" ? "ok" : "fail"})`,
    )
    .join("\n");

  return {
    region,
    btcMid,
    blinkApiSummary,
    builderBalanceUsd,
    latencies,
    uptimePct: report.uptime.uptimePct,
    incidentCount: report.uptime.incidentCount,
  };
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function formatBtcMid(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}
