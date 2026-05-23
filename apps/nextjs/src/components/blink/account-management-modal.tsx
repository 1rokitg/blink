"use client";

import { Dialog, DialogContent, DialogTitle } from "@acme/ui/dialog";
import { Input } from "@acme/ui/input";
import { ConnectTwitterButton } from "./connect-twitter-button";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AccountManagementModal(props: {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
}) {
  const short = truncateAddress(props.walletAddress);
  const avatarUrl = `https://avatar.vercel.sh/${props.walletAddress}.png?size=96`;

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[86vh] overflow-hidden border-[#8fc4ff54] bg-[#0c1119f2] p-0 sm:max-w-[980px]">
        <div className="grid h-full grid-cols-[220px_1fr]">
          <aside className="border-r border-white/10 p-4">
            <p className="mb-4 text-lg font-semibold text-white">Account</p>
            <div className="space-y-1 text-sm">
              {[
                "Account",
                "Connections",
                "Security",
                "Preferences",
                "Settings",
              ].map((item) => (
                <button
                  type="button"
                  key={item}
                  className={`w-full rounded-[10px] px-3 py-2 text-left transition ${item === "Account" ? "bg-white/10 text-white" : "text-foreground/60 hover:bg-white/5 hover:text-white"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </aside>
          <section className="overflow-y-auto p-6">
            <DialogTitle className="text-2xl font-semibold text-white">
              Account
            </DialogTitle>
            <div className="mt-5 flex items-center gap-4 border-b border-white/10 pb-5">
              <img
                src={avatarUrl}
                alt="User avatar"
                className="size-16 rounded-full border border-white/20"
              />
              <div>
                <p className="text-2xl font-semibold text-white">Trader</p>
                <p className="text-sm text-foreground/55">Wallet {short}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-foreground/45">
                  Username
                </p>
                <Input
                  defaultValue="rokitg"
                  className="h-10 border-white/15 bg-white/[0.04]"
                />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-foreground/45">
                  Public profile
                </p>
                <Input
                  defaultValue={`blink.lat/profile/${short}`}
                  className="h-10 border-white/15 bg-white/[0.04]"
                />
              </div>
            </div>
            <div className="mt-6 rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
              <p className="font-medium text-white">Portfolio Visibility</p>
              <p className="mt-1 text-sm text-foreground/58">
                Share your read-only stats with a public profile link.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-[10px] border border-[#38d7a46a] bg-[#18392e] px-3 py-2 text-sm text-[#98f0d2]">
                Enabled
              </div>
            </div>
            <div className="mt-4 rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
              <p className="font-medium text-white">X / Twitter verification</p>
              <p className="mt-1 text-sm text-foreground/58">
                Verify account ownership to unlock your verified badge and social proof on Blink.
              </p>
              <div className="mt-3">
                <ConnectTwitterButton showSuccessCard={false} />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
              <button
                type="button"
                className="whop-secondary-btn text-rose-200"
              >
                Delete account
              </button>
              <button
                type="button"
                className="whop-blue-btn"
                onClick={props.onClose}
              >
                Save
              </button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
