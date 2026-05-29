export type AdminRange =
  | "5m"
  | "15m"
  | "1h"
  | "1d"
  | "7d"
  | "30d"
  | "90d"
  | "lifetime";

export type AdminMetricsWindow = 1 | 7 | 30 | 90 | "lifetime";
