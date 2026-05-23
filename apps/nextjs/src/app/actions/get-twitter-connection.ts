"use server";

import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { TwitterConnection } from "@acme/db/schema";

export interface TwitterConnectionData {
  twitterId: string;
  twitterUsername: string;
  twitterName: string | null;
  connectedAt: Date;
}

/**
 * Returns the Twitter connection for a wallet, or null if not connected.
 * Safe to call from client components via server action.
 */
export async function getTwitterConnection(
  walletAddress: string,
): Promise<TwitterConnectionData | null> {
  if (!walletAddress) return null;

  const rows = await db
    .select()
    .from(TwitterConnection)
    .where(eq(TwitterConnection.walletAddress, walletAddress.toLowerCase()))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    twitterId: row.twitterId,
    twitterUsername: row.twitterUsername,
    twitterName: row.twitterName,
    connectedAt: row.connectedAt,
  };
}
