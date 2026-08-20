export type CryptoChainId = "ethereum" | "base" | "arbitrum" | "solana";

export type CryptoChain = {
  id: CryptoChainId;
  label: string;
  kind: "evm" | "solana";
  /** Native chain id for wallet_switchEthereumChain */
  evmChainId?: number;
  usdcAddress: string;
  usdcDecimals: number;
  recipient: string;
  explorerTx: (hash: string) => string;
  rpcUrl: string;
};

export const EVM_RECIPIENT =
  "0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6" as const;

export const SOLANA_RECIPIENT =
  "FZsywzt85ZUo9vhQWKqC79BhFzg1cNCHsc84BMEdKaxw" as const;

/** Official Circle USDC only. */
export const CRYPTO_CHAINS: Record<CryptoChainId, CryptoChain> = {
  ethereum: {
    id: "ethereum",
    label: "Ethereum",
    kind: "evm",
    evmChainId: 1,
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcDecimals: 6,
    recipient: EVM_RECIPIENT,
    explorerTx: (hash) => `https://etherscan.io/tx/${hash}`,
    rpcUrl: process.env.ETHEREUM_RPC_URL?.trim() || "https://cloudflare-eth.com",
  },
  base: {
    id: "base",
    label: "Base",
    kind: "evm",
    evmChainId: 8453,
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
    recipient: EVM_RECIPIENT,
    explorerTx: (hash) => `https://basescan.org/tx/${hash}`,
    rpcUrl: process.env.BASE_RPC_URL?.trim() || "https://mainnet.base.org",
  },
  arbitrum: {
    id: "arbitrum",
    label: "Arbitrum",
    kind: "evm",
    evmChainId: 42161,
    usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcDecimals: 6,
    recipient: EVM_RECIPIENT,
    explorerTx: (hash) => `https://arbiscan.io/tx/${hash}`,
    rpcUrl:
      process.env.ARBITRUM_RPC_URL?.trim() || "https://arb1.arbitrum.io/rpc",
  },
  solana: {
    id: "solana",
    label: "Solana",
    kind: "solana",
    usdcAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    usdcDecimals: 6,
    recipient: SOLANA_RECIPIENT,
    explorerTx: (hash) => `https://solscan.io/tx/${hash}`,
    rpcUrl:
      process.env.SOLANA_RPC_URL?.trim() ||
      "https://api.mainnet-beta.solana.com",
  },
};

export const CRYPTO_CHAIN_ORDER: CryptoChainId[] = [
  "base",
  "arbitrum",
  "ethereum",
  "solana",
];

export function getCryptoChain(id: string): CryptoChain | null {
  if (id in CRYPTO_CHAINS) {
    return CRYPTO_CHAINS[id as CryptoChainId];
  }
  return null;
}

export function usdcToAtomic(amountUsdc: number, decimals = 6): bigint {
  return BigInt(Math.round(amountUsdc * 10 ** decimals));
}

export function shortenAddress(address: string, left = 6, right = 4) {
  if (address.length <= left + right + 3) {
    return address;
  }
  return `${address.slice(0, left)}…${address.slice(-right)}`;
}

/** ERC-20 transfer(address,uint256) selector */
export const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

export function encodeErc20Transfer(to: string, amount: bigint): `0x${string}` {
  const toClean = to.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const amountHex = amount.toString(16).padStart(64, "0");
  return `${ERC20_TRANSFER_SELECTOR}${toClean}${amountHex}`;
}
