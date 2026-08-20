import { IndicatorsLanding } from "@/components/indicators/indicators-landing";

export default async function IndicatorsSitePage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const params = await searchParams;
  return <IndicatorsLanding canceled={params.canceled === "1"} />;
}
