export type AffiliateProfile = {
  walletAddress: string;
  name: string;
  xHandle: string;
  xUrl: string;
  boostedCode: string;
  boostLabel: string;
};

const SEEDED_AFFILIATES: AffiliateProfile[] = [
  {
    walletAddress: "0x0000000000000000000000000000000000000000",
    name: "BasedBuilder007",
    xHandle: "@BasedBuilder007",
    xUrl: "https://x.com/BasedBuilder007",
    boostedCode: "BASED",
    boostLabel: "2.0x",
  },
];

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
  const seeded = SEEDED_AFFILIATES.find(
    (item) => normalize(item.walletAddress) === normalized,
  );
  if (seeded) return seeded;
  if (!isAffiliateWallet(normalized)) return null;

  return {
    walletAddress: normalized,
    name: `Affiliate ${normalized.slice(2, 6).toUpperCase()}`,
    xHandle: "@affiliate",
    xUrl: "https://x.com",
    boostedCode: "LOCKED",
    boostLabel: "1.0x",
  } satisfies AffiliateProfile;
}

