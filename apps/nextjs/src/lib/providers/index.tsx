"use client";

import { api } from "@acme/api/clients/react";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ORPCContext } from "../context/orpc";
import { env } from "~/env";

export function ContextProviders({ children }: { children: React.ReactNode }) {
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

  return (
    <QueryClientProvider client={queryClient}>
      <ORPCContext.Provider value={orpc}>
        {isE2EMode ? (
          children
        ) : (
          <PrivyProvider
            appId={env.NEXT_PUBLIC_PRIVY_APP_ID}
            config={{
              appearance: {
                theme: "dark",
                showWalletLoginFirst: true,
              },
              embeddedWallets: {
                ethereum: {
                  createOnLogin: "off",
                },
                showWalletUIs: false,
              },
              loginMethods: ["wallet"],
            }}
          >
            {children}
          </PrivyProvider>
        )}
      </ORPCContext.Provider>
    </QueryClientProvider>
  );
}
