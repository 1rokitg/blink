"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { AnimatePresence, motion } from "motion/react";
import { Gift, Sparkles, X } from "lucide-react";

const STORAGE_KEY_BY = "blink_welcomed_by";
const STORAGE_KEY_DISMISSED = "blink_welcomed_dismissed";

/**
 * ReferralWelcomeBanner
 *
 * Shows a one-time welcome message when a user arrives via a referral link.
 * Persistence strategy:
 *   1. /r/[code] sets cookie `blink_ref=code`
 *   2. This component reads the cookie on mount and copies it into
 *      localStorage as `blink_welcomed_by` — so it survives the claim flow
 *      which clears the cookie.
 *   3. Banner stays visible until the user explicitly dismisses it, which
 *      sets `blink_welcomed_dismissed=1` in localStorage.
 *   4. Once dismissed it never shows again.
 *
 * The `blink_welcomed_by` value is intentionally kept in localStorage
 * (never deleted) for retroactive campaign tracking — we can query it
 * even months later to see which referral code brought a user.
 */
export function ReferralWelcomeBanner() {
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already dismissed — never show again
    if (localStorage.getItem(STORAGE_KEY_DISMISSED)) return;

    // Check cookie first (user just arrived via /r/[code])
    const cookieCode = document.cookie
      .split("; ")
      .find((row) => row.startsWith("blink_ref="))
      ?.split("=")[1];

    if (cookieCode) {
      // Persist to localStorage BEFORE the claim flow clears the cookie
      localStorage.setItem(STORAGE_KEY_BY, cookieCode);
    }

    // Read from localStorage (covers both fresh arrivals and return visits)
    const storedCode = localStorage.getItem(STORAGE_KEY_BY);
    if (storedCode) {
      setInvitedBy(storedCode);
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY_DISMISSED, "1");
  }

  return (
    <AnimatePresence>
      {visible && invitedBy && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative mx-auto mb-3 max-w-[680px] overflow-hidden rounded-[16px] border border-[#2c6bff]/25 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          style={{
            background:
              "linear-gradient(135deg, #090e1ef2 0%, #0c1428f0 60%, rgba(44,107,255,0.08) 100%)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Top accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#6fa8ff66] to-transparent" />

          <div className="flex items-center gap-4 px-5 py-3.5">
            {/* Icon */}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#2c6bff]/30 bg-[#2c6bff]/15">
              <Sparkles className="size-4 text-[#6fa8ff]" />
            </span>

            {/* Copy */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">
                Welcome to Blink — invited by{" "}
                <span className="text-[#6fa8ff]">{invitedBy}</span> 👋
              </p>
              <p className="mt-0.5 text-xs text-white/45">
                You&apos;re an early user. Your activity is tracked and will count toward future reward campaigns.
              </p>
            </div>

            {/* Rewards link */}
            <Link
              href="/rewards"
              className="shrink-0 rounded-[10px] border border-[#2c6bff]/30 bg-[#2c6bff]/15 px-3 py-1.5 text-xs font-semibold text-[#6fa8ff] transition hover:bg-[#2c6bff]/25"
            >
              <Gift className="mr-1.5 inline size-3" />
              Rewards
            </Link>

            {/* Dismiss */}
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 rounded-full p-1.5 text-white/30 transition hover:bg-white/[0.07] hover:text-white/70"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
