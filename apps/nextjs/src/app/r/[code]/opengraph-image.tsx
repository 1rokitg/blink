import { ImageResponse } from "next/og";

import { eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { ReferralCode } from "@acme/db/schema";

export const runtime = "nodejs";
export const alt = "Join me on Blink — trade perps with zero fees";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const slug = decodeURIComponent(code).toLowerCase();

  // Check code exists
  const codeRow = await db
    .select()
    .from(ReferralCode)
    .where(eq(ReferralCode.code, slug))
    .limit(1);

  const handle = codeRow[0] ? slug : "someone";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#060510",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background radial glows */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(44,107,255,0.25), transparent 65%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 50% 40% at 90% 90%, rgba(59,225,186,0.12), transparent 60%)",
          }}
        />

        {/* Grid lines subtle overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            zIndex: 10,
            padding: "0 80px",
            textAlign: "center",
          }}
        >
          {/* Wordmark */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.04em",
              marginBottom: 36,
            }}
          >
            blink
          </div>

          {/* Invited by badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              backgroundColor: "rgba(44,107,255,0.15)",
              border: "1px solid rgba(44,107,255,0.35)",
              borderRadius: 999,
              padding: "8px 20px",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "#6fa8ff",
              }}
            />
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#6fa8ff",
                letterSpacing: "0.02em",
              }}
            >
              {handle} invited you
            </span>
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.04em",
              color: "#ffffff",
              marginBottom: 20,
            }}
          >
            Trade perps.{" "}
            <span style={{ color: "#6fa8ff" }}>Zero fees.</span>
          </div>

          {/* Subline */}
          <div
            style={{
              fontSize: 24,
              fontWeight: 400,
              color: "rgba(255,255,255,0.45)",
              maxWidth: 680,
              lineHeight: 1.5,
              marginBottom: 44,
            }}
          >
            The fastest social trading terminal on Hyperliquid.
            Up to 50× leverage, instant fills, self-custody.
          </div>

          {/* CTA pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              backgroundColor: "#2c6bff",
              borderRadius: 16,
              padding: "14px 36px",
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.01em",
              }}
            >
              blink.lat/r/{handle}
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
