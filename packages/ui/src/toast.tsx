"use client";

import type { ToasterProps } from "sonner";
import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

/**
 * Dynamic Island–style toaster.
 * Sits top-right, uses a dark glass pill with a soft glow — feels native.
 */
export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toaster: "!top-4 !right-4",
          toast: [
            // shape
            "!rounded-2xl !border !border-white/[0.09]",
            // glass background
            "!bg-[#0e1118ee] !backdrop-blur-xl",
            // shadow + glow
            "!shadow-[0_8px_32px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)]",
            // text
            "!text-white/90 !text-[13px] !font-medium",
            // compact padding
            "!px-4 !py-3",
          ].join(" "),
          description: "!text-white/45 !text-xs !mt-0.5",
          actionButton: "!bg-white/10 !text-white hover:!bg-white/20 !rounded-lg !text-xs",
          cancelButton: "!bg-white/5 !text-white/50 hover:!bg-white/10 !rounded-lg !text-xs",
          // success: teal left accent
          success: "![border-left:2px_solid_#3be1ba] !pl-3.5",
          // error: rose left accent
          error: "![border-left:2px_solid_#f87171] !pl-3.5",
          // loading: blue left accent
          loading: "![border-left:2px_solid_#6fb3ff] !pl-3.5",
          // info
          info: "![border-left:2px_solid_#6fb3ff] !pl-3.5",
        },
      }}
      {...props}
    />
  );
}
