import { TerminalShell } from "~/components/blink/terminal-shell";
import { slugToMarketSymbol } from "~/lib/blink/markets";

export default async function TradeMarketPage(props: {
  params: Promise<{ market: string }>;
}) {
  const params = await props.params;

  return <TerminalShell market={slugToMarketSymbol(params.market)} />;
}
