import { env } from "~/env";

import { getProfileSlugByWalletAddress } from "./resolve-address";

function getCanonicalAppUrl() {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function postDiscordWebhook(payload: Record<string, unknown>) {
  if (!env.DISCORD_SIGHTINGS_WEBHOOK_URL) return;

  const response = await fetch(env.DISCORD_SIGHTINGS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4_000),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed with status ${response.status}`);
  }
}

export async function sendDiscordProfileVerificationSighting(params: {
  walletAddress: string;
  twitterName?: string | null;
  twitterUsername: string;
}) {
  const normalizedWallet = params.walletAddress.toLowerCase();
  const profileSlug =
    (await getProfileSlugByWalletAddress(normalizedWallet)) ?? normalizedWallet;
  const profileUrl = `${getCanonicalAppUrl()}/profile/${encodeURIComponent(profileSlug)}`;
  const displayName =
    params.twitterName?.trim() || `@${params.twitterUsername}`;

  await postDiscordWebhook({
    content: "👀 New Blink sighting",
    embeds: [
      {
        title: `${displayName} just verified on Blink`,
        description:
          "A trader just claimed X ownership and unlocked stronger social proof on their public Blink profile.",
        url: profileUrl,
        color: 0x38bdf8,
        thumbnail: {
          url: `https://avatar.vercel.sh/${encodeURIComponent(params.twitterUsername)}.png?size=160`,
        },
        fields: [
          {
            name: "Profile",
            value: `[Open profile](${profileUrl})`,
            inline: true,
          },
          {
            name: "X handle",
            value: `[@${params.twitterUsername}](https://x.com/${params.twitterUsername})`,
            inline: true,
          },
          {
            name: "Wallet",
            value: `\`${truncateAddress(normalizedWallet)}\``,
            inline: true,
          },
        ],
        footer: {
          text: "Blink sightings",
        },
      },
    ],
  });
}
