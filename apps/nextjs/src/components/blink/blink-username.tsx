"use client";

import { useUser } from "@privy-io/react-auth";

/**
 * Derives a human-readable display name and handle from the Privy user object.
 *
 * Priority for display name:
 *   1. Google name  (e.g. "Omar Rokit")
 *   2. Google email local part  (e.g. "omar" from omar@gmail.com)
 *   3. Privy email local part
 *   4. Twitter username
 *   5. Fallback "blink-user"
 *
 * user.email is { address: string } | null — NOT a string.
 * Rendering user.email directly causes React error #31.
 */
export function BlinkUsername() {
  const { user } = useUser();

  const googleName = user?.google?.name ?? null;
  const googleEmailLocal = user?.google?.email?.split("@")[0] ?? null;
  const privyEmailLocal = user?.email?.address?.split("@")[0] ?? null;
  const twitterHandle = user?.twitter?.username ?? null;

  const displayName =
    googleName ??
    googleEmailLocal ??
    privyEmailLocal ??
    twitterHandle ??
    "blink-user";

  const handle =
    twitterHandle ??
    googleEmailLocal ??
    privyEmailLocal ??
    "blink";

  return (
    <div className="pb-1">
      <p className="text-4xl font-semibold text-white">{displayName}</p>
      <p className="text-lg text-white/55">@{handle}</p>
    </div>
  );
}
