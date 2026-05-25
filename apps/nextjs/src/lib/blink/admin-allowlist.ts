const SUPERUSER_WALLETS = [
  "0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6".toLowerCase(),
] as const;

const ADMIN_WALLETS = [
  ...SUPERUSER_WALLETS,
  "0xC073DeE020A561DEA671d8b7fF64F6fA1e90940D".toLowerCase(),
] as const;

export type BlinkRole = "viewer" | "admin" | "superuser";

export function getAdminAllowlist() {
  return [...ADMIN_WALLETS];
}

export function isAdminWallet(address: string | null | undefined) {
  if (!address) return false;
  return getAdminAllowlist().includes(address.toLowerCase());
}

export function isSuperuserWallet(address: string | null | undefined) {
  if (!address) return false;
  return SUPERUSER_WALLETS.includes(address.toLowerCase());
}

export function getWalletRole(address: string | null | undefined): BlinkRole {
  if (isSuperuserWallet(address)) return "superuser";
  if (isAdminWallet(address)) return "admin";
  return "viewer";
}
