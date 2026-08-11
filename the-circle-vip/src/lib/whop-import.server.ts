import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type Stripe from "stripe";

import { isInPersonCustomer } from "@/lib/lead-classification";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import bundledWhopSeed from "@/lib/whop-seed.json";
import type {
  WhopImportResult,
  WhopSeed,
  WhopSeedMember,
  WhopSeedPayment,
} from "@/lib/whop-types";

/**
 * One-time Whop → Stripe migration writer.
 * After import, Stripe is the source of truth for customers + payments.
 * Dashboard reads use `@/lib/whop-stripe.server` (Stripe Search), not KV.
 */

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

function normalizeUsername(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/^@/, "") ?? "";
  return trimmed || null;
}

export async function loadWhopSeed(): Promise<WhopSeed> {
  try {
    const file = path.join(process.cwd(), "data", "whop", "seed.json");
    const raw = await readFile(file, "utf8");
    const seed = JSON.parse(raw) as WhopSeed;
    if (Array.isArray(seed.members) && Array.isArray(seed.payments)) {
      return seed;
    }
  } catch {
    // fall through to bundled seed
  }

  const seed = bundledWhopSeed as WhopSeed;
  if (!Array.isArray(seed.members) || !Array.isArray(seed.payments)) {
    throw new Error("Invalid Whop seed — missing members/payments.");
  }
  return seed;
}

async function findStripeCustomerByEmail(
  stripe: Stripe,
  email: string,
): Promise<Stripe.Customer | null> {
  const listed = await stripe.customers.list({ email, limit: 5 });
  return listed.data.find((c) => !c.deleted) ?? null;
}

async function findStripeCustomerByWhopId(
  stripe: Stripe,
  whopMemberId: string,
): Promise<Stripe.Customer | null> {
  try {
    const found = await stripe.customers.search({
      query: `metadata["whop_member_id"]:"${whopMemberId}"`,
      limit: 3,
    });
    return found.data.find((c) => !c.deleted) ?? null;
  } catch {
    return null;
  }
}

async function findStripeInvoiceByWhopPayment(
  stripe: Stripe,
  whopPaymentId: string,
): Promise<Stripe.Invoice | null> {
  try {
    const found = await stripe.invoices.search({
      query: `metadata["whop_payment_id"]:"${whopPaymentId}"`,
      limit: 1,
    });
    return found.data[0] ?? null;
  } catch {
    return null;
  }
}

async function upsertStripeCustomer(
  stripe: Stripe,
  member: WhopSeedMember,
): Promise<{ customer: Stripe.Customer; created: boolean }> {
  const email = normalizeEmail(member.email);
  const telegramUsername = normalizeUsername(member.telegramUsername);
  const name =
    member.name?.trim() ||
    telegramUsername ||
    member.username?.trim() ||
    email ||
    member.whopMemberId;

  const existing =
    (await findStripeCustomerByWhopId(stripe, member.whopMemberId)) ||
    (email ? await findStripeCustomerByEmail(stripe, email) : null);

  const metadata: Record<string, string> = {
    ...(existing?.metadata ?? {}),
    app: "the-circle-vip",
    source: "whop_member",
    tag: "Whop",
    whop_member_id: member.whopMemberId,
    whop_user_id: member.whopUserId,
    whop_active: member.active ? "true" : "false",
    whop_joined_at: member.joinedAt ?? "",
    whop_churned_at: member.churnedAt ?? "",
    country: member.country ?? "",
  };
  if (telegramUsername) metadata.telegramUsername = telegramUsername;
  if (member.telegramId) metadata.telegramUserId = member.telegramId;
  if (member.username) metadata.whop_username = member.username;

  if (existing) {
    const customer = await stripe.customers.update(existing.id, {
      email: email || existing.email || undefined,
      name,
      metadata,
    });
    return { customer, created: false };
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    name,
    metadata,
  });
  return { customer, created: true };
}

async function createPaidOutOfBandInvoice(
  stripe: Stripe,
  customerId: string,
  payment: WhopSeedPayment,
): Promise<Stripe.Invoice> {
  const amountCents = Math.max(1, Math.round(payment.amountUsd * 100));
  const description =
    `${payment.description ?? "Whop payment"} (Whop import)`.slice(0, 250);

  const invoice = await stripe.invoices.create({
    customer: customerId,
    currency: "usd",
    collection_method: "send_invoice",
    days_until_due: 1,
    auto_advance: false,
    pending_invoice_items_behavior: "exclude",
    metadata: {
      source: "whop",
      tag: "Whop",
      whop_payment_id: payment.whopPaymentId,
      whop_method: payment.method ?? "",
      whop_billing_reason: payment.billingReason ?? "",
      paid_at: payment.paidAt,
      country: payment.country ?? "",
    },
    description,
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: invoice.id,
    amount: amountCents,
    currency: "usd",
    description: (payment.description ?? "Whop payment").slice(0, 250),
    metadata: {
      source: "whop",
      tag: "Whop",
      whop_payment_id: payment.whopPaymentId,
    },
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id, {
    auto_advance: false,
  });

  if (finalized.status === "paid") return finalized;

  return stripe.invoices.pay(finalized.id, {
    paid_out_of_band: true,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RunWhopImportOptions = {
  dryRun?: boolean;
  syncStripe?: boolean;
  createdBy?: string;
};

/** Writes Whop seed into Stripe only (idempotent). Does not use KV. */
export async function runWhopImport(
  options: RunWhopImportOptions = {},
): Promise<WhopImportResult> {
  const dryRun = Boolean(options.dryRun);
  const syncStripe = options.syncStripe !== false;
  const seed = await loadWhopSeed();

  const result: WhopImportResult = {
    ok: true,
    dryRun,
    syncStripe,
    members: {
      total: seed.members.length,
      upserted: 0,
      skipped: 0,
      stripeCustomersCreated: 0,
      stripeCustomersUpdated: 0,
      stripeSkipped: 0,
    },
    payments: {
      total: seed.payments.length,
      upserted: 0,
      skipped: 0,
      stripeInvoicesCreated: 0,
      stripeInvoicesSkipped: 0,
    },
    leads: { upserted: 0 },
    grossUsd: seed.totals.grossUsd,
    errors: [],
    finishedAt: new Date().toISOString(),
  };

  if (dryRun) {
    result.members.upserted = seed.members.length;
    result.payments.upserted = seed.payments.length;
    result.finishedAt = new Date().toISOString();
    return result;
  }

  if (!syncStripe || !isStripeConfigured()) {
    result.ok = false;
    result.errors.push(
      "Stripe is required — customers/payments use Stripe as source of truth.",
    );
    result.finishedAt = new Date().toISOString();
    return result;
  }

  const stripe = getStripe();
  const customerByEmail = new Map<string, string>();

  for (const member of seed.members) {
    // Whop export bug — placeholder "In-person customer" rows are not real members.
    if (isInPersonCustomer(member.name)) {
      result.members.skipped += 1;
      continue;
    }
    try {
      const { customer, created } = await upsertStripeCustomer(stripe, member);
      if (created) result.members.stripeCustomersCreated += 1;
      else result.members.stripeCustomersUpdated += 1;
      result.members.upserted += 1;
      const email = normalizeEmail(member.email);
      if (email) customerByEmail.set(email, customer.id);
      await sleep(40);
    } catch (error) {
      result.ok = false;
      result.errors.push(
        `member ${member.whopMemberId}: ${
          error instanceof Error ? error.message : "failed"
        }`,
      );
      result.members.skipped += 1;
    }
  }

  for (const payment of seed.payments) {
    if (payment.status !== "paid") {
      result.payments.skipped += 1;
      continue;
    }

    try {
      const email = normalizeEmail(payment.email);
      let stripeCustomerId = email ? customerByEmail.get(email) ?? null : null;

      if (!stripeCustomerId && email) {
        const customer =
          (await findStripeCustomerByEmail(stripe, email)) ??
          (await stripe.customers.create({
            email,
            name: email,
            metadata: {
              app: "the-circle-vip",
              source: "whop_member",
              tag: "Whop",
            },
          }));
        stripeCustomerId = customer.id;
        customerByEmail.set(email, customer.id);
      }

      if (!stripeCustomerId) {
        result.payments.skipped += 1;
        result.errors.push(`payment ${payment.whopPaymentId}: no customer`);
        continue;
      }

      const prior = await findStripeInvoiceByWhopPayment(
        stripe,
        payment.whopPaymentId,
      );

      if (prior?.status === "paid") {
        result.payments.stripeInvoicesSkipped += 1;
        result.payments.upserted += 1;
        continue;
      }

      if (prior && (prior.status === "draft" || prior.status === "open")) {
        try {
          if (prior.status === "open") {
            await stripe.invoices.voidInvoice(prior.id);
          } else {
            await stripe.invoices.del(prior.id);
          }
        } catch {
          // create a fresh invoice below
        }
      }

      await createPaidOutOfBandInvoice(stripe, stripeCustomerId, payment);
      result.payments.stripeInvoicesCreated += 1;
      result.payments.upserted += 1;
      await sleep(60);
    } catch (error) {
      result.ok = false;
      result.errors.push(
        `payment ${payment.whopPaymentId}: ${
          error instanceof Error ? error.message : "failed"
        }`,
      );
      result.payments.skipped += 1;
    }
  }

  result.finishedAt = new Date().toISOString();
  return result;
}
