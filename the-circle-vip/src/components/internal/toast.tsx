"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  push: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function toneClass(tone: ToastTone) {
  switch (tone) {
    case "error":
      return "border-rose-500/30 bg-rose-500/15 text-rose-100";
    case "info":
      return "border-sky-500/30 bg-sky-500/15 text-sky-100";
    default:
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-100";
  }
}

export function InternalToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev, { id, message, tone }].slice(-4));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto rounded-2xl border px-4 py-3 text-[13px] font-medium shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-md ${toneClass(item.tone)}`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useInternalToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: (message: string, tone: ToastTone = "success") => {
        if (typeof window !== "undefined") {
          console.info(`[toast:${tone}]`, message);
        }
      },
    };
  }
  return ctx;
}
