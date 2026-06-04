/**
 * Cloudflare Hyperdrive + node-postgres often return timestamp columns as strings,
 * not Date objects. Never call `.toISOString()` directly on Drizzle row fields
 * that cross a server action / RSC boundary — use these helpers instead.
 */
function coerceDate(value: unknown): Date | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    const candidate = value as {
      getTime?: () => number;
      toISOString?: () => string;
    };

    if (typeof candidate.toISOString === "function") {
      try {
        const iso = candidate.toISOString();
        if (typeof iso === "string" && iso.length > 0) {
          const parsed = new Date(iso);
          if (!Number.isNaN(parsed.getTime())) return parsed;
        }
      } catch {
        // fall through
      }
    }

    if (typeof candidate.getTime === "function") {
      const ms = candidate.getTime();
      if (!Number.isNaN(ms)) return new Date(ms);
    }

    const asString = String(value);
    if (asString && asString !== "[object Object]") {
      const parsed = new Date(asString);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
}

export function toDate(value: unknown): Date | null {
  return coerceDate(value);
}

export function toIsoTimestamp(
  value: unknown,
  fallback?: string,
): string | null {
  if (value == null) return fallback ?? null;

  const date = coerceDate(value);
  if (date) return date.toISOString();

  if (typeof value === "string" && value.length > 0) return value;

  return fallback ?? null;
}

/** Strip non-JSON values before server action / RSC boundaries. */
export function toJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
