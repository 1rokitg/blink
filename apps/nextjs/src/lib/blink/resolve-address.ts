/**
 * Resolves a slug (ENS name, wallet address, or Blink profile code) to a lowercase
 * EVM wallet address. Used by the public profile page.
 *
 * Resolution order:
 *   1. Raw 0x address  → return as-is (lowercased)
 *   2. *.eth / *.xyz / etc  → ENS resolution via viem + Cloudflare eth RPC
 *   3. Blink profile code  → look up ReferralCode.code in Neon
 *   4. Not found       → null
 */

import { eq } from "drizzle-orm";
import { http, createPublicClient } from "viem";
import { mainnet } from "viem/chains";

import { db, isDatabaseConfigured } from "@acme/db/client";
import { ReferralCode, UserProfile } from "@acme/db/schema";

const ETH_RPC = process.env.ETH_RPC_URL ?? "https://cloudflare-eth.com";

// Lazy singleton — only created when ENS resolution is needed
let _client: ReturnType<typeof createPublicClient> | null = null;
function getEthClient() {
  if (!_client) {
    _client = createPublicClient({
      chain: mainnet,
      transport: http(ETH_RPC),
    });
  }
  return _client;
}

const ENS_TLDS = [".eth", ".xyz", ".art", ".luxe", ".kred", ".club"];

function isWalletAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

function looksLikeEns(s: string): boolean {
  return ENS_TLDS.some((tld) => s.toLowerCase().endsWith(tld));
}

export async function getProfileSlugByWalletAddress(
  walletAddress?: string | null,
): Promise<string | null> {
  if (!walletAddress || !isWalletAddress(walletAddress)) return null;
  if (!isDatabaseConfigured()) return null;

  try {
    const rows = await db
      .select({ code: ReferralCode.code })
      .from(ReferralCode)
      .where(eq(ReferralCode.walletAddress, walletAddress.toLowerCase()))
      .limit(1);

    return rows[0]?.code ?? null;
  } catch {
    return null;
  }
}

/** Resolve an ENS name to an address. Returns null on failure. */
async function resolveEns(name: string): Promise<string | null> {
  try {
    const client = getEthClient();
    const address = await client.getEnsAddress({ name: name.toLowerCase() });
    return address ? address.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Main resolver. Call from Server Components / Route Handlers only.
 * Returns the lowercased wallet address or null if unresolvable.
 */
export async function resolveProfileAddress(
  slug: string,
): Promise<string | null> {
  const s = slug.trim();
  if (!s) return null;

  // 1. Raw wallet address
  if (isWalletAddress(s)) return s.toLowerCase();

  // 2. ENS name
  if (looksLikeEns(s)) {
    const addr = await resolveEns(s);
    if (addr) return addr;
    // Fall through — maybe it's also a Blink username coincidentally
  }

  // 3. Blink profile code lookup
  if (isDatabaseConfigured()) {
    try {
      const rows = await db
        .select({ walletAddress: ReferralCode.walletAddress })
        .from(ReferralCode)
        .where(eq(ReferralCode.code, s.toLowerCase()))
        .limit(1);

      if (rows.length > 0 && rows[0]) return rows[0].walletAddress;
    } catch {
      // DB unavailable — swallow
    }
  }

  return null;
}

/**
 * Upserts a UserProfile row when a user completes builder setup.
 * Safe to call multiple times — uses ON CONFLICT DO NOTHING style via Drizzle.
 */
export async function ensureUserProfile(
  walletAddress: string,
  opts?: { displayName?: string; ensName?: string },
): Promise<void> {
  const addr = walletAddress.toLowerCase();
  try {
    await db
      .insert(UserProfile)
      .values({
        walletAddress: addr,
        displayName: opts?.displayName ?? null,
        ensName: opts?.ensName ?? null,
      })
      .onConflictDoNothing();
  } catch {
    // Non-critical
  }
}
