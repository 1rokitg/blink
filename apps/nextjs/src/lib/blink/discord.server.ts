import { env } from "~/env";

import { postDiscordWebhook } from "./discord-webhook.server";

async function postSightingsWebhook(payload: Record<string, unknown>) {
  if (!env.DISCORD_SIGHTINGS_WEBHOOK_URL) return;
  await postDiscordWebhook(env.DISCORD_SIGHTINGS_WEBHOOK_URL, payload);
}

export async function sendDiscordProfileVerificationSighting(params: {
  twitterUsername: string;
}) {
  const username = params.twitterUsername.replace(/^@+/, "").trim();
  if (!username) return;
  const twitterUrl = `https://x.com/${username}`;

  await postSightingsWebhook({
    content: `@${username} just got verified on blink!\n${twitterUrl}`,
  });
}
