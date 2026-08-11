/**
 * Deterministic gradient pfps via Vercel Avatar.
 * @see https://github.com/vercel/avatar
 * @see https://avatar.vercel.sh/{seed}?size=&rounded=
 * SVG + text: https://avatar.vercel.sh/{seed}.svg?text=AB
 */
export function vercelAvatarUrl(
  seed: string,
  opts?: { size?: number; rounded?: boolean; text?: string },
) {
  const identifier =
    (seed || "circle").trim().replace(/^@/, "") || "circle";
  const path = encodeURIComponent(identifier);
  const size = Math.max(16, Math.min(512, Math.round(opts?.size ?? 120)));
  const params = new URLSearchParams({ size: String(size) });

  if (opts?.rounded !== false) {
    // Docs: set rounded to half size for a perfect circle.
    params.set("rounded", String(Math.round(size / 2)));
  }

  const text = opts?.text?.trim();
  if (text) {
    // `text` requires the .svg extension per vercel/avatar README.
    params.set("text", text.slice(0, 2).toUpperCase());
    return `https://avatar.vercel.sh/${path}.svg?${params.toString()}`;
  }

  return `https://avatar.vercel.sh/${path}?${params.toString()}`;
}

/** Initials for the optional `text` query (SVG only). */
export function avatarInitials(label: string | null | undefined) {
  const parts = (label || "")
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (parts[0] || "·").slice(0, 2).toUpperCase();
}
