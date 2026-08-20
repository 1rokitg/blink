import type { ReactNode } from "react";

import { ShopifyStoreShell } from "@/components/internal/shopify-store-shell";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getShopifyStoreSnapshot } from "@/lib/shopify.server";

export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireInternalSession();
  const initial = await getShopifyStoreSnapshot();
  return <ShopifyStoreShell initial={initial}>{children}</ShopifyStoreShell>;
}
