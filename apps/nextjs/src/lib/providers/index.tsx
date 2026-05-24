"use client";

import { api } from "@acme/api/clients/react";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ORPCContext } from "../context/orpc";

export function ContextProviders({ children }: { children: React.ReactNode }) {
  const privyAppId =
    process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "cmgimeoko00a9jp0b2vbodvqa";
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
            appId={privyAppId}
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
