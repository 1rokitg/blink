"use server";

import { z } from "zod";

import { getWalletRoleFromDb } from "~/lib/blink/admin-roles.server";
import {
  type InternalMembershipRevenueForecast,
  type InternalMembershipRow,
  type InternalMembershipSummary,
  listInternalMembershipRows,
} from "~/lib/blink/internal-memberships.server";

const inputSchema = z.object({
  actingWalletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export type InternalMembershipsPayload = {
  rows: InternalMembershipRow[];
  summary: InternalMembershipSummary;
  forecast: InternalMembershipRevenueForecast;
  syncedAt: string;
};

export async function getInternalMemberships(
  input: unknown,
): Promise<InternalMembershipsPayload> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid memberships query.");
  }

  const actingWalletAddress = parsed.data.actingWalletAddress.toLowerCase();
  const role = await getWalletRoleFromDb(actingWalletAddress);
  if (role !== "admin" && role !== "superuser") {
    throw new Error("Unauthorized");
  }

  const { rows, summary, forecast } = await listInternalMembershipRows();

  return {
    rows,
    summary,
    forecast,
    syncedAt: new Date().toISOString(),
  };
}
