/** Reliable ISO country flags via flagcdn (unicode RI symbols often render as letters). */
export function CountryFlag({
  code,
  size = 20,
  className = "",
}: {
  code: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const iso = (code ?? "").trim().toUpperCase();
  if (!iso || iso.length !== 2 || iso === "XX" || iso === "T1") {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-[3px] bg-[#262626] text-[10px] text-[#71717a] ${className}`}
        style={{ width: size, height: Math.round(size * 0.75) }}
        aria-hidden
      >
        ·
      </span>
    );
  }

  const height = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/w80/${iso.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w40/${iso.toLowerCase()}.png 1x, https://flagcdn.com/w80/${iso.toLowerCase()}.png 2x`}
      alt=""
      width={size}
      height={height}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ${className}`}
      style={{ width: size, height }}
    />
  );
}
