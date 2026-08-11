"use client";

import { useEffect } from "react";

import { ensureStoredAttribution } from "@/lib/attribution";

/**
 * First-touch UTM / channel capture for rokitg.com.
 * Runs on every public page so /join and deep links inherit the same cookie jar.
 */
export function AttributionCapture() {
  useEffect(() => {
    ensureStoredAttribution();
  }, []);

  return null;
}
