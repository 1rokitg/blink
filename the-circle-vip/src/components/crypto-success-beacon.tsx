"use client";

import { useEffect } from "react";

import { trackCryptoEvent } from "@/lib/client-fingerprint";

export function CryptoSuccessBeacon({
  planId,
}: {
  planId?: string | null;
}) {
  useEffect(() => {
    trackCryptoEvent({
      event: "crypto_success_page",
      planId: planId ?? null,
      path: "/success",
    });
  }, [planId]);

  return null;
}
