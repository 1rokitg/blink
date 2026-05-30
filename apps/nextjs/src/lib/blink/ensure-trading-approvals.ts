import type * as hl from "@nktkas/hyperliquid";

import {
  BLINK_WEB_AGENT_NAME,
  isLocalBlinkWebAgentApproved,
} from "./blink-agent";
import {
  BUILDER_ADDRESS,
  BUILDER_FEE_UNITS,
  builderMaxFeeRate,
  isBuilderApproved,
} from "./builder";

export function ensureExchangeActionOk(
  result: unknown,
  fallbackMessage: string,
): void {
  const maybe = result as
    | { status?: string; response?: unknown }
    | undefined
    | null;
  if (!maybe || maybe.status !== "ok") {
    throw new Error(fallbackMessage);
  }
  const response = maybe.response as
    | { type?: string; data?: { statuses?: Array<{ error?: string }> } }
    | string
    | undefined;
  if (typeof response === "string") {
    throw new Error(response || fallbackMessage);
  }
  const statuses = response?.data?.statuses;
  const firstErr = statuses?.find((s) => typeof s.error === "string")?.error;
  if (firstErr) {
    throw new Error(firstErr);
  }
}

/** Skip wallet signature when Hyperliquid already has sufficient builder fee approval. */
export async function ensureBuilderFeeApproved(
  exchClient: hl.ExchangeClient,
  userAddress: `0x${string}`,
  requiredFeeUnits: number = BUILDER_FEE_UNITS,
): Promise<{ skipped: boolean }> {
  if (await isBuilderApproved(userAddress, requiredFeeUnits)) {
    return { skipped: true };
  }

  const result = await exchClient.approveBuilderFee({
    builder: BUILDER_ADDRESS,
    maxFeeRate: builderMaxFeeRate(),
  });
  ensureExchangeActionOk(
    result,
    "Builder fee approval was not accepted by Hyperliquid",
  );
  return { skipped: false };
}

/** Skip wallet signature when this wallet's local blink-web agent is already approved. */
export async function ensureBlinkWebAgentApproved(
  exchClient: hl.ExchangeClient,
  userAddress: `0x${string}`,
  agentAddress: `0x${string}`,
): Promise<{ skipped: boolean }> {
  if (await isLocalBlinkWebAgentApproved(userAddress, agentAddress)) {
    return { skipped: true };
  }

  const result = await exchClient.approveAgent({
    agentAddress,
    agentName: BLINK_WEB_AGENT_NAME,
  });
  ensureExchangeActionOk(
    result,
    "Agent approval was not accepted by Hyperliquid",
  );
  return { skipped: false };
}

export async function isLocalBlinkTradingEnabled(
  userAddress: `0x${string}`,
  agentAddress: `0x${string}`,
  requiredFeeUnits: number = BUILDER_FEE_UNITS,
): Promise<boolean> {
  const [feeApproved, agentApproved] = await Promise.all([
    isBuilderApproved(userAddress, requiredFeeUnits),
    isLocalBlinkWebAgentApproved(userAddress, agentAddress),
  ]);
  return feeApproved && agentApproved;
}
