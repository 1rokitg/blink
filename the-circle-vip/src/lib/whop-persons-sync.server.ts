import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { upsertLeadsBulk } from "@/lib/leads.server";
import type { LeadStatus } from "@/lib/leads-types";
import {
  putPersonEnrichmentsBulk,
  type PersonEnrichment,
} from "@/lib/people-enrichment.server";
import { personEnrichmentId } from "@/lib/people-types";
import bundledWhopPersons from "@/lib/whop-persons-seed.json";
import { listWhopMembersFromStripe } from "@/lib/whop-stripe.server";
import {
  formatWhopPersonNote,
  identifiedWhopPersons,
  parseWhopPersonRows,
  whopPersonAvatarSeed,
  whopPersonLeadId,
  type WhopPersonRow,
} from "@/lib/whop-persons";

export type WhopPersonsSyncResult = {
  ok: boolean;
  dryRun: boolean;
  sourceFile: string;
  totals: {
    csvRows: number;
    identified: number;
    anonymousSkipped: number;
    matched: number;
    enriched: number;
    createdLeads: number;
    updatedLeads: number;
    skipped: number;
    offset: number;
    limit: number;
    processed: number;
    remaining: number;
  };
  samples: Array<{
    action: "enrich" | "create_lead" | "update_lead" | "skip";
    reason: string;
    userId: string | null;
    email: string | null;
    name: string | null;
    entityId: string | null;
  }>;
};

function personsCsvPath() {
  return path.join(process.cwd(), "data", "whop", "persons-export.csv");
}

type BundledPersons = {
  importedFrom?: string;
  persons?: WhopPersonRow[];
  default?: BundledPersons;
};

async function loadPersons(filePath?: string) {
  const rawBundled = bundledWhopPersons as BundledPersons;
  const bundled = (rawBundled.persons ? rawBundled : rawBundled.default) ?? null;
  const bundledPersons = bundled?.persons;

  if (
    !filePath &&
    Array.isArray(bundledPersons) &&
    bundledPersons.length > 0
  ) {
    return {
      sourceFile: bundled?.importedFrom || "whop-persons-seed.json",
      rows: bundledPersons,
      csvRows: bundledPersons.length,
      anonymousSkipped: 0,
    };
  }

  try {
    const sourceFile = filePath || personsCsvPath();
    const raw = await readFile(sourceFile, "utf8");
    const table = splitCsv(raw);
    if (table.length >= 2) {
      const headers = table[0]!.map((h) => h.replace(/^\uFEFF/, "").trim());
      const dictRows: Record<string, string>[] = [];
      for (const cells of table.slice(1)) {
        if (cells.every((c) => !c.trim())) continue;
        const row: Record<string, string> = {};
        headers.forEach((header, i) => {
          row[header] = cells[i] ?? "";
        });
        dictRows.push(row);
      }
      const parsed = parseWhopPersonRows(dictRows);
      const identified = identifiedWhopPersons(parsed);
      return {
        sourceFile: path.basename(sourceFile),
        rows: identified,
        csvRows: parsed.length,
        anonymousSkipped: parsed.length - identified.length,
      };
    }
  } catch {
    // fall through
  }

  if (Array.isArray(bundledPersons) && bundledPersons.length > 0) {
    return {
      sourceFile: bundled?.importedFrom || "whop-persons-seed.json",
      rows: bundledPersons,
      csvRows: bundledPersons.length,
      anonymousSkipped: 0,
    };
  }

  throw new Error("No Whop persons seed available in bundle or CSV.");
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function leadStatusForPerson(row: WhopPersonRow): LeadStatus {
  if (row.memberStatus === "left") return "lost";
  if (row.memberStatus === "joined" && row.ltv > 0) return "member";
  if (row.memberStatus === "joined") return "qualified";
  if (row.ltv > 0 || row.purchaseCount > 0) return "qualified";
  return "new";
}

type MatchTarget = {
  entityId: string;
  via: string;
};

/**
 * Enrich People from Whop persons seed + create missing lead stubs.
 * Designed for Workers Free subrequest limits: batched, bulk KV writes,
 * match via Stripe Whop customers only (no N+1 reads).
 */
export async function syncWhopPersonsToPeople(input?: {
  dryRun?: boolean;
  filePath?: string;
  updatedBy?: string;
  offset?: number;
  limit?: number;
}): Promise<WhopPersonsSyncResult> {
  const dryRun = Boolean(input?.dryRun);
  const updatedBy = (input?.updatedBy || "whop_persons_sync").slice(0, 64);
  const offset = Math.max(0, input?.offset ?? 0);
  const limit = Math.min(Math.max(input?.limit ?? 40, 1), 80);

  const loaded = await loadPersons(input?.filePath);
  const allIdentified = loaded.rows;
  const batch = allIdentified.slice(offset, offset + limit);

  // Stripe match index only — avoids listing hundreds of KV enrichments/leads.
  const whopMembers = await listWhopMembersFromStripe(300);
  const byWhopUser = new Map(
    whopMembers
      .filter((m) => m.whopUserId)
      .map((m) => [m.whopUserId!.toLowerCase(), m] as const),
  );
  const byWhopMember = new Map(
    whopMembers
      .filter((m) => m.whopMemberId)
      .map((m) => [m.whopMemberId!.toLowerCase(), m] as const),
  );
  const byEmail = new Map(
    whopMembers
      .filter((m) => m.email)
      .map((m) => [m.email!.toLowerCase(), m] as const),
  );

  const totals = {
    csvRows: loaded.csvRows,
    identified: allIdentified.length,
    anonymousSkipped: loaded.anonymousSkipped,
    matched: 0,
    enriched: 0,
    createdLeads: 0,
    updatedLeads: 0,
    skipped: 0,
    offset,
    limit,
    processed: batch.length,
    remaining: Math.max(0, allIdentified.length - (offset + batch.length)),
  };
  const samples: WhopPersonsSyncResult["samples"] = [];

  function pushSample(sample: WhopPersonsSyncResult["samples"][number]) {
    if (samples.length < 40) samples.push(sample);
  }

  function resolveMatch(row: WhopPersonRow): MatchTarget | null {
    if (row.userId) {
      const hit = byWhopUser.get(row.userId.toLowerCase());
      if (hit) return { entityId: hit.customerId, via: "whop_user_id" };
    }
    if (row.memberId) {
      const hit = byWhopMember.get(row.memberId.toLowerCase());
      if (hit) return { entityId: hit.customerId, via: "whop_member_id" };
    }
    const email = normalizeEmail(row.email);
    if (email) {
      const hit = byEmail.get(email);
      if (hit) return { entityId: hit.customerId, via: "email" };
    }
    return null;
  }

  const enrichmentsToWrite: PersonEnrichment[] = [];
  const leadsToWrite: Array<{
    id: string;
    email?: string | null;
    name?: string | null;
    source?: string | null;
    note?: string | null;
    status?: LeadStatus;
    createdBy: string;
    createdAt?: string;
  }> = [];

  const now = new Date().toISOString();

  for (const row of batch) {
    const note = formatWhopPersonNote(row);
    const avatarSeed = whopPersonAvatarSeed(row);
    const match = resolveMatch(row);

    if (match) {
      totals.matched += 1;
      const entityId = match.entityId;
      const record: PersonEnrichment = {
        id: personEnrichmentId("member", entityId),
        kind: "member",
        memberId: entityId,
        visitorId: null,
        name: row.name,
        email: row.email,
        phone: row.phone,
        telegramUsername: null,
        discordUsername: null,
        xUsername: null,
        instagramUsername: null,
        pfpUrl: avatarSeed,
        photoUrls: [],
        paymentMethods: null,
        wallets: [],
        note,
        linkedMemberId: null,
        linkedVisitorId: null,
        createdAt: row.firstSeenAt || now,
        updatedAt: now,
        updatedBy,
      };
      enrichmentsToWrite.push(record);
      totals.enriched += 1;
      pushSample({
        action: "enrich",
        reason: `matched via ${match.via}`,
        userId: row.userId,
        email: row.email,
        name: row.name,
        entityId,
      });
      continue;
    }

    if (!row.userId) {
      totals.skipped += 1;
      continue;
    }

    const leadId = whopPersonLeadId(row.userId);
    const status = leadStatusForPerson(row);
    leadsToWrite.push({
      id: leadId,
      email: row.email,
      name: row.name,
      source: "whop_person",
      note,
      status,
      createdBy: updatedBy,
      createdAt: row.firstSeenAt ?? undefined,
    });
    enrichmentsToWrite.push({
      id: personEnrichmentId("member", leadId),
      kind: "member",
      memberId: leadId,
      visitorId: null,
      name: row.name,
      email: row.email,
      phone: row.phone,
      telegramUsername: null,
      discordUsername: null,
      xUsername: null,
      instagramUsername: null,
      pfpUrl: avatarSeed,
      photoUrls: [],
      paymentMethods: null,
      wallets: [],
      note,
      linkedMemberId: null,
      linkedVisitorId: null,
      createdAt: row.firstSeenAt || now,
      updatedAt: now,
      updatedBy,
    });
    totals.createdLeads += 1;
    pushSample({
      action: "create_lead",
      reason: "unmatched Whop user → lead stub",
      userId: row.userId,
      email: row.email,
      name: row.name,
      entityId: leadId,
    });
  }

  if (!dryRun) {
    if (leadsToWrite.length > 0) {
      await upsertLeadsBulk(leadsToWrite);
    }
    if (enrichmentsToWrite.length > 0) {
      await putPersonEnrichmentsBulk(enrichmentsToWrite);
    }
  }

  return {
    ok: true,
    dryRun,
    sourceFile: loaded.sourceFile,
    totals,
    samples,
  };
}
