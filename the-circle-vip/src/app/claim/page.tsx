import type { Metadata } from "next";

import { ClaimAccessForm } from "@/components/claim-access-form";
import { getRequestDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getRequestDictionary();
  return {
    title: dictionary.meta.claimTitle,
    description: dictionary.meta.claimDescription,
  };
}

export default function ClaimPage() {
  return <ClaimAccessForm />;
}
