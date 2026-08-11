import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { upsertLeadsBulk } from "@/lib/leads.server";
import type { LeadRecord, LeadStatus } from "@/lib/leads-types";

export type ProprSeedMeta = {
  importedAt: string;
  partner: string;
  sourceFile: string;
  uniqueUsers: number;
  eventRows: number;
  emailable: number;
};

type ProprSeedLead = {
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
};

async function readSeed(): Promise<{
  meta: ProprSeedMeta;
  leads: ProprSeedLead[];
} | null> {
  try {
    const file = path.join(process.cwd(), "data/propr/leads.json");
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as ProprSeedMeta & {
      leads: ProprSeedLead[];
    };
    return {
      meta: {
        importedAt: parsed.importedAt,
        partner: parsed.partner,
        sourceFile: parsed.sourceFile,
        uniqueUsers: parsed.uniqueUsers,
        eventRows: parsed.eventRows,
        emailable: parsed.emailable,
      },
      leads: parsed.leads ?? [],
    };
  } catch {
    return null;
  }
}

/** Persist bundled Propr partner leads into the CRM (idempotent by ld_propr_* id). */
export async function importProprLeads(): Promise<{
  ok: true;
  imported: number;
  emailable: number;
  meta: ProprSeedMeta;
  leads: LeadRecord[];
}> {
  const seed = await readSeed();
  if (!seed) {
    throw new Error("Propr seed missing (data/propr/leads.json).");
  }

  const leads = await upsertLeadsBulk(
    seed.leads.map((row) => ({
      id: row.id,
      email: row.email,
      telegramUsername: row.telegramUsername,
      name: row.name,
      source: "propr",
      channel: row.channel || "propr",
      utmSource: row.utmSource || "propr",
      utmMedium: row.utmMedium || "referral",
      utmCampaign: row.utmCampaign || "partner_propr",
      referrer: row.referrer,
      note: row.note,
      status: row.status,
      createdBy: "import:propr",
      createdAt: row.createdAt,
    })),
  );

  return {
    ok: true,
    imported: leads.length,
    emailable: seed.meta.emailable,
    meta: seed.meta,
    leads,
  };
}

export async function getProprSeedSummary() {
  const seed = await readSeed();
  if (!seed) return null;
  return {
    ...seed.meta,
    withPurchases: seed.leads.filter((l) => l.status === "qualified").length,
    missingEmail: seed.leads.filter((l) => !l.email).length,
  };
}
