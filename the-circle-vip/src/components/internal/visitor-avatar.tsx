"use client";

import type { VisitorPin } from "@/lib/traffic-live-types";
import { avatarInitials, vercelAvatarUrl } from "@/lib/vercel-avatar";

function DeviceIcon({
  device,
  className,
}: {
  device: VisitorPin["device"];
  className?: string;
}) {
  if (device === "mobile") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="7"
          y="3"
          width="10"
          height="18"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="12" cy="17.5" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  if (device === "tablet") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="5"
          y="3"
          width="14"
          height="18"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="12" cy="17.5" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 19h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VisitorAvatar({
  pin,
  size = 36,
  showBadge = true,
}: {
  pin: Pick<
    VisitorPin,
    "id" | "shortId" | "hue" | "device" | "country" | "platform"
  > & { visitorId?: string };
  size?: number;
  showBadge?: boolean;
}) {
  const seed = pin.visitorId || pin.id || pin.shortId;
  const src = vercelAvatarUrl(seed, {
    size: size * 2,
    rounded: true,
    text: avatarInitials(pin.shortId),
  });

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={`${pin.shortId} · ${pin.platform}`}
    >
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-full border border-white/15 object-cover bg-[#141414]"
        style={{ width: size, height: size }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <span className="absolute -right-0.5 -bottom-0.5 flex h-[42%] w-[42%] items-center justify-center rounded-full border border-[#0a0a0a] bg-[#141414] text-[#d4d4d8]">
        <DeviceIcon device={pin.device} className="h-[70%] w-[70%]" />
      </span>
      {showBadge ? (
        <span className="absolute -top-1 -left-1 rounded bg-black/70 px-1 text-[8px] font-bold tracking-wide text-white uppercase">
          {pin.country}
        </span>
      ) : null}
    </span>
  );
}
