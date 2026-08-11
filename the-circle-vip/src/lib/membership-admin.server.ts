import "server-only";

import type Stripe from "stripe";

import type { StripeMemberRow } from "@/lib/internal-stats-types";
import { collectStripeMemberTags } from "@/lib/member-tags";
import { FALLBACK_PLANS, type PlanId, PLAN_ORDER } from "@/lib/plans";
import { resolvePriceId } from "@/lib/store-config.server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  createVipInviteLink,
  ensureVipAccess,
  revokeVipAccess,
} from "@/lib/telegram";
import {
  deactivatePaidTelegramMember,
  upsertPaidTelegramMember,
} from "@/lib/telegram-paid-whitelist.server";

function normalizeUsername(raw: string) {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

function manualTelegramId(username: string) {
  return `manual:${normalizeUsername(username)}`;
}

function trialDaysForPlan(planId: PlanId) {
  const plan = FALLBACK_PLANS[planId];
  if (plan.interval === "year") return 365 * plan.intervalCount;
  return 30 * plan.intervalCount;
}

function periodEndIso(sub: Stripe.Subscription) {
  const periodEndUnix =
    (sub.items.data[0] as { current_period_end?: number } | undefined)
      ?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
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
    typeof sub.customer === "string"
      ? sub.customer
      : customer?.id || null;
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
    lastPaidAt: null,
    note,
    tags: collectStripeMemberTags({
      subscriptionMetadata: sub.metadata,
      customerMetadata: customer?.metadata,
      subscriptionDescription: sub.description,
      source,
    }),
  };
}

async function findOrCreateCustomer(input: {
  telegramUserId: string;
  telegramUsername: string;
  email?: string | null;
}) {
  const stripe = getStripe();
  try {
    const existing = await stripe.customers.search({
      query: `metadata["telegramUserId"]:"${input.telegramUserId}"`,
      limit: 1,
    });
    if (existing.data[0]) {
      return stripe.customers.update(existing.data[0].id, {
        email: input.email || existing.data[0].email || undefined,
        name: input.telegramUsername,
        metadata: {
          ...existing.data[0].metadata,
          telegramUserId: input.telegramUserId,
          telegramUsername: input.telegramUsername,
          app: "the-circle-vip",
        },
      });
    }
  } catch {
    // search can fail on brand-new accounts — fall through to create
  }

  return stripe.customers.create({
    email: input.email || undefined,
    name: input.telegramUsername,
    metadata: {
      telegramUserId: input.telegramUserId,
      telegramUsername: input.telegramUsername,
      app: "the-circle-vip",
      source: "manual_grant",
    },
  });
}

export type AddMemberInput = {
  planId: PlanId;
  telegramUsername: string;
  telegramUserId?: string;
  email?: string;
  note?: string;
};

export async function addManualMember(input: AddMemberInput) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const username = normalizeUsername(input.telegramUsername);
  if (!/^[a-zA-Z0-9_]{2,64}$/.test(username)) {
    throw new Error("Invalid Telegram username.");
  }

  const telegramUserId =
    input.telegramUserId?.trim() || manualTelegramId(username);
  const priceId = await resolvePriceId(input.planId);
  const customer = await findOrCreateCustomer({
    telegramUserId,
    telegramUsername: username,
    email: input.email?.trim() || null,
  });

  if (/^\d+$/.test(telegramUserId)) {
    await ensureVipAccess(telegramUserId);
  }

  const { inviteLink, skipped } = await createVipInviteLink(username);
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    trial_period_days: trialDaysForPlan(input.planId),
    trial_settings: {
      end_behavior: { missing_payment_method: "cancel" },
    },
    metadata: {
      planId: input.planId,
      telegramUserId,
      telegramUsername: username,
      telegramInviteLink: inviteLink ?? "",
      source: "manual_grant",
      manualGrant: "true",
      app: "the-circle-vip",
      note: (input.note ?? "").slice(0, 200),
    },
  });

  await stripe.customers.update(customer.id, {
    metadata: {
      telegramUserId,
      telegramUsername: username,
      telegramInviteLink: inviteLink ?? "",
      app: "the-circle-vip",
    },
  });

  await upsertPaidTelegramMember({
    username,
    telegramUserId,
    subscriptionId: subscription.id,
    customerId: customer.id,
    email: input.email?.trim() || null,
    source: "manual_grant",
    status: "active",
  });

  return {
    member: toMemberRow(subscription),
    inviteLink,
    telegramInviteSkipped: skipped,
    telegramNote:
      "Telegram group: send this invite manually for now. Bot auto-kick lands later.",
  };
}

export type TransferMemberInput = {
  subscriptionId: string;
  toTelegramUsername: string;
  toTelegramUserId?: string;
};

export async function transferMembership(input: TransferMemberInput) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const username = normalizeUsername(input.toTelegramUsername);
  if (!/^[a-zA-Z0-9_]{2,64}$/.test(username)) {
    throw new Error("Invalid Telegram username.");
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
  const fromUserId = subscription.metadata?.telegramUserId?.trim() || "";
  const toUserId =
    input.toTelegramUserId?.trim() || manualTelegramId(username);

  if (fromUserId && /^\d+$/.test(fromUserId) && fromUserId !== toUserId) {
    await revokeVipAccess(fromUserId);
  }
  if (/^\d+$/.test(toUserId)) {
    await ensureVipAccess(toUserId);
  }

  const { inviteLink, skipped } = await createVipInviteLink(username);
  const updated = await stripe.subscriptions.update(input.subscriptionId, {
    metadata: {
      ...subscription.metadata,
      telegramUserId: toUserId,
      telegramUsername: username,
      telegramInviteLink: inviteLink ?? "",
      transferredAt: new Date().toISOString(),
      previousTelegramUserId: fromUserId,
    },
  });

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (customerId) {
    await stripe.customers.update(customerId, {
      name: username,
      metadata: {
        telegramUserId: toUserId,
        telegramUsername: username,
        telegramInviteLink: inviteLink ?? "",
        app: "the-circle-vip",
      },
    });
  }

  const fromUsername = subscription.metadata?.telegramUsername?.trim() || null;
  if (fromUsername) {
    await deactivatePaidTelegramMember({
      username: fromUsername,
      telegramUserId: fromUserId || null,
      subscriptionId: input.subscriptionId,
    });
  }
  await upsertPaidTelegramMember({
    username,
    telegramUserId: toUserId,
    subscriptionId: input.subscriptionId,
    customerId: customerId ?? null,
    source: subscription.metadata?.source?.trim() || "transfer",
    status: "active",
  });

  return {
    member: toMemberRow(updated),
    inviteLink,
    telegramInviteSkipped: skipped,
    fromUserId: fromUserId || null,
    telegramNote:
      "Transfer recorded. Remove the old user from Telegram manually if the bot did not kick them.",
  };
}

export type RevokeMemberInput = {
  subscriptionId: string;
  immediate?: boolean;
};

export async function revokeMembership(input: RevokeMemberInput) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
  const telegramUserId = subscription.metadata?.telegramUserId?.trim() || "";

  let telegramRevoke: Awaited<ReturnType<typeof revokeVipAccess>> | null =
    null;
  if (telegramUserId) {
    telegramRevoke = await revokeVipAccess(telegramUserId);
  }

  const updated = input.immediate
    ? await stripe.subscriptions.cancel(input.subscriptionId)
    : await stripe.subscriptions.update(input.subscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          ...subscription.metadata,
          revokedAt: new Date().toISOString(),
          revokeMode: "period_end",
        },
      });

  if (input.immediate) {
    await deactivatePaidTelegramMember({
      username: subscription.metadata?.telegramUsername?.trim() || null,
      telegramUserId: telegramUserId || null,
      subscriptionId: input.subscriptionId,
    });
  }

  return {
    member: toMemberRow(updated),
    telegramRevoke,
    telegramNote: input.immediate
      ? "Subscription canceled. Remove them from the Telegram group manually if still present."
      : "Subscription will end at period close. Remove them from Telegram when access should stop.",
  };
}

export async function refreshMemberInvite(subscriptionId: string) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const username =
    subscription.metadata?.telegramUsername?.trim() ||
    subscription.metadata?.telegramUserId?.trim() ||
    "member";

  const telegramUserId = subscription.metadata?.telegramUserId?.trim() || "";
  if (/^\d+$/.test(telegramUserId)) {
    await ensureVipAccess(telegramUserId);
  }

  const { inviteLink, skipped } = await createVipInviteLink(username);
  if (!inviteLink && !skipped) {
    throw new Error("Failed to create invite link.");
  }

  const updated = await stripe.subscriptions.update(subscriptionId, {
    metadata: {
      ...subscription.metadata,
      telegramInviteLink: inviteLink ?? "",
      inviteRefreshedAt: new Date().toISOString(),
    },
  });

  return {
    member: toMemberRow(updated),
    inviteLink,
    telegramInviteSkipped: skipped,
    telegramNote:
      "New single-use invite ready — send it manually in Telegram for now.",
  };
}
