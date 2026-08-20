import "server-only";

import {
  getCryptoFunnelFromAe,
  writeCircleEvent,
} from "@/lib/analytics-engine.server";
import { ANALYTICS_BUDGET } from "@/lib/analytics-budget";
import type {
  ClientFingerprint,
  CryptoEventName,
  CryptoFunnelStats,
  VisitorProfile,
} from "@/lib/analytics-types";
import {
  indexRecentCryptoPayment,
  listRecentCryptoPayments,
  type StoredPayment,
} from "@/lib/crypto-verify.server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createHash } from "node:crypto";

async function getKv() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).CRYPTO_PAYMENTS ?? null;
  } catch {
    return null;
  }
}

/**
 * Record crypto/checkout analytics.
 * Primary: Workers Analytics Engine (non-blocking, ~20× cheaper than KV writes).
 * Also patches throttled visitor profile in KV when a wallet is involved.
 */
export async function recordCryptoAnalyticsEvent(input: {
  event: CryptoEventName;
  ip: string;
  ua: string;
  host: string;
  country?: string;
  path?: string;
  planId?: string | null;
  chainId?: string | null;
  walletBrand?: string | null;
  walletAddress?: string | null;
  txHash?: string | null;
  error?: string | null;
  providers?: string[];
  amountUsdc?: number | null;
  fingerprint?: ClientFingerprint | null;
}) {
  await writeCircleEvent({
    event: input.event,
    path: input.path,
    ip: input.ip,
    ua: input.ua,
    host: input.host,
    country: input.country,
    planId: input.planId,
    chainId: input.chainId,
    walletBrand: input.walletBrand,
    walletAddress: input.walletAddress,
    txHash: input.txHash,
    error: input.error,
    providers: input.providers,
    amountUsdc: input.amountUsdc,
    fingerprint: input.fingerprint,
  });

  // Enrich People tab only on wallet-identifying events (low volume).
  if (!input.walletAddress && input.event !== "crypto_connect_success") {
    return;
  }
  const kv = await getKv();
  if (!kv) return;

  const visitorId = createHash("sha256")
    .update(`${input.ip || "unknown"}|${input.ua || "unknown"}`)
    .digest("hex")
    .slice(0, 16);
  const key = `visitor:${visitorId}`;
  const prev = await kv.get<VisitorProfile>(key, "json");
  if (!prev) return;

  const wallets = new Set(prev.wallets ?? []);
  const brands = new Set(prev.walletBrands ?? []);
  if (input.walletAddress) wallets.add(input.walletAddress.toLowerCase());
  if (input.walletBrand) brands.add(input.walletBrand);

  await kv.put(
    key,
    JSON.stringify({
      ...prev,
      fingerprint: input.fingerprint ?? prev.fingerprint ?? null,
      wallets: [...wallets].slice(-ANALYTICS_BUDGET.maxWalletsPerVisitor),
      walletBrands: [...brands].slice(-ANALYTICS_BUDGET.maxBrandsPerVisitor),
      cryptoConnects:
        (prev.cryptoConnects ?? 0) +
        (input.event === "crypto_connect_success" ? 1 : 0),
      cryptoPays:
        (prev.cryptoPays ?? 0) + (input.event === "crypto_paid" ? 1 : 0),
      lastWalletAddress:
        input.walletAddress?.toLowerCase() ?? prev.lastWalletAddress ?? null,
      lastWalletBrand: input.walletBrand ?? prev.lastWalletBrand ?? null,
      lastSeen: new Date().toISOString(),
    } satisfies VisitorProfile),
    { expirationTtl: ANALYTICS_BUDGET.ttlSeconds },
  );
}

export async function recordCryptoPaymentAnalytics(payment: StoredPayment) {
  await recordCryptoAnalyticsEvent({
    event: "crypto_paid",
    ip: "onchain",
    ua: "server",
    host: "rokitg.com",
    country: "XX",
    path: "/api/crypto/verify",
    planId: payment.planId,
    chainId: payment.chainId,
    walletBrand: payment.walletBrand ?? null,
    walletAddress: payment.fromAddress ?? null,
    txHash: payment.txHash,
    amountUsdc: payment.amountUsdc,
    providers: payment.walletBrand ? [payment.walletBrand] : [],
  });

  // Ensure Monetise can list the payment even if AE is disabled.
  await indexRecentCryptoPayment(payment);
}

function paymentRowFromStored(p: StoredPayment) {
  return {
    txHash: p.txHash,
    chainId: p.chainId,
    planId: p.planId,
    amountUsdc: p.amountUsdc,
    walletAddress: p.fromAddress ?? null,
    walletBrand: p.walletBrand ?? null,
    telegramUsername: p.telegramUsername,
    createdAt: p.createdAt,
  };
}

export async function getCryptoFunnelStats(
  days = 1,
): Promise<CryptoFunnelStats> {
  const ledger = await listRecentCryptoPayments(200);

  try {
    const fromAe = await getCryptoFunnelFromAe(days);
    const byTx = new Map(
      ledger.map((p) => [p.txHash.toLowerCase(), p] as const),
    );

    fromAe.payments = fromAe.payments.map((p) => {
      const hit = byTx.get(p.txHash.toLowerCase());
      return hit
        ? {
            ...p,
            telegramUsername: hit.telegramUsername || p.telegramUsername,
            walletAddress: p.walletAddress || hit.fromAddress || null,
            walletBrand: p.walletBrand || hit.walletBrand || null,
          }
        : p;
    });

    // Union AE + durable ledger so Monetise never misses a verified payment.
    const seen = new Set(
      fromAe.payments.map((p) => p.txHash.toLowerCase()),
    );
    for (const payment of ledger) {
      const key = payment.txHash.toLowerCase();
      if (seen.has(key)) continue;
      fromAe.payments.push(paymentRowFromStored(payment));
      seen.add(key);
    }

    fromAe.payments.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );

    if (fromAe.totals.paid === 0 && ledger.length > 0) {
      fromAe.totals.paid = ledger.length;
      fromAe.totals.revenueUsdc = ledger.reduce(
        (sum, row) => sum + row.amountUsdc,
        0,
      );
    }

    return fromAe;
  } catch (error) {
    console.error("[crypto-analytics] AE funnel query failed", error);
    return {
      series: [],
      totals: {
        views: 0,
        methodCrypto: 0,
        methodCard: 0,
        connectAttempts: 0,
        connectSuccess: 0,
        connectFail: 0,
        signSuccess: 0,
        signFail: 0,
        verifySuccess: 0,
        verifyFail: 0,
        paid: ledger.length,
        revenueUsdc: ledger.reduce((sum, row) => sum + row.amountUsdc, 0),
        byWallet: {},
        byChain: {},
        byPlan: {},
        uniqueWallets: [],
        uniqueVisitors: [],
      },
      conversion: {
        viewToConnect: null,
        connectToSign: null,
        signToPaid: null,
        viewToPaid: null,
      },
      wallets: [],
      recentEvents: [],
      payments: ledger.map(paymentRowFromStored),
    };
  }
}
