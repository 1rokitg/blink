/** Resolve `?price=mid` or `?price=70,000` for intent limit links. */
export function parseIntentLimitPrice(
  param: string | undefined,
  midPrice: number,
): number {
  const raw = (param ?? "mid").trim().toLowerCase();
  if (raw === "mid" || raw === "mark") {
    return midPrice;
  }
  const cleaned = raw.replace(/,/g, "");
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return midPrice;
  }
  return parsed;
}
