"use client";

import CountUp from "react-countup";

export function CountUpInt({
  value,
  className,
  duration = 1.1,
  refreshKey = 0,
}: {
  value: number;
  className?: string;
  duration?: number;
  refreshKey?: number;
}) {
  return (
    <CountUp
      key={`${refreshKey}-${value}`}
      start={0}
      end={value}
      duration={duration}
      separator=","
      preserveValue
      className={className}
    />
  );
}

export function CountUpUsd({
  value,
  className,
  duration = 1.1,
  refreshKey = 0,
  decimals = 2,
}: {
  value: number;
  className?: string;
  duration?: number;
  refreshKey?: number;
  decimals?: number;
}) {
  return (
    <CountUp
      key={`${refreshKey}-usd-${value}`}
      start={0}
      end={value}
      duration={duration}
      decimals={decimals}
      decimal="."
      separator=","
      prefix="€"
      preserveValue
      className={className}
    />
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[#262626] ${className ?? ""}`}
      aria-hidden
    />
  );
}
