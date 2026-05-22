"use client";

import { usePrivy } from "@privy-io/react-auth";

import { Button } from "@acme/ui/button";

export function Connect() {
  const { connectWallet } = usePrivy();

  return (
    <Button
      className="rounded-full bg-white px-4 text-sm font-semibold text-black hover:bg-white/90"
      onClick={() => connectWallet()}
    >
      Connect
    </Button>
  );
}
