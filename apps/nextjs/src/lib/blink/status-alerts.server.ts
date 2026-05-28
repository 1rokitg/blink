import { desc, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import { MetricEvent } from "@acme/db/schema";

import { env } from "~/env";

import { postDiscordWebhook, getDiscordStatusWebhookUrl } from "./discord-webhook.server";
import { getDeploymentSha, type SystemHealthReport } from "./system-health.server";

type StatusState = SystemHealthReport["status"];

const STATUS_EVENT_TYPES = [
  "system_status_ok",
  "system_status_degraded",
  "system_status_outage",
] as const;

const STATUS_EVENT_BY_STATE: Record<StatusState, (typeof STATUS_EVENT_TYPES)[number]> = {
  degraded: "system_status_degraded",
  ok: "system_status_ok",
  outage: "system_status_outage",
};

const STATUS_EMBED_COLORS: Record<StatusState, number> = {
  degraded: 0xf59e0b,
  ok: 0x22c55e,
  outage: 0xef4444,
};

function humanizeStatus(value: StatusState) {
  if (value === "ok") return "Operational";
  if (value === "degraded") return "Degraded";
  return "Outage";
}

function classifyTransition(previous: StatusState | null, current: StatusState) {
  if (!previous) return current === "ok" ? "uptime" : "downtime";
  if (previous === current) return "noop";
  if (current === "ok") return "recovery";
  if (previous === "ok") return "downtime";
  return "degradation";
}

function mentionPrefix(kind: ReturnType<typeof classifyTransition>) {
  const roleId = env.DISCORD_STATUS_PING_ROLE_ID.trim();
  if (!roleId) return "";
  if (kind === "downtime" || kind === "recovery") {
    return `<@&${roleId}> `;
  }
  return "";
}

export async function maybeSendStatusAlert(report: SystemHealthReport) {
  const webhookUrl = getDiscordStatusWebhookUrl();
  if (!webhookUrl) return;

  const [latest] = await db
    .select({
      createdAt: MetricEvent.createdAt,
      eventType: MetricEvent.eventType,
    })
    .from(MetricEvent)
    .where(inArray(MetricEvent.eventType, STATUS_EVENT_TYPES))
    .orderBy(desc(MetricEvent.createdAt))
    .limit(1);

  const currentEvent = STATUS_EVENT_BY_STATE[report.status];
  if (latest?.eventType === currentEvent) return;

  const previousStatus: StatusState | null =
    latest?.eventType === "system_status_ok"
      ? "ok"
      : latest?.eventType === "system_status_degraded"
        ? "degraded"
        : latest?.eventType === "system_status_outage"
          ? "outage"
          : null;
  const transition = classifyTransition(previousStatus, report.status);
  if (transition === "noop") return;

  const failingChecks = Object.entries(report.checks)
    .filter(([, check]) => check.status === "error")
    .map(([name, check]) => `${name}: ${check.detail ?? "error"}`);
  const description =
    transition === "uptime"
      ? "Blink status monitor is live. All systems are currently operational."
      : transition === "recovery"
        ? `Recovered from ${previousStatus ?? "unknown"} state.`
        : transition === "downtime"
          ? `Service has entered ${report.status} state.`
          : `Status changed from ${previousStatus ?? "unknown"} to ${report.status}.`;

  await db.insert(MetricEvent).values({
    eventType: currentEvent,
    isBot: true,
    metadata: {
      checks: report.checks,
      from: previousStatus,
      sha: getDeploymentSha(),
      status: report.status,
      transition,
    },
    source: "status-monitor",
  });

  const titlePrefix =
    transition === "recovery"
      ? "RECOVERY"
      : transition === "downtime"
        ? "DOWNTIME"
        : transition === "uptime"
          ? "UPTIME"
          : "STATUS CHANGE";
  const content = `${mentionPrefix(transition)}**Blink ${titlePrefix}: ${humanizeStatus(report.status)}**`;

  await postDiscordWebhook(webhookUrl, {
    content,
    embeds: [
      {
        color: STATUS_EMBED_COLORS[report.status],
        description,
        fields: [
          {
            inline: true,
            name: "Previous",
            value: previousStatus ? humanizeStatus(previousStatus) : "Unknown",
          },
          {
            inline: true,
            name: "Current",
            value: humanizeStatus(report.status),
          },
          {
            inline: true,
            name: "Deploy",
            value: getDeploymentSha(),
          },
          {
            inline: false,
            name: "Failing checks",
            value:
              failingChecks.length > 0
                ? failingChecks.join("\n").slice(0, 1000)
                : "None",
          },
          {
            inline: false,
            name: "Checked at",
            value: new Date(report.checkedAt).toISOString(),
          },
        ],
        title: "Blink system status",
      },
    ],
  });
}

