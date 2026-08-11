import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GiftRedeemForm } from "@/components/gift-redeem-form";
import {
  getCompGift,
  toPublicCompGiftView,
} from "@/lib/comp-gifts.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gift membership · The Circle",
  robots: { index: false, follow: false },
};

export default async function GiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getCompGift(id);
  if (!record) notFound();

  return <GiftRedeemForm gift={toPublicCompGiftView(record)} />;
}
