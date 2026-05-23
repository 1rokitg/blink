"use client";

import { useUser } from "@privy-io/react-auth";
import { motion } from "motion/react";

function toAvatar(id: string, size = 80) {
  return `https://avatar.vercel.sh/${encodeURIComponent(id)}.png?size=${size}`;
}

export function BlinkAvatar() {
  const { user, refreshUser: refetchUser } = useUser();

  const id = user?.id;

  return (
    <div className="relative size-28 shrink-0">
      {/* Avatar image */}
      <img
        src={toAvatar(id ?? "fallback", 140)}
        alt={`${user?.id} avatar`}
        className="size-28 rounded-full border-4 border-[#08101f]"
      />
      {/* Blinking 👀 overlay */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-5xl"
        initial={{ opacity: 1 }}
        animate={{
          opacity: [1, 1, 0.3, 0, 0.3, 1, 1],
        }}
        transition={{
          duration: 2.4,
          times: [0, 0.35, 0.45, 0.525, 0.61, 0.7, 1],
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      >
        👀
      </motion.div>
    </div>
  );
}
