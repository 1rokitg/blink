import { ImageResponse } from "next/og";

export const runtime = "nodejs";
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
          background:
            "radial-gradient(circle at 8% 10%, rgba(60,100,255,0.35) 0%, transparent 40%), linear-gradient(180deg, #060c1e 0%, #08101f 100%)",
          color: "#f2f4f7",
          fontFamily: "sans-serif",
        }}
      >
        {/* Grid lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(40,60,120,0.25) 0px, rgba(40,60,120,0.25) 1px, transparent 1px, transparent 60px)",
            display: "flex",
          }}
        />

        {/* Left brand block */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 0 0 72px",
            width: 490,
            gap: 0,
          }}
        >
          <div style={{ fontSize: 80, display: "flex", marginBottom: 8 }}>👀</div>
          <div
            style={{
              fontSize: 86,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "#ffffff",
              lineHeight: 1,
              marginBottom: 24,
              display: "flex",
            }}
          >
            blink.lat
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#8899cc",
              marginBottom: 16,
              display: "flex",
            }}
          >
            All-in-one Hyperliquid Terminal
          </div>
          <div
            style={{
              width: 280,
              height: 1,
              background: "#1e3070",
              marginBottom: 16,
              display: "flex",
            }}
          />
          <div style={{ fontSize: 26, color: "#4a5f99", display: "flex" }}>
            For serious traders.
          </div>
        </div>

        {/* Right card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            padding: "48px 56px 48px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              height: "100%",
              background: "#0a1228",
              border: "1px solid #1e3a80",
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "22px 28px",
                background: "#0c1632",
                borderBottom: "1px solid #1e3a80",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#f29f27",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                B
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#fff",
                  display: "flex",
                }}
              >
                BTC
              </div>
              <div
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "#0f2250",
                  border: "1px solid #2a4a9e",
                  fontSize: 18,
                  color: "#6ba3ff",
                  display: "flex",
                }}
              >
                LONG
              </div>
              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "#111b35",
                  border: "1px solid #253360",
                  fontSize: 18,
                  color: "#6677aa",
                  display: "flex",
                }}
              >
                20×
              </div>
            </div>

            {/* Entry → Mark */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "22px 28px 0",
                fontSize: 25,
                color: "#6677aa",
              }}
            >
              Entry $76,437&nbsp;&nbsp;→&nbsp;&nbsp;Mark $76,632
            </div>

            {/* PnL */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 112,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "#6baeff",
                  display: "flex",
                }}
              >
                +$5.72
              </div>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  color: "#4a88dd",
                  display: "flex",
                }}
              >
                +5.09%
              </div>
            </div>

            {/* Card footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "16px 28px",
                borderTop: "1px solid #1e3a80",
                fontSize: 20,
                color: "#3a5090",
              }}
            >
              <span>blink.lat</span>
              <span>Trade perps on Hyperliquid</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 48,
            background: "#040810",
            borderTop: "1px solid #1a2d60",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 72px",
            fontSize: 22,
            color: "#3a5090",
          }}
        >
          <span>blink.lat</span>
          <span>Powered by Hyperliquid</span>
          <span>Trade. Track. Win.</span>
        </div>
      </div>
    ),
    size,
  );
}
