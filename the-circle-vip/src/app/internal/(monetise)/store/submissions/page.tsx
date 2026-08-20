import { StoreSubmissionsSection } from "@/components/internal/shopify-store-sections";

export const metadata = {
  title: "Submissions · Store · Internal Tools",
  robots: { index: false, follow: false },
};

export default function StoreSubmissionsPage() {
  return <StoreSubmissionsSection />;
}
