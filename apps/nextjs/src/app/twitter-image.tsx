import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
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
            "radial-gradient(circle at 24% 12%, rgba(93,134,255,0.42), transparent 48%), radial-gradient(circle at 80% 18%, rgba(70,220,196,0.34), transparent 42%), linear-gradient(180deg, #040a1d 0%, #060f26 100%)",
          color: "#f2f4f7",
        }}
      >
        <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: "-0.04em" }}>
          blink 👀
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: "-0.04em" }}>
            Hyperliquid Terminal
          </div>
          <div style={{ fontSize: 32, opacity: 0.92 }}>
            All-in-one execution stack for perps traders.
          </div>
          <div style={{ fontSize: 24, opacity: 0.74 }}>
            Crypto moves can be missed in the blink of an eye.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
