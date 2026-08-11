import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  emptyCrossIndex,
  normalizeLeadEmail,
  normalizeLeadHandle,
  tagsForLead,
  type CrossIndex,
  type LeadTag,
} from "@/lib/lead-cross-tags";
import type { StripeMemberRow } from "@/lib/internal-stats-types";
import type { LeadRecord } from "@/lib/leads-types";
import type { WhopPersonRow } from "@/lib/whop-persons";
import bundledWhopPersons from "@/lib/whop-persons-seed.json";

type SeedLead = {
  email?: string | null;
  telegramUsername?: string | null;
  name?: string | null;
};

async function readJsonSeed<T>(relativePath: string): Promise<T | null> {
  try {
    const file = path.join(process.cwd(), relativePath);
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function addEmail(set: Set<string>, value: string | null | undefined) {
  const email = normalizeLeadEmail(value);
  if (email) set.add(email);
}

function addHandle(set: Set<string>, value: string | null | undefined) {
  const handle = normalizeLeadHandle(value);
  if (handle) set.add(handle);
}

/**
 * Build lookup indexes across Whop / Substack / Propr / Circle / waitlist /
 * Shopify so leads can be cross-tagged on the CRM board.
 */
export async function buildLeadCrossIndex(input: {
  leads: LeadRecord[];
  whopMembers: Array<{
    email?: string | null;
    telegramUsername?: string | null;
    name?: string | null;
  }>;
  circleMembers: StripeMemberRow[];
  shopifyEmails?: Array<string | null | undefined>;
}): Promise<CrossIndex> {
  const index = emptyCrossIndex();

  for (const member of input.whopMembers) {
    addEmail(index.whopEmails, member.email);
    addHandle(index.whopHandles, member.telegramUsername);
    addHandle(index.whopHandles, member.name);
  }

  const bundled = bundledWhopPersons as {
    persons?: WhopPersonRow[];
  };
  for (const person of bundled.persons ?? []) {
    addEmail(index.whopEmails, person.email);
    addHandle(index.whopHandles, person.username);
    addHandle(index.whopHandles, person.name);
  }

  const substack = await readJsonSeed<{ leads?: SeedLead[] }>(
    "data/substack/leads.json",
  );
  for (const row of substack?.leads ?? []) {
    addEmail(index.substackEmails, row.email);
  }

  const propr = await readJsonSeed<{ leads?: SeedLead[] }>(
    "data/propr/leads.json",
  );
  for (const row of propr?.leads ?? []) {
    addHandle(index.proprHandles, row.telegramUsername);
    addHandle(index.proprHandles, row.name);
  }

  for (const member of input.circleMembers) {
    // Paying / active Circle members — exclude unpaid Whop-only migrants.
    const isPaying =
      Boolean(member.lastPaidAt) ||
      (member.mrr ?? 0) > 0 ||
      member.status === "active";
    if (!isPaying) continue;
    if (member.source === "whop_member" && !member.lastPaidAt) continue;
    addEmail(index.circleEmails, member.email);
    addHandle(index.circleHandles, member.telegramUsername);
  }

  for (const lead of input.leads) {
    if ((lead.source || "").toLowerCase() === "waitlist") {
      addEmail(index.waitlistEmails, lead.email);
    }
  }

  for (const email of input.shopifyEmails ?? []) {
    addEmail(index.shopifyEmails, email);
  }

  return index;
}

export async function tagLeads(
  leads: LeadRecord[],
  input: {
    whopMembers: Array<{
      email?: string | null;
      telegramUsername?: string | null;
      name?: string | null;
    }>;
    circleMembers: StripeMemberRow[];
    shopifyEmails?: Array<string | null | undefined>;
  },
): Promise<Record<string, LeadTag[]>> {
  const index = await buildLeadCrossIndex({
    leads,
    whopMembers: input.whopMembers,
    circleMembers: input.circleMembers,
    shopifyEmails: input.shopifyEmails,
  });

  const out: Record<string, LeadTag[]> = {};
  for (const lead of leads) {
    out[lead.id] = tagsForLead(lead, index);
  }
  return out;
}
