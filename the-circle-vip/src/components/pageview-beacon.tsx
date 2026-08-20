"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ensureStoredAttribution } from "@/lib/attribution";
import { collectClientFingerprint } from "@/lib/client-fingerprint";

/** Lightweight first-party pageview beacon with enriched fingerprint + channel. */
export function PageviewBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/internal")) return;

    const attribution = ensureStoredAttribution();
    const body = JSON.stringify({
      type: "pageview",
      path: pathname,
      fingerprint: collectClientFingerprint(),
      attribution,
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/collect",
          new Blob([body], { type: "application/json" }),
        );
      } else {
        void fetch("/api/collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch {
      // ignore
    }
  }, [pathname]);

  return null;
}
