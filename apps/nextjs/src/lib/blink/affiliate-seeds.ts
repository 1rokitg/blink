export type AffiliateSeed = {
  code: string;
  name: string;
  xHandle: string;
  xUrl: string;
  avatarUrl: string;
  walletAddress?: string;
  rewardBoostLabel: string;
  payoutSplitLabel: string;
  active: boolean;
};

function sanitizeCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

function parseXHandle(xProfileUrl: string) {
  try {
    const url = new URL(xProfileUrl);
    const path = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
    return path.replace(/^@/, "");
  } catch {
    return xProfileUrl
      .replace(/^https?:\/\/(x\.com|twitter\.com)\//i, "")
      .replace(/^@/, "")
      .split("/")[0]
      ?.trim();
  }
}

export function createAffiliateFromXProfile(input: {
  xProfileUrl: string;
  walletAddress?: string;
  name?: string;
  code?: string;
  rewardBoostLabel?: string;
  payoutSplitLabel?: string;
}): AffiliateSeed {
  const handle = parseXHandle(input.xProfileUrl);
  const safeHandle = handle || "affiliate";
  const xUrl = `https://x.com/${safeHandle}`;
  const code = sanitizeCode(input.code || safeHandle);

  return {
    code: code || "BLINK",
    name: input.name?.trim() || safeHandle,
    xHandle: `@${safeHandle}`,
    xUrl,
    avatarUrl: `https://unavatar.io/x/${safeHandle}`,
    walletAddress: input.walletAddress?.trim() || undefined,
    rewardBoostLabel: input.rewardBoostLabel?.trim() || "2.0x",
    payoutSplitLabel: input.payoutSplitLabel?.trim() || "80/20",
    active: true,
  };
}

export const AFFILIATE_SEEDS: AffiliateSeed[] = [
  createAffiliateFromXProfile({
    xProfileUrl: "https://x.com/devilsnippet",
    name: "devilsnippet",
    code: "snippet",
    rewardBoostLabel: "2.0x",
    payoutSplitLabel: "100/0",
  }),
  createAffiliateFromXProfile({
    xProfileUrl: "https://x.com/eguito0",
    name: "eguito0",
    code: "EGUITO0",
    rewardBoostLabel: "2.0x",
    payoutSplitLabel: "80/20",
  }),
  createAffiliateFromXProfile({
    xProfileUrl: "https://x.com/ZeMirch",
    name: "ZeMirch",
    code: "ZEMIRCH",
    rewardBoostLabel: "2.0x",
    payoutSplitLabel: "80/20",
  }),
  createAffiliateFromXProfile({
    xProfileUrl: "https://x.com/BasedBuilder007",
    code: "BASED",
    rewardBoostLabel: "2.0x",
    payoutSplitLabel: "50/50",
  }),
  createAffiliateFromXProfile({
    xProfileUrl: "https://x.com/zolandinho",
    code: "ZOLAN",
    rewardBoostLabel: "2.0x",
    payoutSplitLabel: "50/50",
  }),
  createAffiliateFromXProfile({
    xProfileUrl: "https://x.com/secretodefi",
    code: "SECRETODEFI",
    rewardBoostLabel: "2.0x",
    payoutSplitLabel: "50/50",
  }),
];

export function findAffiliateByWallet(address?: string | null) {
  if (!address) return null;
  const normalized = address.trim().toLowerCase();
  return (
    AFFILIATE_SEEDS.find(
      (seed) => seed.walletAddress?.trim().toLowerCase() === normalized,
    ) ?? null
  );
}
