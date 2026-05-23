"use client";

import { motion } from "motion/react";

function avatarUrl(id: string, size = 80) {
  return `https://avatar.vercel.sh/${encodeURIComponent(id)}.png?size=${size}`;
}

export function BlinkAvatar({ username }: { username: string }) {
  return (
    <div className="relative size-28 shrink-0">
      {/* Avatar image */}
      <img
        src={avatarUrl(username, 140)}
        alt={`${username} avatar`}
        className="size-28 rounded-full border-4 border-[#08101f]"
      />
      {/* Blinking 👀 overlay */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center text-4xl"
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
