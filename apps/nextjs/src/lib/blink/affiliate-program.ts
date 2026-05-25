import { AFFILIATE_SEEDS, findAffiliateByWallet } from "./affiliate-seeds";

export type AffiliateProfile = {
  walletAddress: string;
  name: string;
  xHandle: string;
  xUrl: string;
  avatar: string;
  boostedCode: string;
  boostLabel: string;
  payoutSplitLabel: string;
};

function normalize(address: string) {
  return address.trim().toLowerCase();
}

function readAffiliateAllowlist() {
  const raw = process.env.NEXT_PUBLIC_AFFILIATE_WALLET_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((entry) => normalize(entry))
    .filter(Boolean);
}

export function isAffiliateWallet(address?: string | null) {
  if (!address) return false;
  const normalized = normalize(address);
  const envAllowlist = readAffiliateAllowlist();
  return envAllowlist.includes(normalized);
}

export function getAffiliateProfile(address?: string | null) {
  if (!address) return null;
  const normalized = normalize(address);
  const seeded = findAffiliateByWallet(normalized);
  if (seeded) {
    return {
      walletAddress: seeded.walletAddress ?? normalized,
      name: seeded.name,
      xHandle: seeded.xHandle,
      xUrl: seeded.xUrl,
      avatar: seeded.avatarUrl,
      boostedCode: seeded.code,
      boostLabel: seeded.rewardBoostLabel,
      payoutSplitLabel: seeded.payoutSplitLabel,
    } satisfies AffiliateProfile;
  }

  const allowlistFallback = AFFILIATE_SEEDS[0];
  if (!isAffiliateWallet(normalized)) return null;

  return {
    walletAddress: normalized,
    name: `Affiliate ${normalized.slice(2, 6).toUpperCase()}`,
    xHandle: "@affiliate",
    xUrl: "https://x.com",
    avatar: allowlistFallback?.avatarUrl ?? "https://unavatar.io/x/affiliate",
    boostedCode: "LOCKED",
    boostLabel: "1.0x",
    payoutSplitLabel: "70/30",
  } satisfies AffiliateProfile;
}
