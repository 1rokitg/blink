import { StoreOrdersSection } from "@/components/internal/shopify-store-sections";

export const metadata = {
  title: "Orders · Store · Internal Tools",
  robots: { index: false, follow: false },
};

export default function StoreOrdersPage() {
  return <StoreOrdersSection />;
}
