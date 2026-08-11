import "server-only";

import type Stripe from "stripe";

import {
  CRYPTO_CHAINS,
  type CryptoChainId,
} from "@/lib/crypto-payments";
import {
  findPaymentByTx,
  recordPayment,
  type StoredPayment,
  verifyEvmUsdcTransfer,
  verifySolanaUsdcTransfer,
} from "@/lib/crypto-verify.server";
import type { StripeMemberRow } from "@/lib/internal-stats-types";
import { collectStripeMemberTags } from "@/lib/member-tags";
import { FALLBACK_PLANS, type PlanId, PLAN_ORDER } from "@/lib/plans";
import { upsertPersonEnrichment } from "@/lib/people-enrichment.server";
import { resolvePriceId } from "@/lib/store-config.server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  createVipInviteLink,
  ensureVipAccess,
} from "@/lib/telegram";
import { upsertPaidTelegramMember } from "@/lib/telegram-paid-whitelist.server";

function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function manualTelegramId(username: string) {
  return `manual:${normalizeUsername(username)}`;
}

function normalizeWallet(raw: string) {
  const value = raw.trim();
  if (value.startsWith("0x") && value.length === 42) return value.toLowerCase();
  return value;
}

function periodEndIso(sub: Stripe.Subscription) {
  const periodEndUnix =
    (sub.items.data[0] as { current_period_end?: number } | undefined)
      ?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (sub as unknown as { trial_end?: number | null }).trial_end;
  return periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
}

function toMemberRow(sub: Stripe.Subscription): StripeMemberRow {
  const customer =
    typeof sub.customer === "object" && sub.customer && !sub.customer.deleted
      ? sub.customer
      : null;
  const planMeta = sub.metadata?.planId?.trim();
  const planId =
    planMeta && PLAN_ORDER.includes(planMeta as PlanId)
      ? (planMeta as PlanId)
      : null;
  const periodEnd = periodEndIso(sub);
  const customerId =
    typeof sub.customer === "string" ? sub.customer : customer?.id || null;
  const source =
    sub.metadata?.source?.trim() ||
    (sub.metadata?.manualGrant === "true" ? "manual_grant" : null);
  const note =
    sub.metadata?.note?.trim() ||
    customer?.metadata?.note?.trim() ||
    null;

  return {
    id: sub.id,
    customerId,
    email: customer && "email" in customer ? (customer.email ?? null) : null,
    name: customer && "name" in customer ? (customer.name ?? null) : null,
    telegramUsername:
      sub.metadata?.telegramUsername ||
      customer?.metadata?.telegramUsername ||
      null,
    telegramUserId:
      sub.metadata?.telegramUserId ||
      customer?.metadata?.telegramUserId ||
      null,
    planId,
    planLabel: planId ? FALLBACK_PLANS[planId].label : null,
    status: sub.status,
    mrr: 0,
    created: new Date(sub.created * 1000).toISOString(),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    inviteLink: sub.metadata?.telegramInviteLink?.trim() || null,
    source,
    currentPeriodEnd: periodEnd,
    dueAt: periodEnd,
    dueKind: periodEnd ? "stripe" : null,
    lastPaidAt: sub.metadata?.cryptoPaidAt?.trim() || null,
    note,
    tags: collectStripeMemberTags({
      subscriptionMetadata: sub.metadata,
      customerMetadata: customer?.metadata,
      subscriptionDescription: sub.description,
      source,
    }),
  };
}

async function findCustomerByEmailOrTelegram(input: {
  email?: string | null;
  telegramUserId: string;
  telegramUsername: string;
}) {
  const stripe = getStripe();
  const email = input.email?.trim().toLowerCase() || null;

  if (email) {
    try {
      const byEmail = await stripe.customers.search({
        query: `email:"${email}"`,
        limit: 5,
      });
      if (byEmail.data[0]) return byEmail.data[0];
    } catch {
      const listed = await stripe.customers.list({ email, limit: 5 });
      if (listed.data[0]) return listed.data[0];
    }
  }

  try {
    const byTg = await stripe.customers.search({
      query: `metadata["telegramUserId"]:"${input.telegramUserId}"`,
      limit: 1,
    });
    if (byTg.data[0]) return byTg.data[0];
  } catch {
    // fall through
  }

  try {
    const byUsername = await stripe.customers.search({
      query: `metadata["telegramUsername"]:"${input.telegramUsername}"`,
      limit: 1,
    });
    if (byUsername.data[0]) return byUsername.data[0];
  } catch {
    // fall through
  }

  return null;
}

async function createCryptoPaidOutOfBandInvoice(input: {
  customerId: string;
  amountUsdc: number;
  description: string;
  metadata: Record<string, string>;
}) {
  const stripe = getStripe();
  const amountCents = Math.round(input.amountUsdc * 100);

  const invoice = await stripe.invoices.create({
    customer: input.customerId,
    currency: "usd",
    collection_method: "send_invoice",
    days_until_due: 1,
    auto_advance: false,
    pending_invoice_items_behavior: "exclude",
    metadata: input.metadata,
    description: input.description.slice(0, 250),
  });

  if (!invoice.id) {
    throw new Error("Stripe invoice create returned no id.");
  }

  await stripe.invoiceItems.create({
    customer: input.customerId,
    invoice: invoice.id,
    amount: amountCents,
    currency: "usd",
    description: input.description.slice(0, 250),
    metadata: input.metadata,
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id, {
    auto_advance: false,
  });

  if (finalized.status === "paid") return finalized;
  if (!finalized.id) {
    throw new Error("Stripe invoice finalize returned no id.");
  }

  return stripe.invoices.pay(finalized.id, {
    paid_out_of_band: true,
  });
}

export type GrantCryptoMembershipInput = {
  /** Catalog plan used for Stripe price / access length default. */
  planId: PlanId;
  email: string;
  name: string;
  telegramUsername: string;
  telegramUserId?: string;
  discordUsername?: string | null;
  walletAddress: string;
  walletBrand?: string | null;
  chainId: CryptoChainId;
  txHash: string;
  amountUsdc: number;
  /**
   * Access end date. Defaults to plan interval from now.
   * For Victor: 3 months from today.
   */
  accessEndsAt?: Date | string;
  note?: string;
  /** Skip on-chain verify (admin already confirmed tx). */
  skipChainVerify?: boolean;
  updatedBy?: string;
};

export type GrantCryptoMembershipResult = {
  payment: StoredPayment;
  customerId: string;
  subscriptionId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  inviteLink: string | null;
  accessEndsAt: string;
  member: StripeMemberRow;
  alreadyRecorded: boolean;
};

/**
 * Record a crypto USDC payment internally + on Stripe without charging a card.
 * - KV crypto ledger
 * - Stripe customer (preferredPaymentMethod=crypto)
 * - paid_out_of_band invoice for the USDC amount
 * - trialing subscription until accessEndsAt (no card required)
 * - Telegram whitelist + invite
 * - People CRM enrichment
 */
export async function grantCryptoMembership(
  input: GrantCryptoMembershipInput,
): Promise<GrantCryptoMembershipResult> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }
  if (!PLAN_ORDER.includes(input.planId)) {
    throw new Error(`Unknown plan: ${input.planId}`);
  }

  const username = normalizeUsername(input.telegramUsername);
  if (!/^[a-zA-Z0-9_]{2,64}$/.test(username)) {
    throw new Error("Invalid Telegram username.");
  }

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("Valid email is required.");
  }

  const chain = CRYPTO_CHAINS[input.chainId];
  const rawTx = input.txHash.trim();
  const txHash =
    chain.kind === "solana"
      ? rawTx
      : rawTx.startsWith("0x")
        ? rawTx.toLowerCase()
        : `0x${rawTx.toLowerCase()}`;
  const wallet = normalizeWallet(input.walletAddress);
  const telegramUserId =
    input.telegramUserId?.trim() || manualTelegramId(username);
  const amountUsdc = Number(input.amountUsdc);
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
    throw new Error("amountUsdc must be positive.");
  }

  const existingPayment = await findPaymentByTx(txHash);
  if (existingPayment?.stripeSubscriptionId) {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(
      existingPayment.stripeSubscriptionId,
      { expand: ["customer"] },
    );
    return {
      payment: existingPayment,
      customerId: existingPayment.stripeCustomerId || "",
      subscriptionId: existingPayment.stripeSubscriptionId,
      invoiceId: existingPayment.stripeInvoiceId || null,
      invoiceNumber: null,
      invoiceUrl: existingPayment.stripeInvoiceId
        ? `https://dashboard.stripe.com/invoices/${existingPayment.stripeInvoiceId}`
        : null,
      inviteLink: existingPayment.inviteLink,
      accessEndsAt:
        existingPayment.accessEndsAt ||
        periodEndIso(sub) ||
        new Date().toISOString(),
      member: toMemberRow(sub),
      alreadyRecorded: true,
    };
  }

  if (!input.skipChainVerify) {
    const verified =
      chain.kind === "solana"
        ? await verifySolanaUsdcTransfer({
            txHash,
            expectedAmountUsdc: amountUsdc,
          })
        : await verifyEvmUsdcTransfer({
            chainId: input.chainId,
            txHash,
            expectedAmountUsdc: amountUsdc,
          });
    if (!verified.ok) {
      throw new Error(verified.error);
    }
  }

  const accessEnd = input.accessEndsAt
    ? new Date(input.accessEndsAt)
    : (() => {
        const end = new Date();
        const plan = FALLBACK_PLANS[input.planId];
        if (plan.interval === "year") {
          end.setUTCFullYear(end.getUTCFullYear() + plan.intervalCount);
        } else {
          end.setUTCMonth(end.getUTCMonth() + plan.intervalCount);
        }
        return end;
      })();

  if (Number.isNaN(accessEnd.getTime())) {
    throw new Error("Invalid accessEndsAt.");
  }
  if (accessEnd.getTime() <= Date.now() + 60_000) {
    throw new Error("accessEndsAt must be in the future.");
  }

  const stripe = getStripe();
  const priceId = await resolvePriceId(input.planId);
  const paidAt = new Date().toISOString();
  const explorerUrl = chain.explorerTx(txHash);
  const displayName = input.name.trim() || username;

  const discord = input.discordUsername
    ? normalizeUsername(input.discordUsername.replace(/^\./, ""))
    : "";

  const catalogAmountUsdc = FALLBACK_PLANS[input.planId].amountUsd;
  const hasEarlyDiscount =
    Number.isFinite(catalogAmountUsdc) && amountUsdc < catalogAmountUsdc;
  const discountNote = hasEarlyDiscount
    ? `Early customer discount · paid ${amountUsdc} USDC (catalog ${catalogAmountUsdc}).`
    : "";
  const grantNote = [input.note?.trim(), discountNote]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 200);

  /**
   * Customer = durable profile (who they are / how they prefer to pay).
   * Never put one-off payment fields (tx hash, invoice id, paid amount) here.
   */
  const customerMeta: Record<string, string> = {
    app: "the-circle-vip",
    preferredPaymentMethod: "crypto",
    telegramUserId,
    telegramUsername: username,
    discordUsername: discord,
    walletAddress: wallet,
    walletBrand: (input.walletBrand || "").slice(0, 64),
  };

  /**
   * Invoice / line item = this USDC receipt (the single payment).
   */
  const paymentMeta: Record<string, string> = {
    app: "the-circle-vip",
    source: "crypto",
    paymentRail: "crypto_usdc",
    preferredPaymentMethod: "crypto",
    planId: input.planId,
    cryptoTxHash: txHash,
    cryptoChainId: input.chainId,
    cryptoExplorerUrl: explorerUrl.slice(0, 200),
    cryptoAmountUsdc: String(amountUsdc),
    cryptoCatalogAmountUsdc: String(catalogAmountUsdc),
    cryptoPaidAt: paidAt,
    discountType: hasEarlyDiscount ? "early_customer" : "",
    walletAddress: wallet,
    telegramUsername: username,
    telegramUserId,
    note: grantNote,
  };

  let customer = await findCustomerByEmailOrTelegram({
    email,
    telegramUserId,
    telegramUsername: username,
  });

  if (customer) {
    // Drop legacy payment fields that were wrongly stamped on the customer.
    const clearedPaymentFields: Record<string, string> = {
      cryptoTxHash: "",
      cryptoChainId: "",
      cryptoExplorerUrl: "",
      cryptoAmountUsdc: "",
      cryptoCatalogAmountUsdc: "",
      cryptoPaidAt: "",
      cryptoInvoiceId: "",
      paymentRail: "",
      discountType: "",
      planId: "",
      accessEndsAt: "",
      source: "",
      note: "",
      stripeSubscriptionId: "",
      telegramInviteLink: "",
    };
    customer = await stripe.customers.update(customer.id, {
      email,
      name: displayName,
      metadata: {
        ...clearedPaymentFields,
        ...customerMeta,
      },
    });
  } else {
    customer = await stripe.customers.create({
      email,
      name: displayName,
      metadata: customerMeta,
    });
  }

  if (/^\d+$/.test(telegramUserId)) {
    await ensureVipAccess(telegramUserId);
  }
  const { inviteLink } = await createVipInviteLink(username);

  const invoice = await createCryptoPaidOutOfBandInvoice({
    customerId: customer.id,
    amountUsdc,
    description: hasEarlyDiscount
      ? `Crypto USDC · ${input.planId} · ${amountUsdc} paid (catalog ${catalogAmountUsdc}) · early customer · ${txHash.slice(0, 10)}… · ${username}`
      : `Crypto USDC · ${input.planId} · ${txHash.slice(0, 10)}… · ${username}`,
    metadata: paymentMeta,
  });

  if (!invoice.id) {
    throw new Error("Stripe crypto invoice missing id.");
  }
  const invoiceId = invoice.id;

  /** Subscription = access entitlement for this grant (links back to the payment). */
  const subscriptionMeta: Record<string, string> = {
    app: "the-circle-vip",
    source: "crypto",
    preferredPaymentMethod: "crypto",
    planId: input.planId,
    accessEndsAt: accessEnd.toISOString(),
    cryptoTxHash: txHash,
    cryptoChainId: input.chainId,
    cryptoExplorerUrl: explorerUrl.slice(0, 200),
    cryptoInvoiceId: invoiceId,
    cryptoAmountUsdc: String(amountUsdc),
    discountType: hasEarlyDiscount ? "early_customer" : "",
    telegramUserId,
    telegramUsername: username,
    telegramInviteLink: inviteLink ?? "",
    manualGrant: "false",
    note: grantNote,
  };

  const trialEnd = Math.floor(accessEnd.getTime() / 1000);
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_end: trialEnd,
    trial_settings: {
      end_behavior: { missing_payment_method: "cancel" },
    },
    proration_behavior: "none",
    metadata: subscriptionMeta,
    description: `Crypto USDC access through ${accessEnd.toISOString().slice(0, 10)}`,
  });

  await upsertPaidTelegramMember({
    username,
    telegramUserId,
    subscriptionId: subscription.id,
    customerId: customer.id,
    email,
    source: "crypto",
    status: "active",
  });

  const payment: StoredPayment = {
    txHash,
    chainId: input.chainId,
    planId: input.planId,
    amountUsdc,
    telegramUserId,
    telegramUsername: username,
    inviteLink,
    createdAt: paidAt,
    fromAddress: wallet,
    walletBrand: input.walletBrand || null,
    email,
    name: displayName,
    discordUsername: discord || null,
    preferredPaymentMethod: "crypto",
    stripeCustomerId: customer.id,
    stripeSubscriptionId: subscription.id,
    stripeInvoiceId: invoiceId,
    accessEndsAt: accessEnd.toISOString(),
    explorerUrl,
  };

  await recordPayment(payment);

  await upsertPersonEnrichment({
    kind: "member",
    entityId: subscription.id,
    name: displayName,
    email,
    telegramUsername: username,
    discordUsername: discord || null,
    paymentMethods: `Crypto USDC on ${chain.label} · preferred · tx ${txHash}`,
    wallets: [wallet],
    note: [
      input.note?.trim() || null,
      `Access until ${accessEnd.toISOString().slice(0, 10)} (3 months from grant).`,
      `Paid ${amountUsdc} USDC on ${chain.label}.`,
      explorerUrl,
    ]
      .filter(Boolean)
      .join("\n"),
    linkedMemberId: subscription.id,
    updatedBy: input.updatedBy?.trim() || "crypto_grant",
  });

  return {
    payment,
    customerId: customer.id,
    subscriptionId: subscription.id,
    invoiceId,
    invoiceNumber: invoice.number ?? null,
    invoiceUrl:
      invoice.hosted_invoice_url ||
      `https://dashboard.stripe.com/invoices/${invoiceId}`,
    inviteLink,
    accessEndsAt: accessEnd.toISOString(),
    member: toMemberRow(subscription),
    alreadyRecorded: false,
  };
}
