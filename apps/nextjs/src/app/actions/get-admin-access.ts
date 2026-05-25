"use server";

import { getWalletRoleFromDb, type BlinkRole } from "~/lib/blink/admin-roles.server";

export type AdminAccessResult = {
  allowed: boolean;
  role: BlinkRole;
  walletAddress: string;
};

export async function getAdminAccess(
  walletAddresses: string[],
): Promise<AdminAccessResult> {
  for (const raw of walletAddresses) {
    if (!raw) continue;
    const wallet = raw.toLowerCase();
    const role = await getWalletRoleFromDb(wallet);
    if (role === "admin" || role === "superuser") {
      return { allowed: true, role, walletAddress: wallet };
    }
  }

  return {
    allowed: false,
    role: "viewer",
    walletAddress: walletAddresses[0]?.toLowerCase() ?? "",
  };
}
