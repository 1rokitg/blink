import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { getDbAsync } from "@acme/db/client";
import { InternalEmailGrant } from "@acme/db/schema";

import {
  type BlinkRole,
  assertSuperuserAccess,
  normalizeEmailForGrant,
} from "./admin-roles.server";
import { isResendConfigured, sendInternalTeamInviteEmail } from "./resend.server";

export type InternalEmailGrantRow = {
  id: string;
  email: string;
  role: BlinkRole;
  note: string | null;
  grantedBy: string | null;
  inviteSentAt: string | null;
  createdAt: string;
  updatedAt: string | null;
};

/** Cast timestamps to text in SQL — Hyperdrive never returns Date objects. */
const grantRowSelect = {
  id: InternalEmailGrant.id,
  email: InternalEmailGrant.email,
  role: InternalEmailGrant.role,
  note: InternalEmailGrant.note,
  grantedBy: InternalEmailGrant.grantedBy,
  inviteSentAt: sql<string | null>`${InternalEmailGrant.inviteSentAt}::text`,
  createdAt: sql<string>`${InternalEmailGrant.createdAt}::text`,
  updatedAt: sql<string | null>`${InternalEmailGrant.updatedAt}::text`,
};

type GrantRowQuery = {
  id: string;
  email: string;
  role: string;
  note: string | null;
  grantedBy: string | null;
  inviteSentAt: string | null;
  createdAt: string;
  updatedAt: string | null;
};

function toRow(record: GrantRowQuery): InternalEmailGrantRow {
  return {
    id: String(record.id),
    email: String(record.email),
    role: record.role as BlinkRole,
    note: record.note,
    grantedBy: record.grantedBy,
    inviteSentAt: record.inviteSentAt,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt,
  };
}

export async function listInternalEmailGrants(): Promise<InternalEmailGrantRow[]> {
  try {
    const database = await getDbAsync();
    const rows = await database
      .select(grantRowSelect)
      .from(InternalEmailGrant)
      .orderBy(desc(InternalEmailGrant.createdAt));

    return rows.map(toRow).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.warn("[internal-team] list grants failed", error);
    return [];
  }
}

export async function grantInternalEmailAccess(params: {
  actingWalletAddress: string;
  emailAddresses?: string[];
  email: string;
  role: BlinkRole;
  note?: string;
  sendInvite?: boolean;
}): Promise<void> {
  await assertSuperuserAccess({
    actingWalletAddress: params.actingWalletAddress,
    emailAddresses: params.emailAddresses,
  });

  if (params.role === "superuser") {
    throw new Error("Grant superuser by wallet in the Users panel, not by email.");
  }

  const email = normalizeEmailForGrant(params.email);
  const grantedBy = params.actingWalletAddress.toLowerCase();
  const sendInvite = params.sendInvite !== false;
  const database = await getDbAsync();

  await database
    .insert(InternalEmailGrant)
    .values({
      email,
      role: params.role,
      note: params.note,
      grantedBy,
      inviteSentAt: null,
    })
    .onConflictDoUpdate({
      target: InternalEmailGrant.email,
      set: {
        role: params.role,
        note: params.note,
        grantedBy,
      },
    });

  if (!sendInvite) return;

  if (!isResendConfigured()) {
    throw new Error(
      "Access saved in database, but RESEND_API_KEY is not configured — cannot send invite email.",
    );
  }

  try {
    await sendInternalTeamInviteEmail({
      toEmail: email,
      role: params.role,
      note: params.note,
    });
    await database
      .update(InternalEmailGrant)
      .set({ inviteSentAt: sql`now()` })
      .where(eq(InternalEmailGrant.email, email));
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Resend failed to send invite email";
    throw new Error(
      `Access granted for ${email}, but the invite email could not be sent: ${detail}`,
    );
  }
}

export async function resendInternalTeamInvite(params: {
  actingWalletAddress: string;
  emailAddresses?: string[];
  grantId: string;
}): Promise<string> {
  await assertSuperuserAccess({
    actingWalletAddress: params.actingWalletAddress,
    emailAddresses: params.emailAddresses,
  });

  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const database = await getDbAsync();
  const row = await database
    .select({ email: InternalEmailGrant.email, role: InternalEmailGrant.role, note: InternalEmailGrant.note })
    .from(InternalEmailGrant)
    .where(eq(InternalEmailGrant.id, params.grantId))
    .limit(1);

  const grant = row[0];
  if (!grant) {
    throw new Error("Grant not found.");
  }

  await sendInternalTeamInviteEmail({
    toEmail: grant.email,
    role: grant.role as BlinkRole,
    note: grant.note,
  });

  await database
    .update(InternalEmailGrant)
    .set({ inviteSentAt: sql`now()` })
    .where(eq(InternalEmailGrant.id, params.grantId));

  return new Date().toISOString();
}

export async function revokeInternalEmailGrant(params: {
  actingWalletAddress: string;
  emailAddresses?: string[];
  grantId: string;
}): Promise<void> {
  await assertSuperuserAccess({
    actingWalletAddress: params.actingWalletAddress,
    emailAddresses: params.emailAddresses,
  });

  const database = await getDbAsync();
  await database
    .delete(InternalEmailGrant)
    .where(eq(InternalEmailGrant.id, params.grantId));
}
