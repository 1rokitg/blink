/**
 * Cloudflare Hyperdrive + node-postgres often return timestamp columns as strings,
 * not Date objects. Never call `.toISOString()` directly on Drizzle row fields
 * that cross a server action / RSC boundary — use these helpers instead.
 */
export function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function toIsoTimestamp(
  value: Date | string | number | null | undefined,
  fallback?: string,
): string | null {
  if (value == null) return fallback ?? null;
  const date = toDate(value);
  if (date) return date.toISOString();
  if (typeof value === "string" && value.length > 0) return value;
  return fallback ?? null;
}
