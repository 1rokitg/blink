import { Skeleton } from "@acme/ui/skeleton";

import { DashboardOverviewSkeleton } from "./internal-dashboard-primitives";

export function InternalDashboardPageSkeleton() {
  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto flex max-w-[1440px] gap-6">
        <aside className="hidden w-[220px] shrink-0 rounded-2xl border border-white/[0.06] bg-[#13141a]/90 p-2 lg:block">
          <Skeleton className="mx-3 mt-2 h-3 w-16 rounded-full bg-white/[0.06]" />
          <div className="mt-3 space-y-1 px-1">
            {["nav-a", "nav-b", "nav-c", "nav-d", "nav-e"].map((id) => (
              <Skeleton
                key={id}
                className="h-9 w-full rounded-xl bg-white/[0.04]"
              />
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#13141a]/90 px-4 py-3">
            <Skeleton className="h-7 w-36 rounded-full bg-white/[0.06]" />
            <Skeleton className="hidden h-9 w-64 rounded-xl bg-white/[0.04] md:block" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-xl bg-white/[0.05]" />
              <Skeleton className="h-9 w-20 rounded-xl bg-white/[0.05]" />
              <Skeleton className="h-9 w-24 rounded-xl bg-white/[0.05]" />
            </div>
          </div>
          <DashboardOverviewSkeleton />
        </div>
      </div>
    </main>
  );
}
