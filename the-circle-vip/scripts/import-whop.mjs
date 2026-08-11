#!/usr/bin/env node
/**
 * Sync bundled Whop seed → Stripe customers + paid-out-of-band invoices.
 * Local KV/leads are handled by the app API; this script focuses on Stripe.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/import-whop.mjs
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/import-whop.mjs --dry-run
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.error("Set STRIPE_SECRET_KEY before running this script.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-07-29.dahlia",
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeEmail(value) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

async function findCustomerByWhopId(whopMemberId) {
  try {
    const found = await stripe.customers.search({
      query: `metadata["whop_member_id"]:"${whopMemberId}"`,
      limit: 1,
    });
    return found.data[0] ?? null;
  } catch {
    return null;
  }
}

async function findCustomerByEmail(email) {
  const listed = await stripe.customers.list({ email, limit: 5 });
  return listed.data.find((c) => !c.deleted) ?? null;
}

async function findInvoiceByWhopPayment(whopPaymentId) {
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

const seed = JSON.parse(
  await readFile(path.join(root, "data/whop/seed.json"), "utf8"),
);

console.log(
  `Whop seed: ${seed.members.length} members, ${seed.payments.length} paid payments, $${seed.totals.grossUsd} gross`,
);
if (dryRun) {
  console.log("Dry run — no Stripe writes.");
  process.exit(0);
}

const customerByEmail = new Map();
const summary = {
  customersCreated: 0,
  customersUpdated: 0,
  invoicesCreated: 0,
  invoicesSkipped: 0,
  errors: [],
};

for (const member of seed.members) {
  try {
    const email = normalizeEmail(member.email);
    const telegramUsername = member.telegramUsername?.replace(/^@/, "") || null;
    const name =
      member.name?.trim() ||
      telegramUsername ||
      member.username?.trim() ||
      email ||
      member.whopMemberId;

    let existing =
      (await findCustomerByWhopId(member.whopMemberId)) ||
      (email ? await findCustomerByEmail(email) : null);

    const metadata = {
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

    let customer;
    if (existing) {
      customer = await stripe.customers.update(existing.id, {
        email: email || existing.email || undefined,
        name,
        metadata,
      });
      summary.customersUpdated += 1;
    } else {
      customer = await stripe.customers.create({
        email: email || undefined,
        name,
        metadata,
      });
      summary.customersCreated += 1;
    }

    if (email) customerByEmail.set(email, customer.id);
    process.stdout.write(".");
    await sleep(80);
  } catch (error) {
    summary.errors.push(
      `member ${member.whopMemberId}: ${error?.message ?? error}`,
    );
    process.stdout.write("x");
  }
}

process.stdout.write("\n");

for (const payment of seed.payments) {
  if (payment.status !== "paid") continue;
  try {
    const email = normalizeEmail(payment.email);
    let customerId = email ? customerByEmail.get(email) : null;
    if (!customerId && email) {
      const customer =
        (await findCustomerByEmail(email)) ??
        (await stripe.customers.create({
          email,
          name: email,
          metadata: {
            app: "the-circle-vip",
            source: "whop_member",
            tag: "Whop",
          },
        }));
      customerId = customer.id;
      customerByEmail.set(email, customerId);
    }
    if (!customerId) {
      summary.errors.push(`payment ${payment.whopPaymentId}: no customer`);
      continue;
    }

    const prior = await findInvoiceByWhopPayment(payment.whopPaymentId);
    if (prior?.status === "paid") {
      summary.invoicesSkipped += 1;
      process.stdout.write("s");
      continue;
    }
    if (prior && (prior.status === "draft" || prior.status === "open")) {
      try {
        if (prior.status === "open") await stripe.invoices.voidInvoice(prior.id);
        else await stripe.invoices.del(prior.id);
      } catch {
        // continue and try a fresh invoice
      }
    }

    const amountCents = Math.max(1, Math.round(payment.amountUsd * 100));
    const description = `${payment.description ?? "Whop payment"} (Whop import)`.slice(
      0,
      250,
    );

    // Explicit USD — account/customer default may be EUR and conflict with items.
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
    if (finalized.status !== "paid") {
      await stripe.invoices.pay(finalized.id, { paid_out_of_band: true });
    }

    summary.invoicesCreated += 1;
    process.stdout.write("+");
    await sleep(120);
  } catch (error) {
    summary.errors.push(
      `payment ${payment.whopPaymentId}: ${error?.message ?? error}`,
    );
    process.stdout.write("x");
  }
}

process.stdout.write("\n");
console.log(JSON.stringify(summary, null, 2));

const outDir = path.join(root, ".data");
await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, "whop-stripe-sync.json"),
  JSON.stringify({ finishedAt: new Date().toISOString(), summary }, null, 2),
);
