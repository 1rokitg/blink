import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ClaimLinkRecord,
  ClaimLinkStatus,
  PublicClaimView,
} from "@/lib/claim-links-types";
import { CARD_CURRENCY, usdToEurCents } from "@/lib/fx";
import { claimDiscountStripeMetadata } from "@/lib/member-tags";
import { getAppUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import { resolvePriceId } from "@/lib/store-config.server";

export type {
  ClaimLinkRecord,
  ClaimLinkStatus,
  PublicClaimView,
} from "@/lib/claim-links-types";

export type CreateClaimLinkInput = {
  amountUsd: number;
  interval?: "month" | "year";
  intervalCount?: number;
  planId?: "month" | "quarter" | "year";
  email?: string;
  telegramUsername?: string;
  note?: string;
  label?: string;
  /** Days until unused link expires. Default 14. */
  expiresInDays?: number;
  createdBy: string;
};

const CLAIM_KEY_PREFIX = "claim:";
const CLAIMS_INDEX_KEY = "claims:recent";
const CLAIMS_INDEX_CAP = 200;
const EARLY_ACCESS_PRODUCT_NAME = "The Circle VIP — Early access";

function claimKey(id: string) {
  return `${CLAIM_KEY_PREFIX}${id}`;
}

function fileStorePath() {
  return path.join(process.cwd(), ".data", "claim-links.json");
}

async function getKv(): Promise<KVNamespace | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv | undefined)?.CRYPTO_PAYMENTS ?? null;
  } catch {
    return null;
  }
}

async function readFileStore(): Promise<Record<string, ClaimLinkRecord>> {
  try {
    const raw = await readFile(fileStorePath(), "utf8");
    return JSON.parse(raw) as Record<string, ClaimLinkRecord>;
  } catch {
    return {};
  }
}

async function writeFileStore(store: Record<string, ClaimLinkRecord>) {
  const file = fileStorePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

function newClaimId() {
  const raw = crypto.randomUUID().replaceAll("-", "");
  return `cl_${raw}`;
}

function normalizeUsername(value: string | undefined) {
  const trimmed = value?.trim().replace(/^@/, "") ?? "";
  return trimmed || null;
}

function normalizeEmail(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

function isExpired(record: ClaimLinkRecord, now = Date.now()) {
  if (!record.expiresAt) return false;
  return new Date(record.expiresAt).getTime() <= now;
}

export function publicClaimUrl(id: string) {
  return `${getAppUrl()}/claim/${id}`;
}

export function formatClaimAmount(
  cents: number,
  currency: "eur" | "usd" = "eur",
) {
  return (cents / 100).toLocaleString(currency === "eur" ? "en-IE" : "en-US", {
    style: "currency",
    currency: currency === "eur" ? "EUR" : "USD",
  });
}

async function putClaim(record: ClaimLinkRecord) {
  const kv = await getKv();
  if (kv) {
    await kv.put(claimKey(record.id), JSON.stringify(record));
    const index =
      (await kv.get<{ ids: string[] }>(CLAIMS_INDEX_KEY, "json")) ?? {
        ids: [],
      };
    const ids = [record.id, ...index.ids.filter((id) => id !== record.id)].slice(
      0,
      CLAIMS_INDEX_CAP,
    );
    await kv.put(CLAIMS_INDEX_KEY, JSON.stringify({ ids }));
    return;
  }

  const store = await readFileStore();
  store[record.id] = record;
  await writeFileStore(store);
}

export async function getClaimLink(id: string): Promise<ClaimLinkRecord | null> {
  const safeId = id.trim();
  if (!safeId.startsWith("cl_")) return null;

  const kv = await getKv();
  let record: ClaimLinkRecord | null = null;
  if (kv) {
    record = await kv.get<ClaimLinkRecord>(claimKey(safeId), "json");
  } else {
    const store = await readFileStore();
    record = store[safeId] ?? null;
  }

  if (!record) return null;

  if (
    record.status !== "completed" &&
    record.status !== "revoked" &&
    isExpired(record)
  ) {
    if (record.status !== "expired") {
      record = { ...record, status: "expired" };
      await putClaim(record);
    }
  }

  // Self-heal: if checkout already paid but webhook missed, lock the link.
  if (
    (record.status === "claimed" || record.status === "pending") &&
    record.checkoutSessionId &&
    isStripeConfigured()
  ) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(
        record.checkoutSessionId,
      );
      if (session.status === "complete" && session.payment_status === "paid") {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : (session.subscription?.id ?? record.subscriptionId);
        record = {
          ...record,
          status: "completed",
          subscriptionId,
          completedAt: record.completedAt ?? new Date().toISOString(),
        };
        await putClaim(record);
      }
    } catch {
      // Stripe unavailable — keep current status.
    }
  }

  return record;
}

export async function listClaimLinks(limit = 50): Promise<ClaimLinkRecord[]> {
  const kv = await getKv();
  if (kv) {
    const index =
      (await kv.get<{ ids: string[] }>(CLAIMS_INDEX_KEY, "json")) ?? {
        ids: [],
      };
    const rows: ClaimLinkRecord[] = [];
    for (const id of index.ids.slice(0, limit)) {
      const row = await getClaimLink(id);
      if (row) rows.push(row);
    }
    return rows;
  }

  const store = await readFileStore();
  return Object.values(store)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((row) => {
      if (
        row.status !== "completed" &&
        row.status !== "revoked" &&
        isExpired(row)
      ) {
        return { ...row, status: "expired" as const };
      }
      return row;
    });
}

async function resolveClaimProductId(planId: "month" | "quarter" | "year") {
  const stripe = getStripe();

  // Prefer attaching custom prices to the live monthly catalog product.
  try {
    const catalogPriceId = await resolvePriceId(planId);
    const price = await stripe.prices.retrieve(catalogPriceId, {
      expand: ["product"],
    });
    if (
      typeof price.product === "object" &&
      price.product &&
      !price.product.deleted
    ) {
      return price.product.id;
    }
    if (typeof price.product === "string") return price.product;
  } catch {
    // fall through to dedicated early-access product
  }

  try {
    const existing = await stripe.products.search({
      query: `name:"${EARLY_ACCESS_PRODUCT_NAME}" AND active:"true"`,
      limit: 1,
    });
    if (existing.data[0]) return existing.data[0].id;
  } catch {
    // Search unavailable — create a dedicated product below.
  }

  const created = await stripe.products.create({
    name: EARLY_ACCESS_PRODUCT_NAME,
    description:
      "Custom early-access / migration membership priced per customer.",
    metadata: {
      app: "the-circle-vip",
      source: "claim_link",
    },
  });
  return created.id;
}

export async function createClaimLink(
  input: CreateClaimLinkInput,
): Promise<ClaimLinkRecord> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const amountUsd = Number(input.amountUsd);
  if (!Number.isFinite(amountUsd) || amountUsd < 0.5 || amountUsd > 10_000) {
    throw new Error("Amount must be between $0.50 and $10,000 USD (list).");
  }

  const interval = input.interval ?? "month";
  const intervalCount = Math.max(1, Math.min(36, input.intervalCount ?? 1));
  const planId = input.planId ?? "month";
  const amountEurCents = usdToEurCents(amountUsd);
  const expiresInDays = Math.max(1, Math.min(90, input.expiresInDays ?? 14));

  const stripe = getStripe();
  const productId = await resolveClaimProductId(planId);
  const price = await stripe.prices.create({
    product: productId,
    currency: CARD_CURRENCY,
    unit_amount: amountEurCents,
    recurring: { interval, interval_count: intervalCount },
    metadata: {
      app: "the-circle-vip",
      source: "claim_link",
      planId,
      base_amount_usd: String(amountUsd),
    },
  });

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays);

  const record: ClaimLinkRecord = {
    id: newClaimId(),
    amountUsdCents: amountEurCents,
    currency: "eur",
    baseAmountUsd: amountUsd,
    interval,
    intervalCount,
    planId,
    priceId: price.id,
    productId,
    email: normalizeEmail(input.email),
    telegramUsername: normalizeUsername(input.telegramUsername),
    note: input.note?.trim().slice(0, 280) || null,
    label: input.label?.trim().slice(0, 120) || null,
    status: "pending",
    checkoutSessionId: null,
    subscriptionId: null,
    createdAt: now.toISOString(),
    createdBy: input.createdBy.slice(0, 64),
    expiresAt: expiresAt.toISOString(),
    claimedAt: null,
    completedAt: null,
  };

  await putClaim(record);
  return record;
}

export async function revokeClaimLink(id: string): Promise<ClaimLinkRecord> {
  const record = await getClaimLink(id);
  if (!record) throw new Error("Claim link not found.");
  if (record.status === "completed") {
    throw new Error("Completed claim links cannot be revoked.");
  }
  const next: ClaimLinkRecord = { ...record, status: "revoked" };
  await putClaim(next);
  return next;
}

function manualTelegramId(username: string) {
  return `manual:${username.replace(/^@/, "").toLowerCase()}`;
}

async function findOrCreateCustomer(input: {
  email: string | null;
  telegramUsername: string | null;
}) {
  const stripe = getStripe();
  const username = input.telegramUsername;

  if (username) {
    const telegramUserId = manualTelegramId(username);
    try {
      const existing = await stripe.customers.search({
        query: `metadata["telegramUserId"]:"${telegramUserId}"`,
        limit: 1,
      });
      if (existing.data[0]) {
        if (input.email && !existing.data[0].email) {
          return stripe.customers.update(existing.data[0].id, {
            email: input.email,
          });
        }
        return existing.data[0];
      }
    } catch {
      // fall through
    }

    return stripe.customers.create({
      email: input.email ?? undefined,
      name: username,
      metadata: {
        telegramUserId,
        telegramUsername: username,
        app: "the-circle-vip",
        source: "claim_link",
      },
    });
  }

  if (input.email) {
    try {
      const existing = await stripe.customers.list({
        email: input.email,
        limit: 1,
      });
      if (existing.data[0]) return existing.data[0];
    } catch {
      // fall through
    }
    return stripe.customers.create({
      email: input.email,
      metadata: {
        app: "the-circle-vip",
        source: "claim_link",
      },
    });
  }

  return stripe.customers.create({
    metadata: {
      app: "the-circle-vip",
      source: "claim_link",
    },
  });
}

/**
 * Create (or reuse) a Stripe Checkout Session for a claim link.
 * One-time: completed/revoked/expired links are rejected. Abandoned
 * claimed sessions can be retried.
 */
export async function startClaimCheckout(input: {
  claimId: string;
  telegramUsername?: string;
  email?: string;
}): Promise<{ url: string; sessionId: string; claim: ClaimLinkRecord }> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const record = await getClaimLink(input.claimId);
  if (!record) throw new Error("This claim link is invalid.");
  if (record.status === "revoked") {
    throw new Error("This claim link was revoked.");
  }
  if (record.status === "expired" || isExpired(record)) {
    throw new Error("This claim link has expired.");
  }
  if (record.status === "completed") {
    throw new Error("This claim link was already used.");
  }

  const stripe = getStripe();

  if (record.status === "claimed" && record.checkoutSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        record.checkoutSessionId,
      );
      if (existing.status === "open" && existing.url) {
        return {
          url: existing.url,
          sessionId: existing.id,
          claim: record,
        };
      }
      if (existing.status === "complete") {
        const completed: ClaimLinkRecord = {
          ...record,
          status: "completed",
          completedAt: new Date().toISOString(),
          subscriptionId:
            typeof existing.subscription === "string"
              ? existing.subscription
              : (existing.subscription?.id ?? record.subscriptionId),
        };
        await putClaim(completed);
        throw new Error("This claim link was already used.");
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "This claim link was already used."
      ) {
        throw error;
      }
      // Session missing/expired — allow a fresh checkout below.
    }
  }

  const telegramUsername =
    normalizeUsername(input.telegramUsername) || record.telegramUsername;
  const email = normalizeEmail(input.email) || record.email;

  if (!telegramUsername) {
    throw new Error("Telegram username is required.");
  }

  const customer = await findOrCreateCustomer({ email, telegramUsername });
  const telegramUserId = manualTelegramId(telegramUsername);
  const appUrl = getAppUrl();

  const metadata = {
    planId: record.planId,
    claimId: record.id,
    source: "claim_link",
    telegramUserId,
    telegramUsername,
    ...claimDiscountStripeMetadata({
      label: record.label,
      note: record.note,
    }),
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    customer_update: { address: "auto", name: "auto" },
    line_items: [{ price: record.priceId, quantity: 1 }],
    success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/claim/${record.id}?canceled=1`,
    automatic_tax: { enabled: true },
    client_reference_id: telegramUserId.slice(0, 200),
    metadata,
    subscription_data: {
      metadata,
      description:
        record.label ||
        `Early access · ${formatClaimAmount(record.amountUsdCents, record.currency)}/${record.interval}`,
    },
  });

  // Keep Whop `tag` intact; stamp discount tag for dashboard + Payments.
  try {
    const discountMeta = claimDiscountStripeMetadata({
      label: record.label,
      note: record.note,
    });
    await stripe.customers.update(customer.id, {
      metadata: {
        ...discountMeta,
        // Preserve existing Whop tag; discount lives on discount_tag.
        ...(customer.metadata?.tag === "Whop"
          ? { tag: "Whop" }
          : { tag: discountMeta.tag }),
      },
    });
  } catch {
    // Non-fatal — subscription metadata still carries the discount tag.
  }

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL.");
  }

  const claimed: ClaimLinkRecord = {
    ...record,
    status: "claimed",
    email,
    telegramUsername,
    checkoutSessionId: session.id,
    claimedAt: new Date().toISOString(),
  };
  await putClaim(claimed);

  return { url: session.url, sessionId: session.id, claim: claimed };
}

export async function completeClaimFromCheckout(input: {
  claimId: string;
  checkoutSessionId?: string | null;
  subscriptionId?: string | null;
}) {
  const record = await getClaimLink(input.claimId);
  if (!record) return null;
  if (record.status === "completed") return record;

  const next: ClaimLinkRecord = {
    ...record,
    status: "completed",
    checkoutSessionId: input.checkoutSessionId ?? record.checkoutSessionId,
    subscriptionId: input.subscriptionId ?? record.subscriptionId,
    completedAt: new Date().toISOString(),
  };
  await putClaim(next);
  return next;
}

export function toPublicClaimView(record: ClaimLinkRecord): PublicClaimView {
  // Only untouched pending links stay open. `claimed` means checkout was
  // started — keep usable only while we may still need to resume an open session.
  const usable = record.status === "pending" || record.status === "claimed";
  return {
    id: record.id,
    amountUsd: record.amountUsdCents / 100,
    amountLabel: formatClaimAmount(record.amountUsdCents, record.currency),
    interval: record.interval,
    intervalCount: record.intervalCount,
    email: record.email,
    telegramUsername: record.telegramUsername,
    label: record.label,
    note: record.note,
    status: record.status,
    expiresAt: record.expiresAt,
    usable: usable && !isExpired(record) && record.status !== "completed",
  };
}
