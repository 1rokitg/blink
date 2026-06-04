import "server-only";

import { and, eq } from "drizzle-orm";

import { db, getDbAsync } from "@acme/db/client";
import { InternalEmailGrant, InternalRole } from "@acme/db/schema";

export type BlinkRole = "viewer" | "admin" | "superuser";

const FOUNDER_BOOTSTRAP: Record<string, BlinkRole> = {
  "0xc7bcb2eee9bbfbf875499960746bc52b2e1a75c6": "superuser",
};

const FOUNDER_EMAIL_BOOTSTRAP: Record<string, BlinkRole> = {
  "pintosdsgn@gmail.com": "superuser",
};

/** Read-only internal access via Privy email (no wallet grant required). */
const INTERNAL_EMAIL_BOOTSTRAP: Record<string, BlinkRole> = {
  "breixobingx@gmail.com": "viewer",
};

function normalize(address: string) {
  return address.trim().toLowerCase();
}

function getBootstrapRole(walletAddress: string): BlinkRole {
  return FOUNDER_BOOTSTRAP[normalize(walletAddress)] ?? "viewer";
}

export function normalizeEmailForGrant(emailAddress: string) {
  return emailAddress.trim().toLowerCase();
}

function getBootstrapEmailRole(emailAddress: string): BlinkRole | null {
  const email = normalizeEmailForGrant(emailAddress);
  if (FOUNDER_EMAIL_BOOTSTRAP[email]) return FOUNDER_EMAIL_BOOTSTRAP[email];
  if (INTERNAL_EMAIL_BOOTSTRAP[email]) return INTERNAL_EMAIL_BOOTSTRAP[email];
  return null;
}

async function getEmailRoleFromDb(emailAddress: string): Promise<BlinkRole | null> {
  const email = normalizeEmailForGrant(emailAddress);
  try {
    const database = await getDbAsync();
    const row = await database
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

async function getGrantedEmailRole(emailAddress: string): Promise<BlinkRole | null> {
  const bootstrap = getBootstrapEmailRole(emailAddress);
  if (bootstrap === "superuser" || bootstrap === "admin") {
    return bootstrap;
  }

  const dbRole = await getEmailRoleFromDb(emailAddress);
  if (dbRole) return dbRole;

  return bootstrap;
}

export function canAccessInternalTools(role: BlinkRole) {
  return role === "viewer" || role === "admin" || role === "superuser";
}

export function canWriteInternalTools(role: BlinkRole) {
  return role === "admin" || role === "superuser";
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

export async function getRoleFromIdentities(params: {
  walletAddresses?: string[];
  emailAddresses?: string[];
}): Promise<{ role: BlinkRole; walletAddress: string }> {
  const wallets = (params.walletAddresses ?? []).filter(Boolean);
  for (const wallet of wallets) {
    const role = await getWalletRoleFromDb(wallet);
    if (role === "admin" || role === "superuser") {
      return { role, walletAddress: normalize(wallet) };
    }
  }

  const emails = (params.emailAddresses ?? []).filter(Boolean);
  for (const email of emails) {
    const role = await getGrantedEmailRole(email);
    if (role && canAccessInternalTools(role)) {
      return { role, walletAddress: normalize(wallets[0] ?? "") };
    }
  }

  return { role: "viewer", walletAddress: normalize(wallets[0] ?? "") };
}

export async function assertSuperuserAccess(params: {
  actingWalletAddress: string;
  emailAddresses?: string[];
}): Promise<BlinkRole> {
  const { role } = await resolveInternalRole({
    walletAddresses: [params.actingWalletAddress],
    emailAddresses: params.emailAddresses ?? [],
  });
  if (role !== "superuser") {
    throw new Error("Superuser access required");
  }
  return role;
}

export async function resolveInternalRole(params: {
  walletAddresses?: string[];
  emailAddresses?: string[];
}) {
  return getRoleFromIdentities(params);
}

export async function assertInternalReadAccess(params: {
  actingWalletAddress: string;
  emailAddresses?: string[];
}): Promise<BlinkRole> {
  const { role } = await resolveInternalRole({
    walletAddresses: [params.actingWalletAddress],
    emailAddresses: params.emailAddresses ?? [],
  });
  if (!canAccessInternalTools(role)) {
    throw new Error("Unauthorized");
  }
  return role;
}

export async function assertInternalWriteAccess(params: {
  actingWalletAddress: string;
  emailAddresses?: string[];
}): Promise<BlinkRole> {
  const { role } = await resolveInternalRole({
    walletAddresses: [params.actingWalletAddress],
    emailAddresses: params.emailAddresses ?? [],
  });
  if (!canWriteInternalTools(role)) {
    throw new Error("Unauthorized");
  }
  return role;
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
