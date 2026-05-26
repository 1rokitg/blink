import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

import { cn } from "@acme/ui";
import { ThemeProvider } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";

import "~/app/globals.css";

import { env } from "~/env";
import { ContextProviders } from "~/lib/providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://blink.lat"),
  title: "Blink — Hyperliquid Terminal",
  description:
    "All-in-one Hyperliquid terminal for serious traders. Live order book, real execution, routed through Blink.",
  openGraph: {
    type: "website",
    title: "Blink — Hyperliquid Terminal",
    description: "All-in-one Hyperliquid terminal for serious traders.",
    url: "https://blink.lat",
    siteName: "Blink",
  },
  twitter: {
    card: "summary_large_image",
    site: "@rokitdotgg",
    creator: "@rokitdotgg",
    title: "Blink — Hyperliquid Terminal",
    description: "All-in-one Hyperliquid terminal for serious traders.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

const openrunde = localFont({
  src: [
    {
      path: "./font/OpenRunde-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./font/OpenRunde-Medium.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "./font/OpenRunde-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./font/OpenRunde-Bold.woff2",
      weight: "700",
      style: "italic",
    },
  ],
});

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          name="talentapp:project_verification"
          content="284aeb61d4b8b44a96d9bd3aea9761704afc3fd5baa4cdc361ec481cc468b8157f43b830aa96dff7f74c22376474b01b351620a65aabe738e5f347de1b030c40"
        />
        <script src="/wallet-error-guard.js" />
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          "min-h-screen bg-background text-foreground antialiased",
          openrunde.className,
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
          <ContextProviders>{props.children}</ContextProviders>
          <Toaster position="top-center" />
        </ThemeProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
