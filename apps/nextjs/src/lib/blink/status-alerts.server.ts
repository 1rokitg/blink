import { desc, inArray } from "drizzle-orm";

import { db } from "@acme/db/client";
import { MetricEvent } from "@acme/db/schema";

import {
  getDiscordStatusWebhookUrl,
  postDiscordWebhook,
} from "./discord-webhook.server";
import {
  buildStatusAlertContext,
  formatBtcMid,
  formatFailingChecks,
  formatUsd,
  getDeployRegion,
} from "./status-alert-format.server";
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

const STATUS_EMOJI: Record<StatusState, string> = {
  degraded: "🟡",
  ok: "🟢",
  outage: "🔴",
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
  if (kind === "uptime" || kind === "noop") return "";
  return "@everyone ";
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

  const context = await buildStatusAlertContext(report);
  const description =
    transition === "uptime"
      ? "Blink status monitor is live. All systems are currently operational."
      : transition === "recovery"
        ? `Service recovered from **${humanizeStatus(previousStatus ?? "unknown")}** to **${humanizeStatus(report.status)}**.`
        : transition === "downtime"
          ? `Service entered **${humanizeStatus(report.status)}** from **${humanizeStatus(previousStatus ?? "unknown")}**.`
          : `Status moved from **${humanizeStatus(previousStatus ?? "unknown")}** to **${humanizeStatus(report.status)}**.`;

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
  const emoji = STATUS_EMOJI[report.status];
  const content = `${mentionPrefix(transition)}**${emoji} Blink ${titlePrefix} · ${humanizeStatus(report.status)}**`;

  const region = context.region ?? getDeployRegion() ?? "—";
  const btcValue =
    context.btcMid !== null ? `$${formatBtcMid(context.btcMid)}` : "—";
  const builderBalanceValue =
    context.builderBalanceUsd !== null
      ? formatUsd(context.builderBalanceUsd)
      : "—";

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
            value: `\`${getDeploymentSha()}\``,
          },
          {
            inline: true,
            name: "Region",
            value: region,
          },
          {
            inline: true,
            name: "BTC mid",
            value: btcValue,
          },
          {
            inline: true,
            name: "Builder balance",
            value: builderBalanceValue,
          },
          {
            inline: true,
            name: "90d uptime",
            value: `${context.uptimePct.toFixed(2)}%`,
          },
          {
            inline: true,
            name: "90d incidents",
            value: String(context.incidentCount),
          },
          ...(context.blinkApiSummary
            ? [
                {
                  inline: false,
                  name: "Builder routing",
                  value: context.blinkApiSummary,
                },
              ]
            : []),
          {
            inline: false,
            name: "Issues",
            value: formatFailingChecks(report).slice(0, 1000),
          },
          {
            inline: false,
            name: "Check latency",
            value: context.latencies || "—",
          },
        ],
        footer: {
          text: "Blink status monitor",
        },
        timestamp: report.checkedAt,
        title: "Blink system status",
      },
    ],
  });
}
