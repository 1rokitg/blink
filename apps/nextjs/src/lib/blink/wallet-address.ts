export function normalizeWalletAddress(value: string) {
  return value.trim().toLowerCase();
}

export function isWalletAddress(value: string) {
  return /^0x[0-9a-f]{40}$/.test(normalizeWalletAddress(value));
}

export function getInternalUserPath(walletAddress: string) {
  return `/internal/users/${normalizeWalletAddress(walletAddress)}`;
}
