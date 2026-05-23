"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@acme/ui/chart";
import { cn } from "@acme/ui";

const chartData = [
  { t: "00:00", equity: 120 },
  { t: "02:00", equity: 118 },
  { t: "04:00", equity: 136 },
  { t: "06:00", equity: 152 },
  { t: "08:00", equity: 150 },
  { t: "10:00", equity: 175 },
  { t: "12:00", equity: 178 },
  { t: "14:00", equity: 176 },
  { t: "16:00", equity: 182 },
  { t: "18:00", equity: 180 },
  { t: "20:00", equity: 92 },
  { t: "22:00", equity: 95 },
  { t: "24:00", equity: 94 },
];

const chartConfig = {
  equity: {
    label: "Equity",
    color: "#22d38f",
  },
} satisfies ChartConfig;

export function ProfileEquityChart({ className }: { className?: string }) {
  return (
    <div className={cn("mt-3 h-[250px] rounded-[10px] bg-[#070c18] p-2", className)}>
      <ChartContainer config={chartConfig} className="h-full w-full !aspect-auto">
        <AreaChart accessibilityLayer data={chartData} margin={{ left: 8, right: 8, top: 6, bottom: 2 }}>
          <defs>
            <linearGradient id="fillEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-equity)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-equity)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#1a2437" strokeDasharray="2 8" />
          <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={6} hide />
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
