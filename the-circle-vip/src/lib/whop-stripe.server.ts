import "server-only";

import type Stripe from "stripe";

import { isInPersonCustomer } from "@/lib/lead-classification";
import type { LeadRecord, LeadStatus } from "@/lib/leads-types";
import type { StripeMemberRow } from "@/lib/internal-stats-types";
import {
  WHOP_BILLING_CYCLE_DAYS,
  addDaysIso,
} from "@/lib/members-due";
import {
  EARLY_CUSTOMER_DISCOUNT_TAG,
  collectStripeMemberTags,
} from "@/lib/member-tags";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export type WhopStripePayment = {
  invoiceId: string;
  customerId: string | null;
  email: string | null;
  amountUsd: number;
  currency: string;
  status: string;
  description: string | null;
  paidAt: string;
  country: string | null;
  whopPaymentId: string | null;
  method: string | null;
  tag: string;
  source: string;
};

export type WhopStripeMember = {
  customerId: string;
  email: string | null;
  name: string | null;
  telegramUsername: string | null;
  telegramUserId: string | null;
  whopMemberId: string | null;
  whopUserId: string | null;
  active: boolean;
  country: string | null;
  joinedAt: string | null;
  churnedAt: string | null;
  created: string;
};

function asIso(unix: number | null | undefined) {
  if (!unix) return null;
  return new Date(unix * 1000).toISOString();
}

function paidAtFromInvoice(invoice: Stripe.Invoice): string {
  const meta = invoice.metadata?.paid_at?.trim();
  if (meta) {
    const parsed = Date.parse(meta);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  const paidUnix = invoice.status_transitions?.paid_at ?? invoice.created;
  return new Date(paidUnix * 1000).toISOString();
}

async function listPaidWhopInvoices(stripe: Stripe, limit = 200) {
  const out: Stripe.Invoice[] = [];
  try {
    let startingAfter: string | undefined;
    for (let page = 0; page < 10 && out.length < limit; page += 1) {
      const result = await stripe.invoices.search({
        query: `metadata["source"]:"whop" AND status:"paid"`,
        limit: Math.min(100, limit - out.length),
        page: startingAfter,
      });
      out.push(...result.data);
      if (!result.has_more || !result.next_page) break;
      startingAfter = result.next_page;
    }
  } catch {
    // Search unavailable — fall back to recent paid invoices filtered in memory.
    let startingAfter: string | undefined;
    for (let i = 0; i < 10 && out.length < limit; i += 1) {
      const page = await stripe.invoices.list({
        status: "paid",
        limit: 100,
        starting_after: startingAfter,
      });
      for (const invoice of page.data) {
        if (
          invoice.metadata?.source === "whop" ||
          invoice.metadata?.tag === "Whop"
        ) {
          out.push(invoice);
        }
      }
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1]?.id;
    }
  }
  return out.slice(0, limit);
}

async function listWhopCustomers(stripe: Stripe, limit = 200) {
  const out: Stripe.Customer[] = [];
  try {
    let startingAfter: string | undefined;
    for (let page = 0; page < 10 && out.length < limit; page += 1) {
      const result = await stripe.customers.search({
        query: `metadata["source"]:"whop_member"`,
        limit: Math.min(100, limit - out.length),
        page: startingAfter,
      });
      out.push(...result.data);
      if (!result.has_more || !result.next_page) break;
      startingAfter = result.next_page;
    }
  } catch {
    let startingAfter: string | undefined;
    for (let i = 0; i < 10 && out.length < limit; i += 1) {
      const page = await stripe.customers.list({
        limit: 100,
        starting_after: startingAfter,
      });
      for (const customer of page.data) {
        if (customer.metadata?.source === "whop_member") out.push(customer);
      }
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1]?.id;
    }
  }
  return out.slice(0, limit);
}

function mapInvoiceToPayment(invoice: Stripe.Invoice): WhopStripePayment {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer && !invoice.customer.deleted
        ? invoice.customer.id
        : null;
  const customerObj =
    typeof invoice.customer === "object" &&
    invoice.customer &&
    !invoice.customer.deleted
      ? invoice.customer
      : null;
  const lineMeta = invoice.lines.data[0]?.metadata;
  const source: string =
    invoice.metadata?.source ||
    lineMeta?.source ||
    (invoice.metadata?.claimId || lineMeta?.claimId ? "claim_link" : "stripe");
  const isWhop = source === "whop" || invoice.metadata?.tag === "Whop";
  const isClaim =
    source === "claim_link" ||
    Boolean(invoice.metadata?.claimId || lineMeta?.claimId) ||
    invoice.metadata?.discount === "early_customer" ||
    lineMeta?.discount === "early_customer" ||
    invoice.metadata?.tag === EARLY_CUSTOMER_DISCOUNT_TAG ||
    lineMeta?.tag === EARLY_CUSTOMER_DISCOUNT_TAG;

  return {
    invoiceId: invoice.id ?? "",
    customerId,
    email: invoice.customer_email || customerObj?.email || null,
    amountUsd: (invoice.amount_paid || invoice.total || 0) / 100,
    currency: invoice.currency,
    status: invoice.status ?? "paid",
    description:
      invoice.description || invoice.lines.data[0]?.description || null,
    paidAt: paidAtFromInvoice(invoice),
    country: invoice.metadata?.country?.toUpperCase() || null,
    whopPaymentId: invoice.metadata?.whop_payment_id || null,
    method: invoice.metadata?.whop_method || null,
    tag:
      invoice.metadata?.tag ||
      lineMeta?.tag ||
      (isWhop
        ? "Whop"
        : isClaim
          ? EARLY_CUSTOMER_DISCOUNT_TAG
          : "Stripe"),
    source: isWhop ? "whop" : source,
  };
}

export async function listWhopPaymentsFromStripe(
  limit = 200,
): Promise<WhopStripePayment[]> {
  if (!isStripeConfigured()) return [];
  const stripe = getStripe();
  const invoices = await listPaidWhopInvoices(stripe, limit);
  return invoices
    .map(mapInvoiceToPayment)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

/** All paid Stripe invoices (native + Whop migrations) for Payments / People. */
export async function listAllStripePayments(
  limit = 300,
): Promise<WhopStripePayment[]> {
  if (!isStripeConfigured()) return [];
  const stripe = getStripe();
  const out: Stripe.Invoice[] = [];
  let startingAfter: string | undefined;
  for (let i = 0; i < 15 && out.length < limit; i += 1) {
    const page = await stripe.invoices.list({
      status: "paid",
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.customer"],
    });
    out.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
  return out
    .slice(0, limit)
    .map(mapInvoiceToPayment)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

export async function listWhopMembersFromStripe(
  limit = 200,
): Promise<WhopStripeMember[]> {
  if (!isStripeConfigured()) return [];
  const stripe = getStripe();
  const customers = await listWhopCustomers(stripe, limit);

  return customers
    .filter((customer) => !isInPersonCustomer(customer.name))
    .map((customer) => ({
      customerId: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
      telegramUsername: customer.metadata?.telegramUsername || null,
      telegramUserId: customer.metadata?.telegramUserId || null,
      whopMemberId: customer.metadata?.whop_member_id || null,
      whopUserId: customer.metadata?.whop_user_id || null,
      active: customer.metadata?.whop_active !== "false",
      country: customer.metadata?.country || null,
      joinedAt: customer.metadata?.whop_joined_at || asIso(customer.created),
      churnedAt: customer.metadata?.whop_churned_at || null,
      created: asIso(customer.created) ?? new Date().toISOString(),
    }))
    .sort((a, b) => (b.joinedAt ?? "").localeCompare(a.joinedAt ?? ""));
}

function whopLeadId(member: WhopStripeMember) {
  const key = (member.whopMemberId || member.customerId).replace(
    /[^a-zA-Z0-9_]/g,
    "",
  );
  return `ld_whop_${key}`.slice(0, 80);
}

function leadStatusForWhopMember(
  member: WhopStripeMember,
  hasPaidInvoice: boolean,
): LeadStatus {
  if (!member.active || member.churnedAt) return "lost";
  // In-person cash comps are not a conversion pipeline.
  if (isInPersonCustomer(member.name)) return "member";
  // Unpaid Whop migrants are open leads until they convert on Stripe.
  if (!hasPaidInvoice) return "new";
  return "member";
}

/** Map Stripe Whop customers into LeadRecord shape for the CRM board. */
export async function listWhopLeadsFromStripe(
  limit = 200,
): Promise<LeadRecord[]> {
  const [members, payments] = await Promise.all([
    listWhopMembersFromStripe(limit),
    listWhopPaymentsFromStripe(Math.max(limit, 300)),
  ]);

  const paidCustomerIds = new Set<string>();
  const paidEmails = new Set<string>();
  for (const payment of payments) {
    if (payment.status !== "paid" || payment.amountUsd <= 0) continue;
    if (payment.customerId) paidCustomerIds.add(payment.customerId);
    if (payment.email) paidEmails.add(payment.email.toLowerCase());
  }

  const now = new Date().toISOString();
  return members
    .filter((member) => !isInPersonCustomer(member.name))
    .map((member) => {
      const hasPaidInvoice =
        paidCustomerIds.has(member.customerId) ||
        Boolean(
          member.email && paidEmails.has(member.email.toLowerCase()),
        );
      const status = leadStatusForWhopMember(member, hasPaidInvoice);
      return {
        id: whopLeadId(member),
        email: member.email,
        telegramUsername: member.telegramUsername,
        name: member.name,
        source: "whop_member",
        channel: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referrer: null,
        note: [
          status === "new"
            ? "Whop member — no paid invoice (lead)"
            : status === "member"
              ? "Whop member — paid history on Stripe"
              : "Inactive / churned on Whop",
          member.country ? `Country ${member.country}` : null,
          member.joinedAt ? `Joined ${member.joinedAt.slice(0, 10)}` : null,
          `Stripe ${member.customerId}`,
          member.whopMemberId ? `Whop ${member.whopMemberId}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 400),
        status,
        createdAt: member.joinedAt
          ? new Date(member.joinedAt).toISOString()
          : member.created,
        createdBy: "stripe:whop_member",
        updatedAt: now,
      } satisfies LeadRecord;
    });
}

export async function getWhopStripeTotals() {
  const [members, payments] = await Promise.all([
    listWhopMembersFromStripe(300),
    listWhopPaymentsFromStripe(300),
  ]);
  return {
    members: members.length,
    activeMembers: members.filter((m) => m.active).length,
    payments: payments.length,
    grossUsd: payments.reduce((sum, row) => sum + row.amountUsd, 0),
  };
}

export type WhopRecurringMetrics = {
  /** Active Whop customers on Stripe (`whop_active=true`). */
  activeMembers: number;
  /** Active members with at least one paid Whop invoice. */
  payingMembers: number;
  /**
   * Extrapolated MRR: for each active paying member, use their latest paid
   * Whop invoice amount as a monthly run-rate (Season Pass was monthly).
   */
  mrr: number;
  grossUsd: number;
  members: StripeMemberRow[];
};

/**
 * Derive membership/MRR from Stripe Whop customers + paid invoices.
 * Used until native Stripe subscriptions exist for these migrants.
 */
export async function getWhopRecurringMetricsFromStripe(): Promise<WhopRecurringMetrics> {
  const [members, payments] = await Promise.all([
    listWhopMembersFromStripe(300),
    listWhopPaymentsFromStripe(300),
  ]);

  const latestByCustomer = new Map<
    string,
    { amountUsd: number; paidAt: string; description: string | null }
  >();
  const latestByEmail = new Map<
    string,
    { amountUsd: number; paidAt: string; description: string | null }
  >();

  for (const payment of payments) {
    if (payment.status !== "paid" || payment.amountUsd <= 0) continue;
    const row = {
      amountUsd: payment.amountUsd,
      paidAt: payment.paidAt,
      description: payment.description,
    };
    if (payment.customerId) {
      const prev = latestByCustomer.get(payment.customerId);
      if (!prev || payment.paidAt > prev.paidAt) {
        latestByCustomer.set(payment.customerId, row);
      }
    }
    if (payment.email) {
      const email = payment.email.toLowerCase();
      const prev = latestByEmail.get(email);
      if (!prev || payment.paidAt > prev.paidAt) {
        latestByEmail.set(email, row);
      }
    }
  }

  let mrr = 0;
  let payingMembers = 0;
  const active = members.filter((m) => m.active && !m.churnedAt);
  const memberRows: StripeMemberRow[] = [];

  for (const member of active) {
    const latest =
      latestByCustomer.get(member.customerId) ||
      (member.email
        ? latestByEmail.get(member.email.toLowerCase())
        : undefined);
    const monthly = latest?.amountUsd ?? 0;
    if (monthly > 0) {
      mrr += monthly;
      payingMembers += 1;
    }

    const lastPaidAt = latest?.paidAt ?? null;
    const dueAt = lastPaidAt
      ? addDaysIso(lastPaidAt, WHOP_BILLING_CYCLE_DAYS)
      : null;

    memberRows.push({
      id: member.customerId,
      customerId: member.customerId,
      email: member.email,
      name: member.name,
      telegramUsername: member.telegramUsername,
      telegramUserId: member.telegramUserId,
      planId: "whop_season_pass",
      planLabel: "Whop · Season Pass",
      status: monthly > 0 ? "active" : "trialing",
      mrr: monthly,
      created: member.joinedAt || member.created,
      cancelAtPeriodEnd: false,
      inviteLink: null,
      source: "whop_member",
      currentPeriodEnd: dueAt,
      dueAt,
      dueKind: dueAt ? "whop_estimate" : null,
      lastPaidAt,
      note: [
        "Extrapolated from Whop paid history on Stripe",
        latest
                  ? `Last paid €${latest.amountUsd.toFixed(2)} · next due ≈ last paid + ${WHOP_BILLING_CYCLE_DAYS}d`
          : "No paid Whop invoice",
        member.whopMemberId ? `Whop ${member.whopMemberId}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      tags: collectStripeMemberTags({
        customerMetadata: { tag: "Whop", source: "whop_member" },
        source: "whop_member",
      }),
    });
  }

  memberRows.sort((a, b) => Date.parse(b.created) - Date.parse(a.created));

  return {
    activeMembers: active.length,
    payingMembers,
    mrr: Math.round(mrr * 100) / 100,
    grossUsd: payments.reduce((sum, row) => sum + row.amountUsd, 0),
    members: memberRows,
  };
}
