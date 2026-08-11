import { StoreCustomersSection } from "@/components/internal/shopify-store-sections";

export const metadata = {
  title: "Customers · Store · Internal Tools",
  robots: { index: false, follow: false },
};

export default function StoreCustomersPage() {
  return <StoreCustomersSection />;
}
