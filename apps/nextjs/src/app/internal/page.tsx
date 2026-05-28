import { Suspense } from "react";

import { InternalDashboardOverviewPage } from "~/components/blink/internal-dashboard-overview-page";
import { InternalDashboardPageSkeleton } from "~/components/blink/internal-dashboard-page-skeleton";

export const dynamic = "force-dynamic";

export default function InternalPage() {
  return (
    <Suspense fallback={<InternalDashboardPageSkeleton />}>
      <InternalDashboardOverviewPage />
    </Suspense>
  );
}
