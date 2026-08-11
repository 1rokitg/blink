import { NextResponse } from "next/server";

import { recordCryptoAnalyticsEvent } from "@/lib/crypto-analytics.server";
import type { ClientFingerprint, CryptoEventName } from "@/lib/analytics-types";
import {
  sanitizeAttribution,
  type Attribution,
} from "@/lib/attribution";
import { recordPageview } from "@/lib/pageviews.server";

export const runtime = "nodejs";

const CRYPTO_EVENTS = new Set<CryptoEventName>([
  "crypto_view",
  "pay_method_select",
  "crypto_chain_select",
  "crypto_manual_open",
  "crypto_connect_attempt",
  "crypto_connect_success",
  "crypto_connect_fail",
  "crypto_sign_prompt",
  "crypto_sign_success",
  "crypto_sign_fail",
  "crypto_verify_start",
  "crypto_verify_success",
  "crypto_verify_fail",
  "crypto_paid",
  "crypto_success_page",
  "wallet_detected",
]);

type CollectBody = {
  type?: "pageview" | "event";
  path?: string;
  event?: string;
  planId?: string | null;
  chainId?: string | null;
  walletBrand?: string | null;
  walletAddress?: string | null;
  txHash?: string | null;
  error?: string | null;
  providers?: string[];
  amountUsdc?: number | null;
  fingerprint?: ClientFingerprint | null;
  attribution?: Partial<Attribution> | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CollectBody;
    const path = (body.path || "/").slice(0, 200);
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const ua = request.headers.get("user-agent") || "unknown";
    const host = request.headers.get("host") || "rokitg.com";
    const country =
      request.headers.get("cf-ipcountry") ||
      request.headers.get("x-vercel-ip-country") ||
      "XX";
    const region =
      request.headers.get("cf-region") ||
      request.headers.get("cf-region-code") ||
      "";
    const city = request.headers.get("cf-ipcity") || "";
    const attribution = sanitizeAttribution(body.attribution);

    // Skip internal host noise
    if (host.startsWith("internal.")) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (
      body.type === "event" &&
      body.event &&
      CRYPTO_EVENTS.has(body.event as CryptoEventName)
    ) {
      await recordCryptoAnalyticsEvent({
        event: body.event as CryptoEventName,
        ip,
        ua,
        host,
        country,
        path,
        planId: body.planId,
        chainId: body.chainId,
        walletBrand: body.walletBrand,
        walletAddress: body.walletAddress,
        txHash: body.txHash,
        error: body.error,
        providers: Array.isArray(body.providers) ? body.providers : [],
        amountUsdc: body.amountUsdc,
        fingerprint: body.fingerprint ?? null,
      });
      return NextResponse.json({ ok: true });
    }

    await recordPageview({
      path,
      ip,
      ua,
      host,
      country,
      region,
      city,
      fingerprint: body.fingerprint ?? null,
      attribution,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
