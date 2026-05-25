"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { useWallets } from "@privy-io/react-auth";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { Badge } from "@acme/ui/badge";
import { Switch } from "@acme/ui/switch";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@acme/ui/chart";

import { getAdminStats, type AdminStats } from "~/app/actions/get-admin-stats";
import { setFeatureFlagAction } from "~/app/actions/set-feature-flag";
import { getWalletRole, isAdminWallet } from "~/lib/blink/admin-allowlist";

function truncateAddress(address: string) {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount < 100 ? 2 : 0,
  }).format(amount);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatLabel(input: string) {
  if (!input) return "Unknown";
  return input
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function sourceBadge(source: "canonical" | "pipeline") {
  if (source === "canonical") {
    return (
      <Badge className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-300">
        L1 Canonical
      </Badge>
    );
  }
  return (
    <Badge className="rounded-full border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-sky-300">
      Pipeline
    </Badge>
  );
}

type NavItem = { label: string; active: boolean };
type AdminRange = "5m" | "15m" | "1h" | "1d" | "7d" | "30d" | "90d";

const ADMIN_RANGE_OPTIONS: Array<{
  value: AdminRange;
  label: string;
  windowDays: 1 | 7 | 30 | 90;
  liveMinutes: number;
}> = [
  { value: "5m", label: "5m", windowDays: 1, liveMinutes: 5 },
  { value: "15m", label: "15m", windowDays: 1, liveMinutes: 15 },
  { value: "1h", label: "1h", windowDays: 1, liveMinutes: 60 },
  { value: "1d", label: "Today", windowDays: 1, liveMinutes: 60 },
  { value: "7d", label: "7d", windowDays: 7, liveMinutes: 180 },
  { value: "30d", label: "30d", windowDays: 30, liveMinutes: 360 },
  { value: "90d", label: "90d", windowDays: 90, liveMinutes: 720 },
];

function getRangeConfig(range: AdminRange) {
  const found = ADMIN_RANGE_OPTIONS.find((option) => option.value === range);
  if (found) return found;
  return ADMIN_RANGE_OPTIONS[0] as (typeof ADMIN_RANGE_OPTIONS)[number];
}
