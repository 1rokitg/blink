import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";

import { AttributionCapture } from "@/components/attribution-capture";
import { I18nProvider } from "@/components/i18n-provider";
import { PageviewBeacon } from "@/components/pageview-beacon";
import { getRequestDictionary } from "@/lib/i18n/server";
import { isIndicatorsRequest } from "@/lib/indicators-request.server";
import { INDICATORS_SITE } from "@/lib/indicators-site";
import { isInternalRequest } from "@/lib/request-host.server";

import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  if (await isInternalRequest()) {
    return {
      title: "Sign in",
      description: undefined,
      robots: { index: false, follow: false },
      icons: {
        icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      },
    };
  }

  if (await isIndicatorsRequest()) {
    return {
      title: `${INDICATORS_SITE.name} · ${INDICATORS_SITE.tagline}`,
      description:
        "One-time pack: indicators .zip, setup video, and customized aggr.trade templates RokitG uses daily. Built around Aggregated OrderBook Depth.",
      icons: {
        icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
        apple: [{ url: "/logo.svg" }],
      },
    };
  }

  const { locale, dictionary } = await getRequestDictionary();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://rokitg.com";

  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
    alternates: {
      languages: {
        en: `${appUrl}/en`,
        es: `${appUrl}/es`,
        "x-default": `${appUrl}/en`,
      },
    },
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/logo.svg" }],
    },
    other: {
      "content-language": locale,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (await isInternalRequest()) {
    return (
      <html lang="en">
        <body className={`${outfit.variable} ${syne.variable} antialiased`}>
          {children}
        </body>
      </html>
    );
  }

  if (await isIndicatorsRequest()) {
    return (
      <html lang="en">
        <body
          className={`${outfit.variable} ${syne.variable} indicators-site antialiased`}
        >
          <PageviewBeacon />
          {children}
        </body>
      </html>
    );
  }

  const { locale, dictionary } = await getRequestDictionary();

  return (
    <html lang={locale}>
      <body className={`${outfit.variable} ${syne.variable} antialiased`}>
        <I18nProvider locale={locale} dictionary={dictionary}>
          <AttributionCapture />
          <PageviewBeacon />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
