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

export async function getInternalTeamPanelState(
  actingWalletAddress: string,
  emailAddresses: string[] = [],
): Promise<InternalTeamPanelState> {
  const parsed = actingSchema.safeParse({
    actingWalletAddress,
    emailAddresses,
  });
  if (!parsed.success) {
    throw new Error("Invalid request");
  }

  await assertSuperuserAccess(parsed.data);

  const grants = await listInternalEmailGrants();
  return {
    grants,
    resendConfigured: isResendConfigured(),
  };
}

export async function grantInternalTeamMemberAction(
  input: z.infer<typeof grantSchema>,
) {
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  try {
    return await grantInternalEmailAccess({
      actingWalletAddress: parsed.data.actingWalletAddress,
      emailAddresses: parsed.data.emailAddresses,
      email: parsed.data.email,
      role: parsed.data.role as BlinkRole,
      note: parsed.data.note,
      sendInvite: parsed.data.sendInvite,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to grant team access";
    throw new Error(message);
  }
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
}
