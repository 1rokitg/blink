"use client";

import { useRef, useState } from "react";

import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ProfileShareButtonProps {
  path: string;
  title: string;
}

export function ProfileShareButton({ path, title }: ProfileShareButtonProps) {
  const resetTimerRef = useRef<number | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  async function handleShare() {
    const url = new URL(path, window.location.origin).toString();

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: "Check out this Blink trading profile.",
          url,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast.success("Profile link copied.");

      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }

      resetTimerRef.current = window.setTimeout(() => {
        setIsCopied(false);
        resetTimerRef.current = null;
      }, 1800);
    } catch {
      toast.error("Could not copy the profile link.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/[0.10]"
    >
      {isCopied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {isCopied ? "Copied" : "Share profile"}
    </button>
  );
}
