"use server";

import { z } from "zod";

import {
  type BlinkRole,
  assertSuperuserAccess,
} from "~/lib/blink/admin-roles.server";
import {
  grantInternalEmailAccess,
  listInternalEmailGrants,
  resendInternalTeamInvite,
  revokeInternalEmailGrant,
  type InternalEmailGrantRow,
} from "~/lib/blink/internal-email-grants.server";
import { isResendConfigured } from "~/lib/blink/resend.server";

const walletSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const actingSchema = z.object({
  actingWalletAddress: walletSchema,
  emailAddresses: z.array(z.string().email()).optional(),
});

const grantSchema = actingSchema.extend({
  email: z.string().email(),
  role: z.enum(["viewer", "admin"]),
  note: z.string().max(255).optional(),
  sendInvite: z.boolean().optional().default(true),
});

const grantIdSchema = actingSchema.extend({
  grantId: z.string().uuid(),
});

export type InternalTeamPanelState = {
  grants: InternalEmailGrantRow[];
  resendConfigured: boolean;
};

export type GrantTeamMemberResult = {
  ok: true;
  email: string;
  inviteSent: boolean;
};

export async function getInternalTeamPanelState(
  actingWalletAddress: string,
  emailAddresses: string[] = [],
): Promise<InternalTeamPanelState> {
  try {
    const parsed = actingSchema.safeParse({
      actingWalletAddress,
      emailAddresses,
    });
    if (!parsed.success) {
      return { grants: [], resendConfigured: isResendConfigured() };
    }

    await assertSuperuserAccess(parsed.data);
    const grants = await listInternalEmailGrants();
    return {
      grants,
      resendConfigured: isResendConfigured(),
    };
  } catch (error) {
    console.error("[internal-team] panel state failed", error);
    return { grants: [], resendConfigured: isResendConfigured() };
  }
}

export async function grantInternalTeamMemberAction(
  input: z.infer<typeof grantSchema>,
): Promise<GrantTeamMemberResult> {
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const sendInvite = parsed.data.sendInvite !== false;

  try {
    await grantInternalEmailAccess({
      actingWalletAddress: parsed.data.actingWalletAddress,
      emailAddresses: parsed.data.emailAddresses,
      email: parsed.data.email,
      role: parsed.data.role as BlinkRole,
      note: parsed.data.note,
      sendInvite,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to grant team access";
    throw new Error(message);
  }

  return {
    ok: true,
    email: parsed.data.email.toLowerCase(),
    inviteSent: sendInvite,
  };
}

export async function resendInternalTeamInviteAction(
  input: z.infer<typeof grantIdSchema>,
) {
  const parsed = grantIdSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const inviteSentAt = await resendInternalTeamInvite({
    actingWalletAddress: parsed.data.actingWalletAddress,
    emailAddresses: parsed.data.emailAddresses,
    grantId: parsed.data.grantId,
  });

  return { inviteSentAt };
}

export async function revokeInternalTeamMemberAction(
  input: z.infer<typeof grantIdSchema>,
) {
  const parsed = grantIdSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  await revokeInternalEmailGrant({
    actingWalletAddress: parsed.data.actingWalletAddress,
    emailAddresses: parsed.data.emailAddresses,
    grantId: parsed.data.grantId,
  });

  return { ok: true as const };
}
