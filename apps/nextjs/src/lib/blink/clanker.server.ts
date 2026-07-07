import { http, formatEther, getAddress, parseAbi } from "viem";
import { createPublicClient } from "viem";
import { base } from "viem/chains";

import {
  BASE_WETH_ADDRESS,
  BLINK_TOKEN_ADDRESS,
  BLINK_TOKEN_CLANKER_URL,
  BLINK_TOKEN_CREATOR_ADDRESS,
  BLINK_TOKEN_GOAL_ETH,
  CLANKER_FEE_LOCKER_ADDRESS,
} from "./token";

const clankerFeeLockerAbi = parseAbi([
  "function availableFees(address feeOwner, address token) view returns (uint256)",
  "event ClaimTokens(address indexed feeOwner, address indexed token, uint256 amountClaimed)",
  "event ClaimTokensPermissioned(address indexed feeOwner, address indexed token, address recipient, uint256 amountClaimed)",
]);

function resolveBaseRpcUrl() {
  const configured = process.env.BASE_RPC_URL?.trim();
  if (configured) return configured;
  return base.rpcUrls.default.http[0] ?? "https://mainnet.base.org";
}

const baseClient = createPublicClient({
  chain: base,
  transport: http(resolveBaseRpcUrl()),
});

export type BlinkTokenProgressSnapshot = {
  claimableEth: number;
  claimableWei: string;
  clankerUrl: string;
  creatorAddress: string;
  feeLockerAddress: string;
  goalEth: number;
  isLive: boolean;
  lastUpdated: string;
  progressPct: number;
  remainingEth: number;
  rewardedEth: number;
  rewardedWei: string;
  tokenAddress: string;
  wethAddress: string;
};

function roundMetric(value: number, decimals = 4) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}

async function readClaimedRewardsWei() {
  const [claims, permissionedClaims] = await Promise.all([
    baseClient.getLogs({
      address: CLANKER_FEE_LOCKER_ADDRESS,
      event: clankerFeeLockerAbi[1],
      args: {
        feeOwner: BLINK_TOKEN_CREATOR_ADDRESS,
        token: BASE_WETH_ADDRESS,
      },
      fromBlock: 0n,
    }),
    baseClient.getLogs({
      address: CLANKER_FEE_LOCKER_ADDRESS,
      event: clankerFeeLockerAbi[2],
      args: {
        feeOwner: BLINK_TOKEN_CREATOR_ADDRESS,
        token: BASE_WETH_ADDRESS,
      },
      fromBlock: 0n,
    }),
  ]);

  return [...claims, ...permissionedClaims].reduce((sum, log) => {
    return sum + (log.args.amountClaimed ?? 0n);
  }, 0n);
}

function buildFallbackSnapshot(): BlinkTokenProgressSnapshot {
  return {
    claimableEth: 0,
    claimableWei: "0",
    clankerUrl: BLINK_TOKEN_CLANKER_URL,
    creatorAddress: getAddress(BLINK_TOKEN_CREATOR_ADDRESS),
    feeLockerAddress: getAddress(CLANKER_FEE_LOCKER_ADDRESS),
    goalEth: BLINK_TOKEN_GOAL_ETH,
    isLive: false,
    lastUpdated: new Date().toISOString(),
    progressPct: 0,
    remainingEth: BLINK_TOKEN_GOAL_ETH,
    rewardedEth: 0,
    rewardedWei: "0",
    tokenAddress: getAddress(BLINK_TOKEN_ADDRESS),
    wethAddress: getAddress(BASE_WETH_ADDRESS),
  };
}

export async function getBlinkTokenProgress(): Promise<BlinkTokenProgressSnapshot> {
  try {
    const claimableResult = await baseClient.readContract({
      address: CLANKER_FEE_LOCKER_ADDRESS,
      abi: clankerFeeLockerAbi,
      functionName: "availableFees",
      args: [BLINK_TOKEN_CREATOR_ADDRESS, BASE_WETH_ADDRESS],
    });

    const claimableWei = claimableResult as bigint;

    const claimedWei = await readClaimedRewardsWei().catch(() => 0n);
    const rewardedWei = claimedWei + claimableWei;

    const claimableEth = Number(formatEther(claimableWei));
    const rewardedEth = Number(formatEther(rewardedWei));
    const remainingEth = Math.max(BLINK_TOKEN_GOAL_ETH - rewardedEth, 0);
    const progressPct = Math.min(
      (rewardedEth / BLINK_TOKEN_GOAL_ETH) * 100,
      100,
    );

    return {
      claimableEth: roundMetric(claimableEth),
      claimableWei: claimableWei.toString(),
      clankerUrl: BLINK_TOKEN_CLANKER_URL,
      creatorAddress: getAddress(BLINK_TOKEN_CREATOR_ADDRESS),
      feeLockerAddress: getAddress(CLANKER_FEE_LOCKER_ADDRESS),
      goalEth: BLINK_TOKEN_GOAL_ETH,
      isLive: true,
      lastUpdated: new Date().toISOString(),
      progressPct: roundMetric(progressPct, 2),
      remainingEth: roundMetric(remainingEth),
      rewardedEth: roundMetric(rewardedEth),
      rewardedWei: rewardedWei.toString(),
      tokenAddress: getAddress(BLINK_TOKEN_ADDRESS),
      wethAddress: getAddress(BASE_WETH_ADDRESS),
    };
  } catch (error) {
    console.warn("[token-progress] Base RPC read failed", error);
    return buildFallbackSnapshot();
  }
}
