import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { InternalEmailGrant } from "@acme/db/schema";
import { toIsoTimestamp } from "@acme/db/serialize-timestamp";

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
    inviteSentAt: toIsoTimestamp(record.inviteSentAt),
    createdAt: toIsoTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoTimestamp(record.updatedAt),
  };
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

  await db
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

  let inviteSentAt: Date | null = null;
  if (sendInvite) {
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
      inviteSentAt = new Date();
      await db
        .update(InternalEmailGrant)
        .set({ inviteSentAt })
        .where(eq(InternalEmailGrant.email, email));
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Resend failed to send invite email";
      throw new Error(
        `Access granted for ${email}, but the invite email could not be sent: ${detail}`,
      );
    }
  }

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

  return toIsoTimestamp(inviteSentAt) ?? new Date().toISOString();
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
