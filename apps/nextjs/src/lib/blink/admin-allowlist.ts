const ADMIN_WALLETS = [
  "0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6".toLowerCase(),
] as const;

export function getAdminAllowlist() {
  return [...ADMIN_WALLETS];
}

export function isAdminWallet(address: string | null | undefined) {
  if (!address) return false;
  return getAdminAllowlist().includes(address.toLowerCase());
}
