"use client";

import { Loader2 } from "lucide-react";

type InternalAccessCheckpointProps = {
  label?: string;
};

export function InternalAccessCheckpoint({
  label = "Security Checkpoint",
}: InternalAccessCheckpointProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
          {label}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-white">
          Verifying access
        </h1>
        <div className="mt-6 flex items-center gap-3 text-sm text-white/55">
          <Loader2 className="size-4 animate-spin" />
          <span>Checking credentials…</span>
        </div>
      </div>
    </main>
  );
}
