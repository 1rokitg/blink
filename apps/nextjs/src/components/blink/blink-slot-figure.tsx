"use client";

import { useEffect, useRef, useState } from "react";

import SlotCounter from "react-slot-counter";

import { cn } from "@acme/ui";

type FlashDirection = "up" | "down" | "none";

export type BlinkSlotFigureProps = {
  value: number;
  format: (value: number) => string;
  hidden?: boolean;
  className?: string;
  /** Shown when value is missing or ≤ 0. */
  fallback?: string;
  inactive?: boolean;
  /** Slightly longer debounce for fast-ticking prices. */
  debounceMs?: number;
};

export function BlinkSlotFigure({
  value,
  format,
  hidden = false,
  className,
  fallback = "—",
  inactive = false,
  debounceMs = 90,
}: BlinkSlotFigureProps) {
  const prevValueRef = useRef(value);
  const [flash, setFlash] = useState<FlashDirection>("none");

  const isActive = !inactive && Number.isFinite(value) && value > 0 && !hidden;

  useEffect(() => {
    if (!isActive) {
      prevValueRef.current = value;
      return;
    }

    const previous = prevValueRef.current;
    if (previous === value) return;

    const direction: FlashDirection =
      value > previous ? "up" : value < previous ? "down" : "none";

    prevValueRef.current = value;

    if (direction === "none") return;

    setFlash(direction);
    const timer = window.setTimeout(() => setFlash("none"), 700);
    return () => window.clearTimeout(timer);
  }, [isActive, value]);

  if (hidden) {
    return (
      <span className={cn("font-mono tabular-nums", className)}>••••</span>
    );
  }

  if (!isActive) {
    return (
      <span className={cn("font-mono tabular-nums", className)}>
        {fallback}
      </span>
    );
  }

  const display = format(value);

  return (
    <span
      className={cn(
        "inline-flex max-w-full font-mono tabular-nums transition-colors duration-500 ease-out",
        flash === "up" && "text-emerald-400",
        flash === "down" && "text-rose-400",
        className,
      )}
    >
      <SlotCounter
        value={display}
        duration={0.42}
        speed={1.65}
        debounceDelay={debounceMs}
        useMonospaceWidth
        startFromLastDigit
        animateUnchanged={false}
        sequentialAnimationMode={false}
        containerClassName="inline-flex max-w-full align-baseline"
        charClassName="leading-none"
        numberClassName="leading-none"
        separatorClassName="leading-none opacity-90"
      />
    </span>
  );
}
