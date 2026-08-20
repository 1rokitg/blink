import { StoreProductsSection } from "@/components/internal/shopify-store-sections";

export const metadata = {
  title: "Products · Store · Internal Tools",
  robots: { index: false, follow: false },
};

export default function StoreProductsPage() {
  return <StoreProductsSection />;
}
