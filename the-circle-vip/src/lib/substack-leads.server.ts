import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { upsertLeadsBulk } from "@/lib/leads.server";
import type { LeadRecord, LeadStatus } from "@/lib/leads-types";
import {
  isSubstackMeta,
  type SubstackLeadMeta,
  type SubstackStripePayments,
} from "@/lib/substack-meta";
import { listAllStripePayments } from "@/lib/whop-stripe.server";

export type SubstackSeedMeta = {
  importedAt: string;
  partner: string;
  publication: string;
  sourceFile: string;
  uniqueUsers: number;
  emailable: number;
  paid: number;
  free: number;
  totalRevenue?: number;
  currency?: string;
};

type SubstackSeedLead = {
  id: string;
  email: string | null;
  telegramUsername: string | null;
  name: string | null;
  source: string;
  channel: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
  note: string | null;
  status: LeadStatus;
  createdAt: string;
  createdBy: string;
  meta?: SubstackLeadMeta | null;
};

async function readSeed(): Promise<{
  meta: SubstackSeedMeta;
  leads: SubstackSeedLead[];
} | null> {
  try {
    const file = path.join(process.cwd(), "data/substack/leads.json");
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as SubstackSeedMeta & {
      leads: SubstackSeedLead[];
    };
    return {
      meta: {
        importedAt: parsed.importedAt,
        partner: parsed.partner,
        publication: parsed.publication,
        sourceFile: parsed.sourceFile,
        uniqueUsers: parsed.uniqueUsers,
        emailable: parsed.emailable,
        paid: parsed.paid,
        free: parsed.free,
        totalRevenue: parsed.totalRevenue,
        currency: parsed.currency,
      },
      leads: (parsed.leads ?? []).map((row) => ({
        ...row,
        meta: normalizeSeedMeta(row.meta),
      })),
    };
  } catch {
    return null;
  }
}

/** Accept legacy seed keys (revenue / isPaid) and normalize to export*. */
function normalizeSeedMeta(meta: unknown): SubstackLeadMeta | null {
  if (!meta || typeof meta !== "object") return null;
  const row = meta as Record<string, unknown>;
  if (row.kind !== "substack") return null;
  const exportRevenue =
    typeof row.exportRevenue === "number"
      ? row.exportRevenue
      : typeof row.revenue === "number"
        ? row.revenue
        : 0;
  const exportRevenueLabel =
    typeof row.exportRevenueLabel === "string"
      ? row.exportRevenueLabel
      : typeof row.revenueLabel === "string"
        ? row.revenueLabel
        : "€0.00";
  const exportCurrency =
    typeof row.exportCurrency === "string"
      ? row.exportCurrency
      : typeof row.currency === "string"
        ? row.currency
        : null;
  const isPaidExport = Boolean(
    row.isPaidExport ?? row.isPaid ?? exportRevenue > 0,
  );
  return {
    kind: "substack",
    publication:
      typeof row.publication === "string" ? row.publication : "rokitg's circle",
    type: typeof row.type === "string" ? row.type : "Free",
    stripePlan:
      typeof row.stripePlan === "string" ? row.stripePlan : null,
    exportRevenue,
    exportRevenueLabel,
    exportCurrency,
    isPaidExport,
    firstPaidAt: (row.firstPaidAt as string | null) ?? null,
    paidUpgradeAt: (row.paidUpgradeAt as string | null) ?? null,
    cancelAt: (row.cancelAt as string | null) ?? null,
    expiresAt: (row.expiresAt as string | null) ?? null,
    startedAt: (row.startedAt as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    region: (row.region as string | null) ?? null,
    freeSource: (row.freeSource as string | null) ?? null,
    paidSource: (row.paidSource as string | null) ?? null,
    opens6mo: Number(row.opens6mo ?? 0) || 0,
    emailsReceived6mo: Number(row.emailsReceived6mo ?? 0) || 0,
    postViews: Number(row.postViews ?? 0) || 0,
    linksClicked: Number(row.linksClicked ?? 0) || 0,
    activity30d: Number(row.activity30d ?? 0) || 0,
    sections: (row.sections as string | null) ?? null,
    stripe: null,
  };
}

/** Persist Substack subscriber export into CRM (idempotent by ld_substack_*). */
export async function importSubstackLeads(): Promise<{
  ok: true;
  imported: number;
  emailable: number;
  paid: number;
  free: number;
  meta: SubstackSeedMeta;
  leads: LeadRecord[];
}> {
  const seed = await readSeed();
  if (!seed) {
    throw new Error("Substack seed missing (data/substack/leads.json).");
  }

  const leads = await upsertLeadsBulk(
    seed.leads.map((row) => ({
      id: row.id,
      email: row.email,
      telegramUsername: row.telegramUsername,
      name: row.name,
      source: "substack",
      channel: row.channel || "substack",
      utmSource: row.utmSource || "substack",
      utmMedium: row.utmMedium || "newsletter",
      utmCampaign: row.utmCampaign || "rokitgs_circle",
      referrer: row.referrer,
      note: row.note,
      status: row.status,
      createdBy: "import:substack",
      createdAt: row.createdAt,
      meta: row.meta ?? null,
    })),
  );

  return {
    ok: true,
    imported: leads.length,
    emailable: seed.meta.emailable,
    paid: seed.meta.paid,
    free: seed.meta.free,
    meta: seed.meta,
    leads,
  };
}

export async function getSubstackSeedSummary() {
  const seed = await readSeed();
  if (!seed) return null;
  return seed.meta;
}

async function stripePaymentsByEmail(): Promise<
  Map<string, SubstackStripePayments>
> {
  const payments = await listAllStripePayments(400);
  const map = new Map<string, SubstackStripePayments>();
  for (const payment of payments) {
    if (payment.status !== "paid" || payment.amountUsd <= 0) continue;
    const email = payment.email?.trim().toLowerCase();
    if (!email) continue;
    const existing = map.get(email) ?? {
      lifetimeUsd: 0,
      invoiceCount: 0,
      lastPaidAt: null,
      firstPaidAt: null,
      sources: [],
      customerId: payment.customerId,
      currency: payment.currency || "usd",
    };
    existing.lifetimeUsd += payment.amountUsd;
    existing.invoiceCount += 1;
    existing.customerId = existing.customerId || payment.customerId;
    if (payment.source && !existing.sources.includes(payment.source)) {
      existing.sources.push(payment.source);
    }
    if (!existing.lastPaidAt || payment.paidAt > existing.lastPaidAt) {
      existing.lastPaidAt = payment.paidAt;
    }
    if (!existing.firstPaidAt || payment.paidAt < existing.firstPaidAt) {
      existing.firstPaidAt = payment.paidAt;
    }
    map.set(email, existing);
  }
  for (const row of map.values()) {
    row.lifetimeUsd = Math.round(row.lifetimeUsd * 100) / 100;
  }
  return map;
}

/**
 * Overlay Substack export identity + Stripe payment SoT onto CRM leads.
 * CSV covers newsletter type/plan; Stripe invoices cover real money paid
 * into this account (Whop / Circle) when the email matches.
 */
export async function getSubstackMetaByLeadId(
  leads: LeadRecord[],
): Promise<Record<string, SubstackLeadMeta>> {
  const seed = await readSeed();
  if (!seed) return {};

  const byId = new Map<string, SubstackLeadMeta>();
  const byEmail = new Map<string, SubstackLeadMeta>();
  for (const row of seed.leads) {
    if (!isSubstackMeta(row.meta)) continue;
    byId.set(row.id, row.meta);
    if (row.email) byEmail.set(row.email.toLowerCase(), row.meta);
  }

  const stripeByEmail = await stripePaymentsByEmail();

  const out: Record<string, SubstackLeadMeta> = {};
  for (const lead of leads) {
    const fromLead = isSubstackMeta(lead.meta)
      ? normalizeSeedMeta(lead.meta)
      : null;
    const fromSeed =
      byId.get(lead.id) ||
      (lead.email ? byEmail.get(lead.email.toLowerCase()) : undefined) ||
      null;
    const base = fromLead ?? fromSeed;
    if (!base) continue;
    const email = lead.email?.trim().toLowerCase();
    const stripe = email ? stripeByEmail.get(email) ?? null : null;
    out[lead.id] = { ...base, stripe };
  }
  return out;
}
