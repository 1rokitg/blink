import { StorePaymentsSection } from "@/components/internal/shopify-store-sections";

export const metadata = {
  title: "Payments · Store · Internal Tools",
  robots: { index: false, follow: false },
};

export default function StorePaymentsPage() {
  return <StorePaymentsSection />;
}
