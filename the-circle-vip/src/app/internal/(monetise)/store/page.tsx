import { StoreOverviewSection } from "@/components/internal/shopify-store-sections";

export const metadata = {
  title: "Store · Internal Tools",
  robots: { index: false, follow: false },
};

export default function ShopifyStoreOverviewPage() {
  return <StoreOverviewSection />;
}
