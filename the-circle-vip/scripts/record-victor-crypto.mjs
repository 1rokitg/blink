#!/usr/bin/env node
/**
 * Record a crypto USDC membership on Stripe (no card charge).
 *
 * Metadata layout:
 * - Customer  → profile only (wallet, telegram, preferred PM, …)
 * - Invoice   → this payment (tx hash, amount, chain, discount)
 * - Subscription → access entitlement (links to tx + invoice)
 *
 *   STRIPE_SECRET_KEY=sk_... STRIPE_PRICE_QUARTERLY=price_... \
 *     node scripts/record-victor-crypto.mjs
 */

import Stripe from "stripe";

const TX =
  "0xc826fcf82c0f23a643e3b709b8df3d944262c75515490644ec5a18806e7c11d3";
const WALLET = "0xa2cd74d34383da20f9dd065ae4377e7324bcf708";
const EMAIL = "victor.vozmediano@gmail.com";
const NAME = "VictorV";
const TELEGRAM = "Victor_8892";
const DISCORD = "shark88";
const AMOUNT_USDC = 50;
const CATALOG_USDC = 99;
const CHAIN = "base";
const EXPLORER = `https://basescan.org/tx/${TX}`;
const NOTE =
  "First crypto · early customer discount · 50 USDC paid (catalog quarter 99) · @Victor_8892 · Bimbo88";

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
const quarterly = process.env.STRIPE_PRICE_QUARTERLY?.trim();

if (!secretKey) {
  console.error("Set STRIPE_SECRET_KEY");
  process.exit(1);
}
if (!quarterly) {
  console.error("Set STRIPE_PRICE_QUARTERLY to the Circle quarterly price id");
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-07-29.dahlia",
});

function accessEndThreeMonthsFromNow() {
  const end = new Date();
  end.setUTCMonth(end.getUTCMonth() + 3);
  return end;
}

/** Payment fields that must not live on the customer profile. */
const CLEAR_FROM_CUSTOMER = {
  cryptoTxHash: "",
  cryptoChainId: "",
  cryptoExplorerUrl: "",
  cryptoAmountUsdc: "",
  cryptoCatalogAmountUsdc: "",
  cryptoPaidAt: "",
  cryptoInvoiceId: "",
  paymentRail: "",
  discountType: "",
  catalogAmountUsdc: "",
  paidAmountUsdc: "",
  planId: "",
  accessEndsAt: "",
  source: "",
  note: "",
  stripeSubscriptionId: "",
  stripePriceId: "",
  telegramInviteLink: "",
};

async function findCustomer() {
  try {
    const byEmail = await stripe.customers.search({
      query: `email:"${EMAIL}"`,
      limit: 3,
    });
    if (byEmail.data[0]) return byEmail.data[0];
  } catch {
    const listed = await stripe.customers.list({ email: EMAIL, limit: 3 });
    if (listed.data[0]) return listed.data[0];
  }
  try {
    const byTg = await stripe.customers.search({
      query: `metadata["telegramUsername"]:"${TELEGRAM.toLowerCase()}"`,
      limit: 1,
    });
    if (byTg.data[0]) return byTg.data[0];
  } catch {
    // ignore
  }
  return null;
}

async function main() {
  const accessEndsAt = accessEndThreeMonthsFromNow();
  const trialEnd = Math.floor(accessEndsAt.getTime() / 1000);
  const paidAt = new Date().toISOString();
  const telegramUserId = `manual:${TELEGRAM.toLowerCase()}`;

  const customerMeta = {
    app: "the-circle-vip",
    preferredPaymentMethod: "crypto",
    telegramUserId,
    telegramUsername: TELEGRAM.toLowerCase(),
    discordUsername: DISCORD,
    walletAddress: WALLET,
    legalName: "Victor Vozmediano Mata",
    substackName: "Bimbo88",
    country: "ES",
    city: "Puertollano",
    whopMemberId: "mber_lPjPEbLXSXo54",
  };

  const paymentMeta = {
    app: "the-circle-vip",
    source: "crypto",
    paymentRail: "crypto_usdc",
    preferredPaymentMethod: "crypto",
    planId: "quarter",
    cryptoTxHash: TX,
    cryptoChainId: CHAIN,
    cryptoExplorerUrl: EXPLORER,
    cryptoAmountUsdc: String(AMOUNT_USDC),
    cryptoCatalogAmountUsdc: String(CATALOG_USDC),
    cryptoPaidAt: paidAt,
    discountType: "early_customer",
    walletAddress: WALLET,
    telegramUsername: TELEGRAM.toLowerCase(),
    telegramUserId,
    note: NOTE,
  };

  console.log("Recording Victor crypto membership…");
  console.log(
    `  access ${paidAt.slice(0, 10)} → ${accessEndsAt.toISOString().slice(0, 10)}`,
  );

  let customer = await findCustomer();
  if (customer) {
    customer = await stripe.customers.update(customer.id, {
      email: EMAIL,
      name: NAME,
      metadata: { ...CLEAR_FROM_CUSTOMER, ...customerMeta },
    });
    console.log(`Updated customer ${customer.id} (profile only; cleared payment fields)`);
  } else {
    customer = await stripe.customers.create({
      email: EMAIL,
      name: NAME,
      metadata: customerMeta,
    });
    console.log(`Created customer ${customer.id}`);
  }

  const existingInvoices = await stripe.invoices.list({
    customer: customer.id,
    limit: 20,
  });
  let invoice = existingInvoices.data.find(
    (inv) => inv.metadata?.cryptoTxHash?.toLowerCase() === TX,
  );

  if (!invoice) {
    invoice = await stripe.invoices.create({
      customer: customer.id,
      currency: "usd",
      collection_method: "send_invoice",
      days_until_due: 1,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      metadata: paymentMeta,
      description: `Crypto USDC · quarter · ${AMOUNT_USDC} paid (catalog ${CATALOG_USDC}) · early customer · ${TX.slice(0, 10)}… · @${TELEGRAM}`,
    });
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: AMOUNT_USDC * 100,
      currency: "usd",
      description: `50 USDC on Base · early customer (catalog 99) · 3 months · ${TX}`,
      metadata: paymentMeta,
    });
    invoice = await stripe.invoices.finalizeInvoice(invoice.id, {
      auto_advance: false,
    });
    if (invoice.status !== "paid") {
      invoice = await stripe.invoices.pay(invoice.id, {
        paid_out_of_band: true,
      });
    }
    console.log(`Invoice ${invoice.id} status=${invoice.status} (paid_out_of_band)`);
  } else {
    invoice = await stripe.invoices.update(invoice.id, {
      metadata: paymentMeta,
      description: `Crypto USDC · quarter · ${AMOUNT_USDC} paid (catalog ${CATALOG_USDC}) · early customer · ${TX.slice(0, 10)}… · @${TELEGRAM}`,
    });
    console.log(`Reusing invoice ${invoice.id} (payment metadata refreshed)`);
  }

  const subscriptionMeta = {
    app: "the-circle-vip",
    source: "crypto",
    preferredPaymentMethod: "crypto",
    planId: "quarter",
    accessEndsAt: accessEndsAt.toISOString(),
    cryptoTxHash: TX,
    cryptoChainId: CHAIN,
    cryptoExplorerUrl: EXPLORER,
    cryptoInvoiceId: invoice.id,
    cryptoAmountUsdc: String(AMOUNT_USDC),
    discountType: "early_customer",
    telegramUserId,
    telegramUsername: TELEGRAM.toLowerCase(),
    manualGrant: "false",
    note: NOTE,
  };

  const existingSubs = await stripe.subscriptions.list({
    customer: customer.id,
    status: "all",
    limit: 20,
  });
  let subscription = existingSubs.data.find(
    (sub) =>
      sub.metadata?.cryptoTxHash?.toLowerCase() === TX ||
      (sub.metadata?.source === "crypto" &&
        sub.metadata?.telegramUsername === TELEGRAM.toLowerCase() &&
        ["trialing", "active"].includes(sub.status)),
  );

  if (!subscription) {
    subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: quarterly }],
      trial_end: trialEnd,
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
      proration_behavior: "none",
      metadata: subscriptionMeta,
      description: `Crypto USDC access through ${accessEndsAt.toISOString().slice(0, 10)}`,
    });
    console.log(
      `Subscription ${subscription.id} status=${subscription.status} trial_end=${accessEndsAt.toISOString()}`,
    );
  } else {
    subscription = await stripe.subscriptions.update(subscription.id, {
      trial_end: trialEnd,
      metadata: subscriptionMeta,
      description: `Crypto USDC access through ${accessEndsAt.toISOString().slice(0, 10)}`,
    });
    console.log(`Updated subscription ${subscription.id}`);
  }

  console.log("\nDone — Stripe side recorded (no card charge).");
  console.log(
    JSON.stringify(
      {
        customerId: customer.id,
        customerMeta: "profile only (wallet, telegram, preferred PM, …)",
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        paymentMeta: "tx + amount + chain on invoice/sub",
        telegram: `@${TELEGRAM}`,
        email: EMAIL,
        wallet: WALLET,
        amountUsdc: AMOUNT_USDC,
        accessEndsAt: accessEndsAt.toISOString(),
        preferredPaymentMethod: "crypto",
        tx: EXPLORER,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
