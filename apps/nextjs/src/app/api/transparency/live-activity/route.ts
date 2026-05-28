import { NextResponse } from "next/server";

import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@acme/db/client";
import { MetricEvent } from "@acme/db/schema";

import { LIVE_ACTIVITY_EVENT_TYPES } from "~/lib/blink/activity-alerts.server";

export const runtime = "nodejs";

type LiveEventType = (typeof LIVE_ACTIVITY_EVENT_TYPES)[number];

const LIVE_EVENT_SET = new Set<LiveEventType>(LIVE_ACTIVITY_EVENT_TYPES);

function getMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toDetail(
  eventType: LiveEventType,
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(10, Number(searchParams.get("pageSize") ?? 20)));
  const eventTypeParam = searchParams.get("eventType");
  const eventType =
    eventTypeParam && LIVE_EVENT_SET.has(eventTypeParam as LiveEventType)
      ? (eventTypeParam as LiveEventType)
      : null;

  const baseWhere = and(
    inArray(MetricEvent.eventType, LIVE_ACTIVITY_EVENT_TYPES),
    sql`${MetricEvent.walletAddress} is not null`,
    eq(MetricEvent.isBot, false),
  );
  const scopedWhere = eventType
    ? and(baseWhere, eq(MetricEvent.eventType, eventType))
    : baseWhere;
  const offset = (page - 1) * pageSize;

  try {
    const [rows, totalRows, byTypeRows] = await Promise.all([
      db
        .select({
          createdAt: MetricEvent.createdAt,
          eventType: MetricEvent.eventType,
          metadata: MetricEvent.metadata,
          source: MetricEvent.source,
          walletAddress: MetricEvent.walletAddress,
        })
        .from(MetricEvent)
        .where(scopedWhere)
        .orderBy(desc(MetricEvent.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ c: count() }).from(MetricEvent).where(scopedWhere),
      db
        .select({
          c: count(),
          eventType: MetricEvent.eventType,
        })
        .from(MetricEvent)
        .where(baseWhere)
        .groupBy(MetricEvent.eventType),
    ]);

    const items = rows
      .filter((row) => Boolean(row.walletAddress))
      .map((row) => {
        const metadata = (row.metadata ?? {}) as Record<string, unknown>;
        const source = String(row.source ?? "app");
        const typedEvent = row.eventType as LiveEventType;
        return {
          createdAt: new Date(row.createdAt).toISOString(),
          country: getMetadataString(metadata, "country"),
          detail: toDetail(typedEvent, metadata, source),
          eventType: typedEvent,
          market:
            getMetadataString(metadata, "market") ??
            getMetadataString(metadata, "firstMarket"),
          source,
          walletAddress: String(row.walletAddress),
        };
      });

    const total = Number(totalRows[0]?.c ?? 0);
    const byEventType = Object.fromEntries(
      LIVE_ACTIVITY_EVENT_TYPES.map((type) => [
        type,
        Number(byTypeRows.find((row) => row.eventType === type)?.c ?? 0),
      ]),
    );

    return NextResponse.json(
      {
        byEventType,
        eventType,
        items,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("[transparency-live-activity] failed", error);
    return NextResponse.json(
      { error: "Failed to load transparency live activity" },
      { status: 500 },
    );
  }
}

