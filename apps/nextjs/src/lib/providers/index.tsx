"use client";

import { api } from "@acme/api/clients/react";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ORPCContext } from "../context/orpc";

export function ContextProviders({ children }: { children: React.ReactNode }) {
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

  return (
    <QueryClientProvider client={queryClient}>
      <ORPCContext.Provider value={orpc}>
        <PrivyProvider
          appId="cmgimeoko00a9jp0b2vbodvqa"
          config={{
            appearance: {
              theme: "dark",
            },
            embeddedWallets: {
              ethereum: {
                // auto-create an embedded EVM wallet for every Google user on first login
                createOnLogin: "users-without-wallets",
              },
              showWalletUIs: false,
            },
            // Google-only login — embedded wallet is provisioned automatically
            loginMethods: ["google"],
          }}
        >
          {children}
        </PrivyProvider>
      </ORPCContext.Provider>
    </QueryClientProvider>
  );
}
