import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pro · Blink",
  description:
    "Blink Pro — advanced trading tools, custom layouts, and priority execution on Hyperliquid.",
  openGraph: {
    title: "Blink Pro",
    description:
      "Advanced trading tools and custom layouts for serious Hyperliquid traders.",
    url: "https://blink.lat/pro",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blink Pro",
    description:
      "Advanced trading tools and custom layouts for serious Hyperliquid traders.",
  },
};

export default function ProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
