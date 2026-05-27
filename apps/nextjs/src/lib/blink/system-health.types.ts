export type HealthCheckStatus = "ok" | "error";

export type HealthCheckResult = {
  detail?: string;
  durationMs: number;
  status: HealthCheckStatus;
};

export type SystemHealthReport = {
  checkedAt: string;
  status: "ok" | "degraded" | "outage";
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
