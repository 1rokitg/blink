"use client";

import { useEffect } from "react";

const STORAGE_KEY = "circle_ref_code";

/** Capture `?ref=` into localStorage and ping affiliate click tracking once. */
export function ReferralCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("ref") || params.get("referral") || "";
    const code = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!code || code.length < 2) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // private mode
    }

    const pingKey = `circle_ref_ping_${code}`;
    if (sessionStorage.getItem(pingKey)) return;
    sessionStorage.setItem(pingKey, "1");

    void fetch("/api/ref/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      keepalive: true,
    }).catch(() => {
      // non-blocking
    });
  }, []);

  return null;
}

export function readStoredReferralCode() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}
