"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Skeleton } from "@acme/ui/skeleton";

export const internalPanelClass =
  "rounded-2xl border border-white/[0.06] bg-[#13141a]/90 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";
export const internalPanelInsetClass =
  "rounded-xl border border-white/[0.05] bg-white/[0.02]";
export const internalLabelClass = "text-xs font-medium text-white/45";
export const internalHeadingClass =
  "text-lg font-semibold tracking-tight text-white";
export const internalSubheadingClass = "text-sm leading-relaxed text-white/50";

export type InternalNavItem = {
  label: string;
  href: string;
  active?: boolean;
  soon?: boolean;
  icon?: LucideIcon;
};

export function InternalDashboardShell(props: {
  navItems: InternalNavItem[];
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto flex max-w-[1440px] gap-6">
        <aside
          className={`hidden w-[220px] shrink-0 p-2 lg:block ${internalPanelClass}`}
        >
          <p className="px-3 py-2 text-xs font-medium text-white/40">
            Internal
          </p>
          <nav className="mt-1 space-y-0.5">
            {props.navItems.map(({ label, active, href, soon, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? "bg-white/[0.08] font-medium text-white"
                    : "text-white/55 hover:bg-white/[0.04] hover:text-white/85"
                }`}
              >
                {Icon ? <Icon className="size-4 shrink-0 opacity-70" /> : null}
                <span className="flex-1">{label}</span>
                {!active && soon ? (
                  <span className="text-[10px] text-white/30">Soon</span>
                ) : null}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header
            className={`mb-5 flex flex-wrap items-center justify-between gap-3 ${internalPanelClass} px-4 py-3`}
          >
            {props.header}
          </header>
          {props.children}
        </div>
      </div>
    </main>
  );
}

export function InternalSection(props: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`mt-5 ${internalPanelClass} p-5 ${props.className ?? ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={internalHeadingClass}>{props.title}</h2>
          {props.description ? (
            <p className={`mt-1 max-w-2xl ${internalSubheadingClass}`}>
              {props.description}
            </p>
          ) : null}
        </div>
        {props.action}
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

export function InternalStatCard(props: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "positive" | "warning";
}) {
  const valueTone =
    props.tone === "positive"
      ? "text-emerald-400"
      : props.tone === "warning"
        ? "text-amber-300"
        : "text-white";

  return (
    <div className={`${internalPanelInsetClass} p-4`}>
      <p className={internalLabelClass}>{props.label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${valueTone}`}>
        {props.value}
      </p>
      {props.hint ? (
        <p className="mt-1 text-xs text-white/38">{props.hint}</p>
      ) : null}
    </div>
  );
}

const SKELETON_SLOTS = [
  "slot-a",
  "slot-b",
  "slot-c",
  "slot-d",
  "slot-e",
  "slot-f",
] as const;

export function StatGridSkeleton(props: { count?: number; columns?: string }) {
  const count = props.count ?? 4;
  return (
    <div
      className={`grid gap-3 ${props.columns ?? "md:grid-cols-2 lg:grid-cols-4"}`}
    >
      {SKELETON_SLOTS.slice(0, count).map((slot) => (
        <div key={slot} className={`${internalPanelInsetClass} p-4`}>
          <Skeleton className="h-3 w-20 rounded-full bg-white/[0.06]" />
          <Skeleton className="mt-3 h-8 w-28 rounded-lg bg-white/[0.08]" />
          <Skeleton className="mt-2 h-3 w-16 rounded-full bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className={`${internalPanelInsetClass} p-4`}>
      <Skeleton className="h-4 w-40 rounded-full bg-white/[0.06]" />
      <Skeleton className="mt-4 h-[200px] w-full rounded-xl bg-white/[0.04]" />
    </div>
  );
}

export function TableRowsSkeleton(props: { rows?: number }) {
  const rows = props.rows ?? 6;
  return (
    <div className={`${internalPanelInsetClass} divide-y divide-white/[0.04]`}>
      {SKELETON_SLOTS.slice(0, rows).map((slot) => (
        <div
          key={slot}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <Skeleton className="h-4 w-32 rounded-full bg-white/[0.06]" />
          <Skeleton className="h-4 w-16 rounded-full bg-white/[0.05]" />
          <Skeleton className="h-4 w-14 rounded-full bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

export function ListRowsSkeleton(props: { rows?: number }) {
  const rows = props.rows ?? 5;
  return (
    <div className="space-y-2">
      {SKELETON_SLOTS.slice(0, rows).map((slot) => (
        <div
          key={slot}
          className={`flex items-center justify-between ${internalPanelInsetClass} px-3 py-2.5`}
        >
          <Skeleton className="h-4 w-36 rounded-full bg-white/[0.06]" />
          <Skeleton className="h-4 w-20 rounded-full bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

export function DashboardOverviewSkeleton() {
  return (
    <>
      <div className={`${internalPanelClass} p-5`}>
        <Skeleton className="h-8 w-28 rounded-lg bg-white/[0.08]" />
        <StatGridSkeleton count={4} />
      </div>
      <InternalSection title="Loading metrics…">
        <StatGridSkeleton count={6} columns="md:grid-cols-3 lg:grid-cols-6" />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </InternalSection>
      <InternalSection title="Loading stats…">
        <StatGridSkeleton count={6} columns="md:grid-cols-3" />
        <div className="mt-4">
          <ChartSkeleton />
        </div>
      </InternalSection>
    </>
  );
}
