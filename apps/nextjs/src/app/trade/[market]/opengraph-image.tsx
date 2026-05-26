import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Trade on Blink";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage(props: {
  params: Promise<{ market: string }>;
}) {
  const { market } = await props.params;
  const coin = decodeURIComponent(market).toUpperCase();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background:
          "radial-gradient(circle at 8% 10%, rgba(60,100,255,0.35) 0%, transparent 40%), linear-gradient(180deg, #060c1e 0%, #08101f 100%)",
        color: "#f2f4f7",
        fontFamily: "sans-serif",
        position: "relative",
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
          Trade {coin} on Hyperliquid
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
          Zero extra fees · Up to 50× leverage
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
                background:
                  coin === "BTC"
                    ? "#f29f27"
                    : coin === "ETH"
                      ? "#627eea"
                      : coin === "SOL"
                        ? "#9945ff"
                        : "#2c6bff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {coin[0]}
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: "#fff",
                display: "flex",
              }}
            >
              {coin}-PERP
            </div>
            <div
              style={{
                marginLeft: "auto",
                padding: "6px 14px",
                borderRadius: 8,
                background: "#0f2250",
                border: "1px solid #2a4a9e",
                fontSize: 18,
                color: "#6ba3ff",
                display: "flex",
              }}
            >
              Perpetual
            </div>
          </div>

          {/* Body */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: 16,
              padding: "32px 28px",
            }}
          >
            <div
              style={{
                fontSize: 26,
                color: "#6677aa",
                display: "flex",
                textAlign: "center",
              }}
            >
              Trade {coin} perpetuals with zero maker fees
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
              }}
            >
              {[
                "Zero Extra Fees",
                "50× Leverage",
                "Self-Custody",
                "Instant Fills",
              ].map((feat) => (
                <div
                  key={feat}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    background: "#0c1632",
                    border: "1px solid #1e3a80",
                    fontSize: 18,
                    color: "#6ba3ff",
                    display: "flex",
                  }}
                >
                  {feat}
                </div>
              ))}
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
            <span>blink.lat/trade/{coin}</span>
            <span>Powered by Hyperliquid</span>
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
        <span>Trade {coin} Perps</span>
        <span>Trade. Track. Win.</span>
      </div>
    </div>,
    size,
  );
}
