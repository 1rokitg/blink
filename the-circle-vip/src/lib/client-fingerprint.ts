"use client";

import type { ClientFingerprint } from "@/lib/analytics-types";
import type { CryptoEventName } from "@/lib/analytics-types";

type EthereumLike = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isOkxWallet?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isPhantom?: boolean;
  isRainbow?: boolean;
  isFrame?: boolean;
  isExodus?: boolean;
  isBitKeep?: boolean;
  isTokenPocket?: boolean;
  isOpera?: boolean;
  isAvalanche?: boolean;
  isPortal?: boolean;
  isZerion?: boolean;
  providers?: EthereumLike[];
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type Eip6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon?: string;
    rdns?: string;
  };
  provider: EthereumLike;
};

const BRAND_FLAGS: [keyof EthereumLike, string][] = [
  ["isRabby", "Rabby"],
  ["isMetaMask", "MetaMask"],
  ["isCoinbaseWallet", "Coinbase Wallet"],
  ["isBraveWallet", "Brave Wallet"],
  ["isOkxWallet", "OKX Wallet"],
  ["isTrust", "Trust Wallet"],
  ["isTrustWallet", "Trust Wallet"],
  ["isPhantom", "Phantom"],
  ["isRainbow", "Rainbow"],
  ["isFrame", "Frame"],
  ["isExodus", "Exodus"],
  ["isBitKeep", "BitKeep"],
  ["isTokenPocket", "TokenPocket"],
  ["isOpera", "Opera Wallet"],
  ["isZerion", "Zerion"],
];

function brandFromFlags(provider: EthereumLike | null | undefined) {
  if (!provider) return "Unknown";
  for (const [flag, brand] of BRAND_FLAGS) {
    if (provider[flag]) return brand;
  }
  return "Injected";
}

function brandFromRdns(rdns?: string, name?: string) {
  const hay = `${rdns ?? ""} ${name ?? ""}`.toLowerCase();
  if (hay.includes("rabby")) return "Rabby";
  if (hay.includes("metamask")) return "MetaMask";
  if (hay.includes("coinbase")) return "Coinbase Wallet";
  if (hay.includes("brave")) return "Brave Wallet";
  if (hay.includes("okx")) return "OKX Wallet";
  if (hay.includes("trust")) return "Trust Wallet";
  if (hay.includes("phantom")) return "Phantom";
  if (hay.includes("rainbow")) return "Rainbow";
  if (hay.includes("frame")) return "Frame";
  if (hay.includes("exodus")) return "Exodus";
  if (hay.includes("zerion")) return "Zerion";
  if (hay.includes("tokenpocket")) return "TokenPocket";
  return name?.trim() || "Injected";
}

/** Discover wallets via EIP-6963 + classic window.ethereum flags. */
export async function discoverWalletProviders(timeoutMs = 120): Promise<{
  brands: string[];
  selectedBrand: string;
  provider: EthereumLike | null;
}> {
  if (typeof window === "undefined") {
    return { brands: [], selectedBrand: "Unknown", provider: null };
  }

  const announced = new Map<string, Eip6963ProviderDetail>();
  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (detail?.info?.uuid) {
      announced.set(detail.info.uuid, detail);
    }
  };

  window.addEventListener("eip6963:announceProvider", onAnnounce);
  try {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  } catch {
    // ignore
  }
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
  window.removeEventListener("eip6963:announceProvider", onAnnounce);

  const brands = new Set<string>();
  for (const detail of announced.values()) {
    brands.add(brandFromRdns(detail.info.rdns, detail.info.name));
  }

  const eth = (window as unknown as { ethereum?: EthereumLike }).ethereum ?? null;
  if (eth?.providers?.length) {
    for (const provider of eth.providers) {
      brands.add(brandFromFlags(provider));
    }
  } else if (eth) {
    brands.add(brandFromFlags(eth));
  }

  const selectedBrand =
    [...brands][0] ?? (eth ? brandFromFlags(eth) : "None");

  return {
    brands: [...brands],
    selectedBrand,
    provider: eth,
  };
}

export function collectClientFingerprint(): ClientFingerprint {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      timezone: "unknown",
      language: "unknown",
      languages: [],
      platform: "unknown",
      screen: "0x0@1",
      colorDepth: 0,
      hardwareConcurrency: 0,
      deviceMemory: null,
      maxTouchPoints: 0,
      cookieEnabled: false,
      doNotTrack: null,
      vendor: "",
      webdriver: false,
    };
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    webdriver?: boolean;
  };

  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    language: navigator.language || "unknown",
    languages: [...(navigator.languages ?? [])].slice(0, 8),
    platform: navigator.platform || "unknown",
    screen: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}@${window.devicePixelRatio ?? 1}`,
    colorDepth: window.screen?.colorDepth ?? 0,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    deviceMemory: nav.deviceMemory ?? null,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack ?? null,
    vendor: navigator.vendor || "",
    webdriver: Boolean(nav.webdriver),
  };
}

export type TrackCryptoInput = {
  event: CryptoEventName;
  path?: string;
  planId?: string | null;
  chainId?: string | null;
  walletBrand?: string | null;
  walletAddress?: string | null;
  txHash?: string | null;
  error?: string | null;
  providers?: string[];
  amountUsdc?: number | null;
};

export function trackCryptoEvent(input: TrackCryptoInput) {
  if (typeof window === "undefined") return;
  try {
    const fingerprint = collectClientFingerprint();
    const body = JSON.stringify({
      type: "event",
      path: input.path || window.location.pathname,
      event: input.event,
      planId: input.planId ?? null,
      chainId: input.chainId ?? null,
      walletBrand: input.walletBrand ?? null,
      walletAddress: input.walletAddress ?? null,
      txHash: input.txHash ?? null,
      error: input.error ? String(input.error).slice(0, 240) : null,
      providers: input.providers ?? [],
      amountUsdc: input.amountUsdc ?? null,
      fingerprint,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/collect",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      void fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    // ignore analytics failures
  }
}
