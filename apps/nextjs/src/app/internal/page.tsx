import { Suspense } from "react";

import { AdminDashboard } from "~/components/blink/admin-dashboard";
import { InternalDashboardPageSkeleton } from "~/components/blink/internal-dashboard-page-skeleton";

export const dynamic = "force-dynamic";

export default function InternalPage() {
  return (
    <Suspense fallback={<InternalDashboardPageSkeleton />}>
      <AdminDashboard />
    </Suspense>
  );
}
