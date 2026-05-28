import {
  fetchExtraAgents,
  type HyperliquidExtraAgent,
} from "~/lib/blink/hyperliquid";

/** On-chain label from approveAgent — matches Hyperliquid explorer / extraAgents.name */
export const BLINK_WEB_AGENT_NAME = "blink-web";

export type { HyperliquidExtraAgent };

export function isBlinkWebAgent(agent: HyperliquidExtraAgent) {
  return agent.name === BLINK_WEB_AGENT_NAME;
}

export async function getBlinkWebAgent(
  userAddress: `0x${string}`,
): Promise<HyperliquidExtraAgent | null> {
  const agents = await fetchExtraAgents(userAddress);
  const now = Date.now();
  const match = agents.find(
    (agent) =>
      isBlinkWebAgent(agent) &&
      Number.isFinite(agent.validUntil) &&
      agent.validUntil > now,
  );
  return match ?? null;
}

export async function hasBlinkWebAgent(userAddress: `0x${string}`) {
  return (await getBlinkWebAgent(userAddress)) !== null;
}
