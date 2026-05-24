"use client";

import { ArrowRight, Clipboard, Copy, Gift } from "lucide-react";
import {
  getGrowthReferralMultiplier,
  isGrowthModeEnabled,
} from "~/lib/blink/growth-mode";

import { Dialog, DialogContent, DialogTitle } from "@acme/ui/dialog";

const REFERRALS: Array<{
  name: string;
  handle: string;
  earned: string;
  volume: string;
}> = [];

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ReferralsModal(props: {
  open: boolean;
  onClose: () => void;
  walletAddress?: string;
  alias?: string;
}) {
  const growthMode = isGrowthModeEnabled();
  const referralMultiplier = growthMode ? getGrowthReferralMultiplier() : 1;

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="border-none bg-transparent p-0 shadow-none sm:max-w-[500px]">
        <div className="overflow-hidden rounded-[24px] border border-[#7ea9ff42] bg-[#070d18d9] shadow-[0_35px_110px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
          <div className="px-5 pb-6 pt-4">
            <DialogTitle className="text-center text-2xl font-semibold text-white">
              Referrals
            </DialogTitle>
            <p className="mt-3 text-center text-5xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
              $0,00
            </p>
            <p className="text-center text-base text-foreground/58">
              Total earned rewards
            </p>
            <div className="mt-5 overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03]">
              <div className="whop-blue-btn h-10 w-full justify-center rounded-none border-0 text-sm">
                <Gift className="size-4" />
                Refer traders to earn{" "}
                {growthMode ? `${referralMultiplier}x ` : ""}$BLINK
              </div>
              <div className="grid grid-cols-2">
                <div className="px-4 py-4">
                  <p className="text-4xl font-semibold text-white">$0</p>
                  <p className="mt-1 text-sm text-foreground/58">
                    Earned last 7d
                  </p>
                </div>
                <div className="border-l border-white/10 px-4 py-4">
                  <p className="text-4xl font-semibold text-white">0</p>
                  <p className="mt-1 text-sm text-foreground/58">
                    Friends referred
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 flex h-12 items-center justify-center rounded-[16px] border border-white/10 bg-[#0f1526]">
              <span className="text-lg font-semibold text-foreground/62">
                blink.lat/r/{props.alias}
              </span>
              <button
                type="button"
                className="rounded-[10px] ml-3 p-2 text-foreground/55 transition hover:bg-white/[0.08] hover:text-white"
              >
                <Copy className="size-4" />
              </button>
            </div>
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-3xl font-semibold text-white">Referrals</p>
                <p className="text-base text-muted-foreground">Fees earned</p>
              </div>
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {REFERRALS.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <p className="text-lg font-medium text-foreground/52 mb-2">
                      No referrals joined yet
                    </p>
                    <span className="text-sm text-muted-foreground">
                      Share your link to start earning rewards.
                    </span>
                  </div>
                ) : (
                  REFERRALS.map((ref) => (
                    <div
                      key={ref.handle}
                      className="flex items-center justify-between rounded-[14px] px-2 py-2 hover:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://avatar.vercel.sh/${encodeURIComponent(ref.handle)}.png?size=72`}
                          alt={`${ref.name} avatar`}
                          className="size-11 rounded-full border border-white/20"
                        />
                        <div>
                          <p className="text-lg font-medium text-white">
                            {ref.name}
                          </p>
                          <p className="text-sm text-foreground/52">
                            {ref.handle}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold text-emerald-300">
                          {ref.earned}
                        </p>
                        <p className="text-sm text-foreground/45">
                          {ref.volume}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
