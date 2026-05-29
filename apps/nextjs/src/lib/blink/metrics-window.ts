export type MetricsWindowDays = number | "lifetime";

export function isLifetimeMetricsWindow(
  windowDays: MetricsWindowDays,
): windowDays is "lifetime" {
  return windowDays === "lifetime";
}

export function metricsWindowLabel(windowDays: MetricsWindowDays) {
  if (windowDays === "lifetime") return "lifetime";
  if (windowDays === 1) return "today";
  if (windowDays === 7) return "7d";
  if (windowDays === 30) return "30d";
  return "90d";
}
