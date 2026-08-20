"use client";

import {
  CRYPTO_CHAINS,
  encodeErc20Transfer,
  type CryptoChainId,
  usdcToAtomic,
} from "@/lib/crypto-payments";
import { discoverWalletProviders } from "@/lib/client-fingerprint";

type EthereumProvider = {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
  isMetaMask?: boolean;
  isRabby?: boolean;
  providers?: EthereumProvider[];
};

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") {
    return null;
  }
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

async function ensureChain(
  ethereum: EthereumProvider,
  evmChainId: number,
) {
  const current = (await ethereum.request({
    method: "eth_chainId",
  })) as string;

  if (current.toLowerCase() === toHexChainId(evmChainId).toLowerCase()) {
    return;
  }

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: toHexChainId(evmChainId) }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 4902) {
      throw new Error("Add this network to your wallet, then try again.");
    }
    throw error;
  }
}

export async function connectBrowserWallet() {
  const discovery = await discoverWalletProviders();
  const ethereum = (discovery.provider as EthereumProvider | null) ?? getEthereum();
  if (!ethereum?.request) {
    throw new Error("No EVM wallet found. Install MetaMask, Rabby, or another wallet.");
  }

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts[0];
  if (!address) {
    throw new Error("Wallet connected but no account selected.");
  }

  return {
    address,
    walletBrand: discovery.selectedBrand,
    providers: discovery.brands,
    ethereum,
  };
}

export async function sendUsdcWithBrowserWallet(options: {
  chainId: CryptoChainId;
  amountUsdc: number;
  onConnected?: (info: {
    address: string;
    walletBrand: string;
    providers: string[];
  }) => void;
  onSignPrompt?: (info: {
    address: string;
    walletBrand: string;
  }) => void;
}) {
  const chain = CRYPTO_CHAINS[options.chainId];
  if (chain.kind !== "evm" || !chain.evmChainId) {
    throw new Error("Wallet send is only supported on EVM chains.");
  }

  const connected = await connectBrowserWallet();
  options.onConnected?.({
    address: connected.address,
    walletBrand: connected.walletBrand,
    providers: connected.providers,
  });

  await ensureChain(connected.ethereum, chain.evmChainId);

  const amount = usdcToAtomic(options.amountUsdc, chain.usdcDecimals);
  const data = encodeErc20Transfer(chain.recipient, amount);

  options.onSignPrompt?.({
    address: connected.address,
    walletBrand: connected.walletBrand,
  });

  const txHash = (await connected.ethereum.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: connected.address,
        to: chain.usdcAddress,
        data,
        value: "0x0",
      },
    ],
  })) as string;

  return {
    txHash,
    from: connected.address,
    walletBrand: connected.walletBrand,
    providers: connected.providers,
  };
}

export function hasBrowserEvmWallet() {
  return Boolean(getEthereum());
}

export { discoverWalletProviders };
