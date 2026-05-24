"use client";

import { useCallback, useRef, useState } from "react";

import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@acme/ui/dialog";

import { maskNumberish, maskValue } from "~/lib/blink/hide-balances";
import { formatUsd } from "~/lib/blink/markets";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PnlPositionData = {
  coin: string;
  side: "Long" | "Short";
  entryPx: number;
  markPx: number;
  pnl: number;
  pnlPct: number;
  size: number;
  leverage: number;
};

export type PnlPortfolioData = {
  walletAddress: string;
  accountValue: number;
  totalRealizedPnl: number;
  openPositions: number;
  recentFills: number;
};

type ModalProps =
  | {
      type: "position";
      data: PnlPositionData;
      open: boolean;
      onClose: () => void;
      hideBalances?: boolean;
    }
  | {
      type: "portfolio";
      data: PnlPortfolioData;
      open: boolean;
      onClose: () => void;
      hideBalances?: boolean;
    };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPct(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function truncateAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Card components (these are what get screenshot'd) ────────────────────

function PositionCard({
  data,
  hideBalances,
}: {
  data: PnlPositionData;
  hideBalances: boolean;
}) {
  const isProfit = data.pnl >= 0;
  const color = isProfit ? "#3be1ba" : "#f87171";
  const glowColor = isProfit ? "#3be1ba14" : "#f8717114";
  const logoSrc = `https://assets.coincap.io/assets/icons/${data.coin.toLowerCase()}@2x.png`;

  return (
    <div
      style={{
        width: 600,
        height: 315,
        background: "#050812",
        borderRadius: 24,
        overflow: "hidden",
        position: "relative",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "28px 32px 24px",
      }}
    >
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 55% 60% at 15% 40%, ${glowColor}, transparent), radial-gradient(ellipse 40% 50% at 80% 60%, ${isProfit ? "#1e5c4a22" : "#5c1e1e22"}, transparent)`,
        }}
      />
      {/* Subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      {/* Border */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 24,
          border: `1px solid ${isProfit ? "#3be1ba28" : "#f8717128"}`,
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
        {/* Coin logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt={data.coin}
          width={52}
          height={52}
          style={{ borderRadius: "50%", background: "#111827" }}
          onError={(e) => {
            const hue = [...data.coin].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).insertAdjacentHTML(
              "afterend",
              `<div style="width:52px;height:52px;border-radius:50%;background:hsl(${hue},50%,30%);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px">${data.coin.slice(0, 2)}</div>`,
            );
          }}
        />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#fff", fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em" }}>
              {data.coin}
            </span>
            <span
              style={{
                background: isProfit ? "#3be1ba22" : "#f8717122",
                border: `1px solid ${color}44`,
                borderRadius: 100,
                padding: "2px 10px",
                color,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {data.side}
            </span>
            <span
              style={{
                background: "#ffffff12",
                border: "1px solid #ffffff18",
                borderRadius: 100,
                padding: "2px 10px",
                color: "#ffffff80",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {data.leverage}×
            </span>
          </div>
          <div style={{ color: "#ffffff55", fontSize: 13, marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
            <span>
              Entry {maskNumberish(data.entryPx, formatUsd, hideBalances)}
            </span>
            <span style={{ color: "#ffffff30" }}>→</span>
            <span style={{ color: "#ffffff75" }}>
              Mark {maskNumberish(data.markPx, formatUsd, hideBalances)}
            </span>
          </div>
        </div>
      </div>

      {/* PnL — center */}
      <div style={{ position: "relative", textAlign: "center" }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color,
            lineHeight: 1,
            textShadow: `0 0 60px ${color}88`,
          }}
        >
          {data.pnl >= 0 ? "+" : ""}
          {maskNumberish(data.pnl, formatUsd, hideBalances)}
        </div>
        <div style={{ color: `${color}cc`, fontSize: 18, fontWeight: 600, marginTop: 4 }}>
          {maskValue(formatPct(data.pnlPct), hideBalances)}
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20 }}>👀</span>
          <span style={{ color: "#ffffff40", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em" }}>
            blink.lat
          </span>
        </div>
        <span style={{ color: "#ffffff25", fontSize: 12 }}>
          Trade perps on Hyperliquid
        </span>
      </div>
    </div>
  );
}

function PortfolioCard({
  data,
  hideBalances,
}: {
  data: PnlPortfolioData;
  hideBalances: boolean;
}) {
  const isProfit = data.totalRealizedPnl >= 0;
  const color = isProfit ? "#3be1ba" : "#f87171";

  return (
    <div
      style={{
        width: 600,
        height: 315,
        background: "#050812",
        borderRadius: 24,
        overflow: "hidden",
        position: "relative",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "28px 32px 24px",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 55% 60% at 20% 30%, #2056ff12, transparent), radial-gradient(ellipse 40% 50% at 75% 65%, #3be1ba10, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div style={{ position: "absolute", inset: 0, borderRadius: 24, border: "1px solid #7ea9ff28" }} />

      {/* Header */}
      <div style={{ position: "relative" }}>
        <div style={{ color: "#ffffff55", fontSize: 13, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Portfolio · {truncateAddr(data.walletAddress)}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ position: "relative", display: "flex", gap: 28 }}>
        {/* Realized PnL — big */}
        <div>
          <div style={{ color: "#ffffff35", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
            Total Realized PnL
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color,
              lineHeight: 1,
              textShadow: `0 0 50px ${color}66`,
            }}
          >
            {data.totalRealizedPnl >= 0 ? "+" : ""}
            {maskNumberish(data.totalRealizedPnl, formatUsd, hideBalances)}
          </div>
        </div>
        {/* Secondary stats */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 10, paddingBottom: 4 }}>
          <div>
            <div style={{ color: "#ffffff30", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Account Value
            </div>
            <div style={{ color: "#ffffffcc", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {maskNumberish(data.accountValue, formatUsd, hideBalances)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <div style={{ color: "#ffffff30", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Positions
              </div>
              <div style={{ color: "#ffffff99", fontSize: 18, fontWeight: 600 }}>
                {data.openPositions}
              </div>
            </div>
            <div>
              <div style={{ color: "#ffffff30", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Fills
              </div>
              <div style={{ color: "#ffffff99", fontSize: 18, fontWeight: 600 }}>
                {data.recentFills}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20 }}>👀</span>
          <span style={{ color: "#ffffff40", fontSize: 13, fontWeight: 500 }}>blink.lat</span>
        </div>
        <span style={{ color: "#ffffff25", fontSize: 12 }}>Trade perps on Hyperliquid</span>
      </div>
    </div>
  );
}

// ─── Share actions ───────────────────────────────────────────────────────────

async function captureCard(ref: React.RefObject<HTMLDivElement | null>): Promise<Blob> {
  if (!ref.current) throw new Error("Card not mounted");
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(ref.current, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#050812",
  });
  const res = await fetch(dataUrl);
  return await res.blob();
}

function ShareActions({ cardRef, shareText }: {
  cardRef: React.RefObject<HTMLDivElement | null>;
  shareText: string;
}) {
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await captureCard(cardRef);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blink-pnl-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PnL card saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save card");
    } finally {
      setDownloading(false);
    }
  }, [cardRef]);

  const handleCopy = useCallback(async () => {
    setCopying(true);
    try {
      const blob = await captureCard(cardRef);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast.success("Copied to clipboard");
    } catch {
      // Fallback — just copy the text
      await navigator.clipboard.writeText(shareText + " — blink.lat");
      toast.success("Share text copied");
    } finally {
      setTimeout(() => setCopying(false), 1500);
    }
  }, [cardRef, shareText]);

  const handleShareX = useCallback(async () => {
    // Try to download first, then open X
    try {
      const blob = await captureCard(cardRef);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blink-pnl-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
    const encoded = encodeURIComponent(`${shareText} — blink.lat`);
    window.open(`https://x.com/intent/tweet?text=${encoded}`, "_blank", "noreferrer");
  }, [cardRef, shareText]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={downloading}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.09] hover:text-white disabled:opacity-50"
      >
        <Download className="size-3.5" />
        {downloading ? "Saving…" : "Save"}
      </button>

      <button
        type="button"
        onClick={() => void handleCopy()}
        disabled={copying}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/[0.09] hover:text-white disabled:opacity-50"
      >
        {copying ? <Check className="size-3.5 text-emerald-400" /> : <Clipboard className="size-3.5" />}
        {copying ? "Copied!" : "Copy"}
      </button>

      <button
        type="button"
        onClick={() => void handleShareX()}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1a1a1a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#252525]"
      >
        <svg viewBox="0 0 24 24" className="size-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
        Share on X
        <ExternalLink className="size-3 opacity-50" />
      </button>
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export function PnlShareModal(props: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const shareText =
    props.type === "position"
      ? `${props.data.pnl >= 0 ? "🟢" : "🔴"} ${props.data.side} ${props.data.coin} ${props.hideBalances ? "••••" : `${props.data.pnl >= 0 ? "+" : ""}${formatUsd(props.data.pnl)} (${formatPct(props.data.pnlPct)})`}`
      : `💼 Portfolio: ${props.hideBalances ? "••••" : `${props.data.totalRealizedPnl >= 0 ? "+" : ""}${formatUsd(props.data.totalRealizedPnl)} realized PnL`} on Blink`;

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <AnimatePresence>
        {props.open && (
          <DialogContent
            forceMount
            className="border-none bg-transparent p-0 shadow-none sm:max-w-[680px]"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden rounded-[24px] border border-[#7ea9ff28] bg-[#070d18e6] shadow-[0_35px_110px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <div>
                  <DialogTitle className="text-base font-semibold text-white">
                    {props.type === "position"
                      ? `Share ${props.data.coin} PnL`
                      : "Share Portfolio"}
                  </DialogTitle>
                  <p className="mt-0.5 text-xs text-foreground/40">
                    Save or share your card
                  </p>
                </div>
                <button
                  type="button"
                  onClick={props.onClose}
                  className="rounded-full p-1.5 text-foreground/40 transition hover:bg-white/[0.07] hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Card preview */}
              <div className="flex justify-center bg-[#030609] px-6 py-8">
                <div
                  ref={cardRef}
                  className="overflow-hidden rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
                  style={{ display: "inline-block" }}
                >
                  {props.type === "position" ? (
                    <PositionCard
                      data={props.data}
                      hideBalances={props.hideBalances === true}
                    />
                  ) : (
                    <PortfolioCard
                      data={props.data}
                      hideBalances={props.hideBalances === true}
                    />
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-white/[0.06] px-6 py-4">
                <ShareActions cardRef={cardRef} shareText={shareText} />
              </div>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
