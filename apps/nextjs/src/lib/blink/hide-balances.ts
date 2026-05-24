"use client";

import { useEffect, useState } from "react";

const HIDE_BALANCES_KEY = "blink:hide-balances";

export function useHideBalances() {
  const [hideBalances, setHideBalances] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(HIDE_BALANCES_KEY);
      setHideBalances(stored === "1");
    } catch {
      setHideBalances(false);
    }
  }, []);

  const updateHideBalances = (next: boolean) => {
    setHideBalances(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HIDE_BALANCES_KEY, next ? "1" : "0");
    } catch {
      // no-op
    }
  };

  return { hideBalances, setHideBalances: updateHideBalances };
}

export function maskValue(value: string, hidden: boolean) {
  return hidden ? "••••" : value;
}

export function maskNumberish(
  value: number | null | undefined,
  formatter: (n: number) => string,
  hidden: boolean,
  fallback = "—",
) {
  if (value === null || value === undefined) return fallback;
  if (!Number.isFinite(value)) return fallback;
  return hidden ? "••••" : formatter(value);
}
