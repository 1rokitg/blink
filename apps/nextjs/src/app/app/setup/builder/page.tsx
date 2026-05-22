import { BuilderSetupScreen } from "~/components/blink/builder-setup-screen";

export default async function BuilderSetupPage(props: {
  searchParams: Promise<{ market?: string }>;
}) {
  const searchParams = await props.searchParams;

  return <BuilderSetupScreen market={searchParams.market ?? null} />;
}
