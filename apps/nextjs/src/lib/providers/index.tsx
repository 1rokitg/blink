"use client";

import { api } from "@acme/api/clients/react";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ORPCContext } from "../context/orpc";

export function ContextProviders({ children }: { children: React.ReactNode }) {
  const privyAppId = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "").trim();
  const hasValidPrivyAppId =
    privyAppId.length >= 12 && !/[\s"'`]/.test(privyAppId);
  const isE2EMode = process.env.NEXT_PUBLIC_E2E_MODE === "1";
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const [orpc] = useState(() => createORPCReactQueryUtils(api));
  useEffect(() => {
    setMounted(true);

    // ── Session + UTM tracking ─────────────────────────────────────────────
    // Record session start time (used for signup.sessionDurationSec).
    if (!sessionStorage.getItem("blink:session_start")) {
      sessionStorage.setItem("blink:session_start", String(Date.now()));
    }
    // Capture UTM params from the landing URL once per session.
    if (!sessionStorage.getItem("blink:utm")) {
      const p = new URLSearchParams(window.location.search);
      const utm = {
        ...(p.get("utm_source") ? { source: p.get("utm_source") } : {}),
        ...(p.get("utm_medium") ? { medium: p.get("utm_medium") } : {}),
        ...(p.get("utm_campaign") ? { campaign: p.get("utm_campaign") } : {}),
        ...(p.get("utm_content") ? { content: p.get("utm_content") } : {}),
        ...(p.get("utm_term") ? { term: p.get("utm_term") } : {}),
        ...(p.get("ref") ? { ref: p.get("ref") } : {}),
      };
      if (Object.keys(utm).length > 0) {
        sessionStorage.setItem("blink:utm", JSON.stringify(utm));
      }
    }
  }, []);

  if (!mounted) {
    return null;
  }

  if (!isE2EMode && !hasValidPrivyAppId) {
    return (
      <QueryClientProvider client={queryClient}>
        <ORPCContext.Provider value={orpc}>
          <div className="flex min-h-screen items-center justify-center bg-[#030712] p-6 text-white">
            <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-white/5 p-6">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/60">
                Privy Setup Required
              </p>
              <h1 className="mt-3 text-3xl font-semibold">
                Invalid `NEXT_PUBLIC_PRIVY_APP_ID`
              </h1>
              <p className="mt-3 text-white/80">
                Add a valid Privy app id in your local `.env` and restart dev
                server. Current value appears empty or malformed.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-lg border border-white/15 bg-black/30 p-3 text-sm text-white/80">
                NEXT_PUBLIC_PRIVY_APP_ID=&lt;your_privy_app_id&gt;
              </pre>
            </div>
          </div>
        </ORPCContext.Provider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ORPCContext.Provider value={orpc}>
        {isE2EMode ? (
          children
        ) : (
          <PrivyProvider
            appId={privyAppId}
            config={{
              appearance: {
                theme: "dark",
                showWalletLoginFirst: true,
              },
              embeddedWallets: {
                ethereum: {
                  createOnLogin: "users-without-wallets",
                },
                showWalletUIs: false,
              },
              loginMethods: ["google", "wallet"],
            }}
          >
            {children}
          </PrivyProvider>
        )}
      </ORPCContext.Provider>
    </QueryClientProvider>
  );
}
