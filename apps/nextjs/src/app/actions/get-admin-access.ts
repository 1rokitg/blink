"use server";

import {
  getRoleFromIdentities,
  type BlinkRole,
} from "~/lib/blink/admin-roles.server";

export type AdminAccessResult = {
  allowed: boolean;
  role: BlinkRole;
  walletAddress: string;
};

export async function getAdminAccess(
  walletAddresses: string[],
  emailAddresses: string[] = [],
): Promise<AdminAccessResult> {
  const { role, walletAddress } = await getRoleFromIdentities({
    walletAddresses,
    emailAddresses,
  });
  if (role === "admin" || role === "superuser") {
    return { allowed: true, role, walletAddress };
  }

  return {
    allowed: false,
    role: "viewer",
    walletAddress: walletAddresses[0]?.toLowerCase() ?? "",
  };
}
