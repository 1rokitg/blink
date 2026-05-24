import { Suspense } from "react";

import { E2ETradingFlowHarness } from "~/components/blink/e2e-trading-flow-harness";

export default function E2ETradingPage() {
  return (
    <Suspense fallback={null}>
      <E2ETradingFlowHarness />
    </Suspense>
  );
}
