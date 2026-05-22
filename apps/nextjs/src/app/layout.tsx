import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { cn } from "@acme/ui";
import { ThemeProvider } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";

import "~/app/globals.css";

import { env } from "~/env";
import { ContextProviders } from "~/lib/providers";

export const metadata: Metadata = {
  metadataBase: new URL(
    env.VERCEL_ENV === "production"
      ? "https://blink.lat"
      : "http://localhost:3000",
  ),
  title: "Blink — Hyperliquid Terminal",
  description: "All-in-one Hyperliquid terminal for serious traders. Live order book, real execution, routed through Blink.",
  openGraph: {
    title: "Blink — Hyperliquid Terminal",
    description: "All-in-one Hyperliquid terminal for serious traders.",
    url: "https://blink.lat",
    siteName: "Blink",
  },
  twitter: {
    card: "summary_large_image",
    site: "@rokitdotgg",
    creator: "@rokitdotgg",
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
      {/*
        Suppress the "Cannot redefine property: ethereum" TypeError thrown when
        multiple wallet browser extensions (MetaMask, Coinbase, Rabby, etc.)
        all attempt to claim window.ethereum at the same time. This is a
        browser-extension conflict — not a Blink bug — and the error is harmless.
      */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (e.message && e.message.includes('Cannot redefine property: ethereum')) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                }
              }, true);
            `,
          }}
        />
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
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
