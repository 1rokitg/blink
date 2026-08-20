import { MarketingLanding } from "@/components/marketing/marketing-landing";
import { getRequestDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Dictionary is already provided via root layout I18nProvider.
  await getRequestDictionary();
  return <MarketingLanding />;
}
