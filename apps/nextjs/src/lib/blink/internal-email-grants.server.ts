import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
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

function toRow(record: typeof InternalEmailGrant.$inferSelect): InternalEmailGrantRow {
  return {
    id: record.id,
    email: record.email,
    role: record.role as BlinkRole,
    note: record.note,
    grantedBy: record.grantedBy,
    inviteSentAt: record.inviteSentAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt?.toISOString() ?? null,
  };
}

export async function getEmailRoleFromDb(
  emailAddress: string,
): Promise<BlinkRole | null> {
  const email = normalizeEmailForGrant(emailAddress);
  try {
    const row = await db
      .select({ role: InternalEmailGrant.role })
      .from(InternalEmailGrant)
      .where(eq(InternalEmailGrant.email, email))
      .limit(1);

    const role = row[0]?.role;
    if (role === "viewer" || role === "admin" || role === "superuser") {
      return role;
    }
    return null;
  } catch {
    return null;
  }
}

export async function listInternalEmailGrants(): Promise<InternalEmailGrantRow[]> {
  try {
    const rows = await db
      .select()
      .from(InternalEmailGrant)
      .orderBy(desc(InternalEmailGrant.createdAt));
    return rows.map(toRow);
  } catch {
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
}) {
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

  let inviteSentAt: Date | null = null;
  if (sendInvite) {
    if (!isResendConfigured()) {
      throw new Error("RESEND_API_KEY is not configured — cannot send invite email.");
    }
    await sendInternalTeamInviteEmail({
      toEmail: email,
      role: params.role,
      note: params.note,
    });
    inviteSentAt = new Date();
  }

  await db
    .insert(InternalEmailGrant)
    .values({
      email,
      role: params.role,
      note: params.note,
      grantedBy,
      inviteSentAt,
    })
    .onConflictDoUpdate({
      target: InternalEmailGrant.email,
      set: {
        role: params.role,
        note: params.note,
        grantedBy,
        ...(inviteSentAt ? { inviteSentAt } : {}),
      },
    });

  const row = await db
    .select()
    .from(InternalEmailGrant)
    .where(eq(InternalEmailGrant.email, email))
    .limit(1);

  return row[0] ? toRow(row[0]) : null;
}

export async function resendInternalTeamInvite(params: {
  actingWalletAddress: string;
  emailAddresses?: string[];
  grantId: string;
}) {
  await assertSuperuserAccess({
    actingWalletAddress: params.actingWalletAddress,
    emailAddresses: params.emailAddresses,
  });

  if (!isResendConfigured()) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const row = await db
    .select()
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

  const inviteSentAt = new Date();
  await db
    .update(InternalEmailGrant)
    .set({ inviteSentAt })
    .where(eq(InternalEmailGrant.id, params.grantId));

  return inviteSentAt.toISOString();
}

export async function revokeInternalEmailGrant(params: {
  actingWalletAddress: string;
  emailAddresses?: string[];
  grantId: string;
}) {
  await assertSuperuserAccess({
    actingWalletAddress: params.actingWalletAddress,
    emailAddresses: params.emailAddresses,
  });

  await db.delete(InternalEmailGrant).where(eq(InternalEmailGrant.id, params.grantId));
}
