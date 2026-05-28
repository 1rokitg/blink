"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { cn } from "@acme/ui";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@acme/ui/chart";
import { Skeleton } from "@acme/ui/skeleton";

const chartConfig = {
  equity: {
    label: "Equity",
    color: "#22d38f",
  },
} satisfies ChartConfig;

export function ProfileEquityChart(props: {
  className?: string;
  data: Array<{ t: string; equity: number }>;
  loading?: boolean;
}) {
  if (props.loading) {
    return (
      <div
        className={cn(
          "mt-3 h-[250px] rounded-[10px] bg-[#070c18] p-2",
          props.className,
        )}
      >
        <Skeleton className="h-full w-full rounded-lg bg-white/[0.06]" />
      </div>
    );
  }

  if (props.data.length < 2) {
    return (
      <div
        className={cn(
          "mt-3 flex h-[250px] items-center justify-center rounded-[10px] bg-[#070c18] p-2 text-sm text-white/40",
          props.className,
        )}
      >
        Not enough equity history for this period yet.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-3 h-[250px] rounded-[10px] bg-[#070c18] p-2",
        props.className,
      )}
    >
      <ChartContainer
        config={chartConfig}
        className="h-full w-full !aspect-auto"
      >
        <AreaChart
          accessibilityLayer
          data={props.data}
          margin={{ left: 8, right: 8, top: 6, bottom: 2 }}
        >
          <defs>
            <linearGradient id="fillEquity" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-equity)"
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor="var(--color-equity)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#1a2437"
            strokeDasharray="2 8"
          />
          <XAxis
            dataKey="t"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            hide
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Area
            dataKey="equity"
            type="monotone"
            fill="url(#fillEquity)"
            stroke="var(--color-equity)"
            strokeWidth={2.5}
            isAnimationActive
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
