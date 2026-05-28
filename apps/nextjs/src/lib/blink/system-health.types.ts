export type HealthCheckStatus = "ok" | "error";

export type HealthCheckResult = {
  detail?: string;
  durationMs: number;
  status: HealthCheckStatus;
};

export type SystemHealthReport = {
  checkedAt: string;
  status: "ok" | "degraded" | "outage";
  uptime: {
    coveragePct: number;
    degradedMinutes: number;
    downtimeMinutes: number;
    incidentCount: number;
    recoveryCount: number;
    timeline: Array<{
      day: string;
      status: "ok" | "degraded" | "outage" | "unknown";
    }>;
    unknownMinutes: number;
    uptimeMinutes: number;
    uptimePct: number;
    windowDays: number;
  };
  version: {
    sha: string;
  };
  checks: {
    neonDatabase: HealthCheckResult;
    hyperliquidRest: HealthCheckResult;
    hyperliquidWebSocket: HealthCheckResult;
    blinkApi: HealthCheckResult;
  };
};
