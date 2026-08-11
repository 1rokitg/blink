export type DailyMetrics = {
  pageviews: number;
  /** Visitor hashes — used only in KV budget mode (capped). */
  uniques: string[];
  /** Optional explicit unique count when hashes are not stored (AE mode). */
  uniquesCount?: number;
  byCountry: Record<string, number>;
  byPath: Record<string, number>;
  /** First-touch sales channel pageviews (twitter, instagram, …). */
  byChannel?: Record<string, number>;
};

export type VisitorProfile = {
  id: string;
  ip: string;
  country: string;
  region: string;
  city: string;
  ua: string;
  firstSeen: string;
  lastSeen: string;
  /** Distinct UTC days with at least one hit. */
  visitDays: number;
  pageviews: number;
  lastPath: string;
  lastHost: string;
  topPaths: Record<string, number>;
  lastDayKey: string;
  /** Soft client fingerprint last seen. */
  fingerprint?: ClientFingerprint | null;
  /** First-touch acquisition channel (never overwritten). */
  channel?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  wallets?: string[];
  walletBrands?: string[];
  cryptoConnects?: number;
  cryptoPays?: number;
  lastWalletAddress?: string | null;
  lastWalletBrand?: string | null;
};

export type ClientFingerprint = {
  timezone: string;
  language: string;
  languages: string[];
  platform: string;
  screen: string;
  colorDepth: number;
  hardwareConcurrency: number;
  deviceMemory: number | null;
  maxTouchPoints: number;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  vendor: string;
  webdriver: boolean;
};

export type CryptoEventName =
  | "crypto_view"
  | "pay_method_select"
  | "crypto_chain_select"
  | "crypto_manual_open"
  | "crypto_connect_attempt"
  | "crypto_connect_success"
  | "crypto_connect_fail"
  | "crypto_sign_prompt"
  | "crypto_sign_success"
  | "crypto_sign_fail"
  | "crypto_verify_start"
  | "crypto_verify_success"
  | "crypto_verify_fail"
  | "crypto_paid"
  | "crypto_success_page"
  | "wallet_detected";

export type CryptoEventRecord = {
  id: string;
  at: string;
  event: CryptoEventName;
  visitorId: string;
  ip: string;
  country: string;
  path: string;
  planId: string | null;
  chainId: string | null;
  walletBrand: string | null;
  walletAddress: string | null;
  txHash: string | null;
  error: string | null;
  providers: string[];
  fingerprint: ClientFingerprint | null;
};

export type CryptoDailyMetrics = {
  views: number;
  methodCrypto: number;
  methodCard: number;
  connectAttempts: number;
  connectSuccess: number;
  connectFail: number;
  signSuccess: number;
  signFail: number;
  verifySuccess: number;
  verifyFail: number;
  paid: number;
  revenueUsdc: number;
  byWallet: Record<string, number>;
  byChain: Record<string, number>;
  byPlan: Record<string, number>;
  uniqueWallets: string[];
  uniqueVisitors: string[];
};

export type WalletProfile = {
  address: string;
  brands: string[];
  firstSeen: string;
  lastSeen: string;
  connectCount: number;
  payCount: number;
  totalUsdc: number;
  lastVisitorId: string | null;
  lastCountry: string | null;
  lastPlanId: string | null;
  lastChainId: string | null;
  lastTxHash: string | null;
  chains: Record<string, number>;
  plans: Record<string, number>;
};

export type StorePlanRow = {
  id: "month" | "quarter" | "year";
  label: string;
  description: string;
  /** USD list price / USDC crypto amount. */
  amountUsd: number;
  /** Card / Stripe amount in EUR. */
  amountEur: number;
  currency: string;
  interval: string;
  intervalCount: number;
  priceId: string | null;
  productId: string | null;
  active: boolean;
  envKey: string;
  override: boolean;
  subscribers: number;
  mrr: number;
  checkoutStarts: number;
};

export type CryptoFunnelStats = {
  series: { date: string; metrics: CryptoDailyMetrics }[];
  totals: CryptoDailyMetrics;
  conversion: {
    viewToConnect: number | null;
    connectToSign: number | null;
    signToPaid: number | null;
    viewToPaid: number | null;
  };
  wallets: WalletProfile[];
  recentEvents: CryptoEventRecord[];
  payments: {
    txHash: string;
    chainId: string;
    planId: string;
    amountUsdc: number;
    walletAddress: string | null;
    walletBrand: string | null;
    telegramUsername: string;
    createdAt: string;
  }[];
};
