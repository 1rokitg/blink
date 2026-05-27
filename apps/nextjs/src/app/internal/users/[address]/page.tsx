import { notFound, redirect } from "next/navigation";

import { AdminDashboard } from "~/components/blink/admin-dashboard";
import {
  getInternalUserPath,
  isWalletAddress,
  normalizeWalletAddress,
} from "~/lib/blink/wallet-address";

type PageProps = {
  params: Promise<{ address: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { address } = await params;
  const normalized = normalizeWalletAddress(address);

  if (!isWalletAddress(normalized)) {
    return { title: "User not found · Blink Internal" };
  }

  return {
    title: `${normalized.slice(0, 6)}…${normalized.slice(-4)} · Blink Internal`,
    description: `Superuser wallet console for ${normalized}.`,
  };
}

export default async function InternalUserByAddressPage({ params }: PageProps) {
  const { address } = await params;
  const normalized = normalizeWalletAddress(address);

  if (!isWalletAddress(normalized)) {
    notFound();
  }

  if (address !== normalized) {
    redirect(getInternalUserPath(normalized));
  }

  return <AdminDashboard section="users" initialUserAddress={normalized} />;
}
