"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

function seriesData(
  primary: number[],
  secondary?: number[],
  labels?: string[],
) {
  const length = Math.max(primary.length, secondary?.length ?? 0, 1);
  return Array.from({ length }, (_, index) => ({
    index,
    label: labels?.[index] ?? String(index + 1),
    primary: primary[index] ?? 0,
    secondary: secondary?.[index] ?? 0,
  }));
}

function formatAxisTick(value: number) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return String(Math.round(value));
}

export type ChartMarker = {
  /** Index into the series (0-based). */
  index: number;
  label: string;
  color?: string;
};

export function AreaLineChart({
  primary,
  secondary,
  labels,
  markers,
  primaryStroke = "var(--chart-1)",
  secondaryStroke = "#52525b",
  heightClass = "h-64",
  label = "Value",
  secondaryLabel = "Compare",
  showLegend = true,
  showGrid = true,
  curveType = "basis",
}: {
  primary: number[];
  secondary?: number[];
  /** Optional X-axis / tooltip labels (e.g. HH:mm or day ordinal). */
  labels?: string[];
  /** Vertical event markers (e.g. product launches). */
  markers?: ChartMarker[];
  primaryStroke?: string;
  secondaryStroke?: string;
  heightClass?: string;
  label?: string;
  secondaryLabel?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  curveType?: "basis" | "monotone" | "linear";
}) {
  const fillId = `fill-${useId().replace(/:/g, "")}`;
  const data = seriesData(primary, secondary, labels);
  const hasSecondary = Boolean(secondary?.length);
  const hasLabels = Boolean(labels?.length);
  const visibleMarkers = (markers ?? []).filter(
    (marker) =>
      Number.isFinite(marker.index) &&
      marker.index >= 0 &&
      marker.index < data.length,
  );
  const config = {
    primary: { label, color: primaryStroke },
    ...(hasSecondary
      ? { secondary: { label: secondaryLabel, color: secondaryStroke } }
      : {}),
  } satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto w-full", heightClass)}
      role="img"
      aria-label={`${label} chart${hasSecondary ? ` compared to ${secondaryLabel}` : ""}`}
    >
      <AreaChart
        data={data}
        margin={{
          top: 12,
          right: 12,
          left: 4,
          bottom: showLegend ? 4 : 0,
        }}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primaryStroke} stopOpacity={0.28} />
            <stop offset="55%" stopColor={primaryStroke} stopOpacity={0.08} />
            <stop offset="100%" stopColor={primaryStroke} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        {showGrid ? (
          <CartesianGrid
            stroke="#262626"
            strokeDasharray="4 4"
            vertical
            horizontal
          />
        ) : null}
        <XAxis
          dataKey="index"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={hasLabels && primary.length > 120 ? 40 : 24}
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickFormatter={(value) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return "";
            if (hasLabels) return labels?.[n] ?? "";
            return String(n + 1);
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tickMargin={6}
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickFormatter={formatAxisTick}
          domain={[0, "auto"]}
        />
        <ChartTooltip
          cursor={{ stroke: "#3f3f46", strokeDasharray: "4 4" }}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as
                  | { label?: string }
                  | undefined;
                return point?.label ?? "";
              }}
            />
          }
        />
        {showLegend ? (
          <ChartLegend
            verticalAlign="bottom"
            content={<ChartLegendContent className="gap-5 text-[#a1a1aa]" />}
          />
        ) : null}
        {visibleMarkers.map((marker) => (
          <ReferenceLine
            key={`${marker.index}-${marker.label}`}
            x={marker.index}
            stroke={marker.color ?? "#ff6a00"}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{
              value: marker.label,
              position: "insideTopLeft",
              fill: marker.color ?? "#ff6a00",
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        ))}
        {hasSecondary ? (
          <Line
            type={curveType}
            dataKey="secondary"
            name="secondary"
            stroke="var(--color-secondary)"
            strokeWidth={2}
            strokeDasharray="6 6"
            dot={false}
            activeDot={false}
          />
        ) : null}
        <Area
          type={curveType}
          dataKey="primary"
          name="primary"
          stroke="var(--color-primary)"
          strokeWidth={2.75}
          fill={`url(#${fillId})`}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function Sparkline({
  points,
  stroke = "var(--chart-1)",
  label = "Trend",
}: {
  points: number[];
  stroke?: string;
  label?: string;
}) {
  const data = seriesData(points);
  const config = {
    primary: { label, color: stroke },
  } satisfies ChartConfig;

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-12 w-44 justify-start"
      role="img"
      aria-label={`${label} sparkline`}
    >
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
        <CartesianGrid
          stroke="#262626"
          strokeDasharray="3 3"
          vertical={false}
          horizontal
        />
        <XAxis dataKey="index" hide />
        <YAxis hide domain={[0, "auto"]} />
        <Area
          type="basis"
          dataKey="primary"
          stroke="var(--color-primary)"
          strokeWidth={2.25}
          fill="transparent"
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** Stacked status strip with an accessible text legend. */
export function BreakdownBar({
  rows,
  colors,
  showLegend = true,
}: {
  rows: { key: string; value: number }[];
  colors: Record<string, string>;
  showLegend?: boolean;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return (
    <div className="space-y-3">
      <div
        className="flex h-3.5 overflow-hidden rounded-full bg-[#262626]"
        role="img"
        aria-label={rows
          .map((row) => `${row.key}: ${row.value}`)
          .join(", ")}
      >
        {rows.map((row) => (
          <div
            key={row.key}
            title={`${row.key}: ${row.value}`}
            style={{
              width: `${(row.value / total) * 100}%`,
              background: colors[row.key] ?? "var(--chart-5)",
            }}
          />
        ))}
      </div>
      {showLegend && rows.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-[#a1a1aa]">
          {rows.map((row) => (
            <li key={row.key} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: colors[row.key] ?? "var(--chart-5)" }}
                aria-hidden
              />
              <span className="capitalize">{row.key}</span>
              <span className="font-medium text-[#d4d4d8]">{row.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const DEFAULT_BAR_COLORS = [
  "#70a7ff",
  "#34d399",
  "#a78bfa",
  "#f59e0b",
  "#fb7185",
  "#22d3ee",
  "#c084fc",
  "#fbbf24",
];

/** Simple categorical vertical bars for revenue-by-source style charts. */
export function VerticalBarChart({
  rows,
  colors,
  heightClass = "h-56",
  valueLabel = "Value",
}: {
  rows: { key: string; value: number }[];
  colors?: Record<string, string>;
  heightClass?: string;
  valueLabel?: string;
}) {
  const chartConfig = {
    value: { label: valueLabel, color: "#70a7ff" },
  } satisfies ChartConfig;

  const data = rows.map((row) => ({
    key: row.key,
    value: row.value,
  }));

  return (
    <ChartContainer config={chartConfig} className={cn("w-full", heightClass)}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="key"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fill: "#71717a", fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={formatAxisTick}
          tick={{ fill: "#71717a", fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((row, index) => (
            <Cell
              key={row.key}
              fill={
                colors?.[row.key] ??
                DEFAULT_BAR_COLORS[index % DEFAULT_BAR_COLORS.length]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
