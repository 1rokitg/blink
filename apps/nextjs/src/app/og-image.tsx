import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "radial-gradient(circle at 16% 18%, rgba(58,102,255,0.44), transparent 44%), radial-gradient(circle at 78% 14%, rgba(39,198,181,0.36), transparent 42%), linear-gradient(180deg, #040a1d 0%, #060f26 100%)",
          color: "#f2f4f7",
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.04em" }}>
          blink
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.04em" }}>
            DO NOT BLINK!
          </div>
          <div style={{ fontSize: 34, opacity: 0.92 }}>
            Hyperliquid terminal for serious traders.
          </div>
          <div style={{ fontSize: 24, opacity: 0.74 }}>
            Live order book • One-click execution • Builder-routed flow
          </div>
        </div>
      </div>
    ),
    size,
  );
}
