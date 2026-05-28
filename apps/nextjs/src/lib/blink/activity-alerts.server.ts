import { env } from "~/env";

import {
  getDiscordActivityWebhookUrl,
  postDiscordWebhook,
} from "./discord-webhook.server";
import { getProfileSlugByWalletAddress } from "./resolve-address";
import { getInternalUserPath } from "./wallet-address";

export const LIVE_ACTIVITY_EVENT_TYPES = [
  "signup",
  "builder_approved",
  "trading_enabled",
  "first_trade",
] as const;

export type LiveActivityEventType = (typeof LIVE_ACTIVITY_EVENT_TYPES)[number];

const ACTIVITY_LABELS: Record<
  LiveActivityEventType,
  { label: string; emoji: string; color: number }
> = {
  signup: { label: "Signup", emoji: "🟢", color: 0x3be1ba },
  builder_approved: { label: "Builder approved", emoji: "🔵", color: 0x7fa8ff },
  trading_enabled: {
    label: "Trading enabled",
    emoji: "⚡",
    color: 0x9ec0ff,
  },
  first_trade: { label: "First routed tx", emoji: "🟡", color: 0xffd166 },
};

function getCanonicalAppUrl() {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildDetailLine(input: {
  eventType: LiveActivityEventType;
  source?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const meta = input.metadata ?? {};
  const country = metadataString(meta, "country");
  const market =
    metadataString(meta, "market") ?? metadataString(meta, "firstMarket");
  const side = metadataString(meta, "side");
  const orderType = metadataString(meta, "orderType");
  const maxFeeRate = metadataString(meta, "maxFeeRate");
  const parts = [
    country,
    input.source,
    market ? `market ${market}` : null,
    side && orderType ? `${side} ${orderType}` : side,
    maxFeeRate ? `fee ${maxFeeRate}` : null,
  ].filter(Boolean);

  const agentName = metadataString(meta, "agentName");
  if (input.eventType === "trading_enabled" && agentName) {
    return `Agent ${agentName} approved · one-click trading live`;
  }

  if (input.eventType === "builder_approved" && maxFeeRate) {
    return `Builder fee approved · ${maxFeeRate}`;
  }

  if (input.eventType === "first_trade" && market) {
    return `First Blink-routed trade · ${market}${side ? ` · ${side}` : ""}`;
  }

  return parts.length > 0 ? parts.join(" · ") : "New platform activity";
}

export function isLiveActivityEventType(
  eventType: string,
): eventType is LiveActivityEventType {
  return LIVE_ACTIVITY_EVENT_TYPES.includes(eventType as LiveActivityEventType);
}

export async function notifyLiveActivityAlert(input: {
  eventType: LiveActivityEventType;
  walletAddress: string;
  source?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const webhookUrl = getDiscordActivityWebhookUrl();
  if (!webhookUrl) return;

  const walletAddress = input.walletAddress.toLowerCase();
  const config = ACTIVITY_LABELS[input.eventType];
  const profileSlug =
    (await getProfileSlugByWalletAddress(walletAddress)) ?? walletAddress;
  const profileUrl = `${getCanonicalAppUrl()}/profile/${encodeURIComponent(profileSlug)}`;
  const internalUrl = `${getCanonicalAppUrl()}${getInternalUserPath(walletAddress)}`;
  const pingPrefix = env.DISCORD_ACTIVITY_PING_USER_ID
    ? `<@${env.DISCORD_ACTIVITY_PING_USER_ID}> `
    : "";

  const detail = buildDetailLine({
    eventType: input.eventType,
    metadata: input.metadata,
    source: input.source,
  });

  try {
    await postDiscordWebhook(webhookUrl, {
      content: `${pingPrefix}${config.emoji} **${config.label}** · \`${truncateAddress(walletAddress)}\``,
      embeds: [
        {
          title: `${config.label} on Blink`,
          description: detail,
          url: profileUrl,
          color: config.color,
          fields: [
            {
              name: "Wallet",
              value: `\`${walletAddress}\``,
              inline: false,
            },
            {
              name: "Profile",
              value: `[Open](${profileUrl})`,
              inline: true,
            },
            {
              name: "Internal",
              value: `[Inspect](${internalUrl})`,
              inline: true,
            },
          ],
          footer: {
            text: "Blink live activity",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (error) {
    console.warn("[activity-alerts] Discord notify failed", {
      eventType: input.eventType,
      walletAddress,
      error,
    });
  }
}
