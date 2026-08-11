"use client";

import { useState, useTransition } from "react";

export function DashboardPortalButton() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openPortal() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/portal", { method: "POST" });
        const data = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !data.url) {
          setError(data.error ?? "Could not open billing portal.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Network error opening billing portal.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={openPortal}
        disabled={isPending}
        className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff6a00] to-[#ff3b00] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(255,74,26,0.35)] disabled:opacity-60"
      >
        {isPending ? "Opening…" : "Manage billing in Stripe"}
      </button>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
