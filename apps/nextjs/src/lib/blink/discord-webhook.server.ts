import { env } from "~/env";

export async function postDiscordWebhook(
  webhookUrl: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(4_000),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed with status ${response.status}`);
  }
}

export function getDiscordActivityWebhookUrl() {
  return env.DISCORD_ACTIVITY_WEBHOOK_URL || "";
}

export function getDiscordStatusWebhookUrl() {
  return env.DISCORD_STATUS_WEBHOOK_URL || "";
}
