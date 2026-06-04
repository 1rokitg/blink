"use server";

import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db/client";
import { MetricEvent } from "@acme/db/schema";

import { assertInternalReadAccess } from "~/lib/blink/admin-roles.server";
import { LIVE_ACTIVITY_EVENT_TYPES } from "~/lib/blink/activity-alerts.server";

const inputSchema = z.object({
  actingWalletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  emailAddresses: z.array(z.string().email()).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(25),
});

type LiveActivityEventType = (typeof LIVE_ACTIVITY_EVENT_TYPES)[number];

export type LiveActivityFeedRow = {
  createdAt: string;
  country: string | null;
  detail: string;
  eventType: LiveActivityEventType;
  market: string | null;
  source: string;
  walletAddress: string;
};

export type LiveActivityFeedPage = {
  items: LiveActivityFeedRow[];
  page: number;
  pageSize: number;
  summary: {
    byEventType: Record<LiveActivityEventType, number>;
    bySource: Array<{ count: number; source: string }>;
    total: number;
  };
  totalPages: number;
};

function getMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toDetail(
  eventType: LiveActivityEventType,
  metadata: Record<string, unknown>,
  source: string,
) {
  const country = getMetadataString(metadata, "country");
  const market =
    getMetadataString(metadata, "market") ??
    getMetadataString(metadata, "firstMarket");
  const side = getMetadataString(metadata, "side");
  const orderType = getMetadataString(metadata, "orderType");
  const maxFeeRate = getMetadataString(metadata, "maxFeeRate");
  const agentName = getMetadataString(metadata, "agentName");

  if (eventType === "trading_enabled" && agentName) {
    return `Agent ${agentName} approved · one-click trading live`;
  }
  if (eventType === "builder_approved" && maxFeeRate) {
    return `Builder fee approved · ${maxFeeRate}`;
  }
  if (eventType === "first_trade" && market) {
    return `${market}${side ? ` · ${side}` : ""}${orderType ? ` · ${orderType}` : ""}`;
  }
  if (country) return `${country} · ${source}`;
  return source;
}

export async function getLiveActivityFeed(
  input: unknown,
): Promise<LiveActivityFeedPage> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid live activity query.");
  }

  const actingWalletAddress = parsed.data.actingWalletAddress.toLowerCase();
  await assertInternalReadAccess({
    actingWalletAddress,
    emailAddresses: parsed.data.emailAddresses,
  });

  const offset = (parsed.data.page - 1) * parsed.data.pageSize;
  const eventTypes = [...LIVE_ACTIVITY_EVENT_TYPES] as LiveActivityEventType[];

  const [rows, totalRows, sourceRows, byEventTypeRows] = await Promise.all([
    db
      .select({
        createdAt: MetricEvent.createdAt,
        eventType: MetricEvent.eventType,
        metadata: MetricEvent.metadata,
        source: MetricEvent.source,
        walletAddress: MetricEvent.walletAddress,
      })
      .from(MetricEvent)
      .where(
        and(
          inArray(MetricEvent.eventType, eventTypes),
          sql`${MetricEvent.walletAddress} is not null`,
        ),
      )
      .orderBy(desc(MetricEvent.createdAt))
      .limit(parsed.data.pageSize)
      .offset(offset),
    db
      .select({ c: count() })
      .from(MetricEvent)
      .where(
        and(
          inArray(MetricEvent.eventType, eventTypes),
          sql`${MetricEvent.walletAddress} is not null`,
        ),
      ),
    db
      .select({
        c: count(),
        source: MetricEvent.source,
      })
      .from(MetricEvent)
      .where(inArray(MetricEvent.eventType, eventTypes))
      .groupBy(MetricEvent.source)
      .orderBy(desc(count()))
      .limit(8),
    Promise.all(
      eventTypes.map(async (eventType) => {
        const result = await db
          .select({ c: count() })
          .from(MetricEvent)
          .where(eq(MetricEvent.eventType, eventType));
        return { count: Number(result[0]?.c ?? 0), eventType };
      }),
    ),
  ]);

  const items: LiveActivityFeedRow[] = rows
    .filter((row) => Boolean(row.walletAddress))
    .map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const source = String(row.source ?? "app");
      const eventType = row.eventType as LiveActivityEventType;
      return {
        createdAt: new Date(row.createdAt).toISOString(),
        country: getMetadataString(metadata, "country"),
        detail: toDetail(eventType, metadata, source),
        eventType,
        market:
          getMetadataString(metadata, "market") ??
          getMetadataString(metadata, "firstMarket"),
        source,
        walletAddress: String(row.walletAddress),
      };
    });

  const total = Number(totalRows[0]?.c ?? 0);
  const byEventType = Object.fromEntries(
    byEventTypeRows.map((row) => [row.eventType, row.count]),
  ) as Record<LiveActivityEventType, number>;

  return {
    items,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    summary: {
      byEventType,
      bySource: sourceRows.map((row) => ({
        count: Number(row.c ?? 0),
        source: row.source ?? "app",
      })),
      total,
    },
    totalPages: Math.max(1, Math.ceil(total / parsed.data.pageSize)),
  };
}

