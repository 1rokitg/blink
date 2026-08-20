import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClaimOfferForm } from "@/components/claim-offer-form";
import {
  getClaimLink,
  toPublicClaimView,
} from "@/lib/claim-links.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claim membership · The Circle",
  robots: { index: false, follow: false },
};

export default async function ClaimOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = await getClaimLink(id);
  if (!record) notFound();

  return (
    <ClaimOfferForm
      claim={toPublicClaimView(record)}
      canceled={query.canceled === "1"}
    />
  );
}
