"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { InternalRole } from "@acme/db/schema";

export type BlinkRole = "viewer" | "admin" | "superuser";

const FOUNDER_BOOTSTRAP: Record<string, BlinkRole> = {
  "0xc7bcb2eee9bbfbf875499960746bc52b2e1a75c6": "superuser",
};

function normalize(address: string) {
  return address.trim().toLowerCase();
}

function getBootstrapRole(walletAddress: string): BlinkRole {
  return FOUNDER_BOOTSTRAP[normalize(walletAddress)] ?? "viewer";
}

function toLevel(role: BlinkRole) {
  if (role === "superuser") return 2;
  if (role === "admin") return 1;
  return 0;
}

export async function ensureBootstrapRole(walletAddress: string) {
  const wallet = normalize(walletAddress);
  const bootstrapRole = getBootstrapRole(wallet);
  if (bootstrapRole === "viewer") return;

  try {
    const existing = await db
      .select({ role: InternalRole.role })
      .from(InternalRole)
      .where(eq(InternalRole.walletAddress, wallet))
      .limit(1);

    const currentRole =
      (existing[0]?.role as BlinkRole | undefined) ?? "viewer";
    if (toLevel(currentRole) >= toLevel(bootstrapRole)) return;

    await db
      .insert(InternalRole)
      .values({
        walletAddress: wallet,
        role: bootstrapRole,
        note: "auto-bootstrapped founder/admin role",
        grantedBy: wallet,
      })
      .onConflictDoUpdate({
        target: InternalRole.walletAddress,
        set: {
          role: bootstrapRole,
          note: "auto-bootstrapped founder/admin role",
          grantedBy: wallet,
        },
      });
  } catch (error) {
    console.warn(
      "[admin-rbac] Bootstrap role fallback active (internal_role table unavailable yet).",
      error,
    );
  }
}

export async function getWalletRoleFromDb(
  walletAddress?: string | null,
): Promise<BlinkRole> {
  if (!walletAddress) return "viewer";
  const wallet = normalize(walletAddress);
  const bootstrapRole = getBootstrapRole(wallet);
  try {
    await ensureBootstrapRole(wallet);

    const row = await db
      .select({ role: InternalRole.role })
      .from(InternalRole)
      .where(eq(InternalRole.walletAddress, wallet))
      .limit(1);

    const role = row[0]?.role;
    if (role === "superuser" || role === "admin") return role;
    return bootstrapRole;
  } catch (error) {
    console.warn(
      "[admin-rbac] DB role lookup failed, using bootstrap fallback role.",
      error,
    );
    return bootstrapRole;
  }
}

export async function isAdminWalletDb(walletAddress?: string | null) {
  const role = await getWalletRoleFromDb(walletAddress);
  return role === "admin" || role === "superuser";
}

export async function grantInternalRole(params: {
  walletAddress: string;
  role: BlinkRole;
  note?: string;
  grantedBy: string;
}) {
  const walletAddress = normalize(params.walletAddress);
  const grantedBy = normalize(params.grantedBy);
  const canGrant = await getWalletRoleFromDb(grantedBy);
  if (canGrant !== "superuser") {
    throw new Error("Only superuser can grant roles");
  }

  if (params.role === "superuser" && canGrant !== "superuser") {
    throw new Error("Only superuser can grant superuser role");
  }

  await db
    .insert(InternalRole)
    .values({
      walletAddress,
      role: params.role,
      note: params.note,
      grantedBy,
    })
    .onConflictDoUpdate({
      target: InternalRole.walletAddress,
      set: {
        role: params.role,
        note: params.note,
        grantedBy,
      },
      setWhere: and(eq(InternalRole.walletAddress, walletAddress)),
    });
}
