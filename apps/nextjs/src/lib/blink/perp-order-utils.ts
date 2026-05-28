/** Hyperliquid perp price rounding (5 sig figs, decimal cap). */
export function getHyperliquidPerpPriceDecimals(
  price: number,
  szDecimals: number,
) {
  const finitePrice = Number.isFinite(price) && price > 0 ? price : 1;
  const magnitude = Math.floor(Math.log10(Math.abs(finitePrice)));
  const sigDecimals = Math.max(0, 5 - magnitude - 1);
  const bySizeDecimals = Math.max(0, 6 - Math.max(0, szDecimals));
  return Math.max(0, Math.min(sigDecimals, bySizeDecimals));
}

export function roundWithMode(
  value: number,
  decimals: number,
  mode: "up" | "down" | "nearest",
) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const factor = 10 ** Math.max(0, decimals);
  const scaled = value * factor;
  const rounded =
    mode === "up"
      ? Math.ceil(scaled)
      : mode === "down"
        ? Math.floor(scaled)
        : Math.round(scaled);
  const normalized = (rounded / factor).toFixed(Math.max(0, decimals));
  return normalized.replace(/\.?0+$/, "");
}
