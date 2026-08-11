"use client";

import { avatarInitials, vercelAvatarUrl } from "@/lib/vercel-avatar";

export function PersonAvatar({
  id,
  name,
  pfpUrl,
  size = 40,
}: {
  id: string;
  name?: string | null;
  /**
   * Optional avatar.vercel.sh seed override (not a custom image URL).
   * HTTP(S) values are ignored — internal tools always use Vercel avatars.
   * @see https://github.com/vercel/avatar
   */
  pfpUrl?: string | null;
  size?: number;
}) {
  const override =
    pfpUrl && !/^https?:\/\//i.test(pfpUrl.trim()) ? pfpUrl.trim() : null;
  const seed = (override || name || id || "circle").replace(/^@/, "");
  const src = vercelAvatarUrl(seed, {
    size: size * 2,
    rounded: true,
    text: avatarInitials(name || seed),
  });

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-white/15 object-cover bg-[#141414]"
      style={{ width: size, height: size }}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
