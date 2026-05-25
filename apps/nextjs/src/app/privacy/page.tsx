import type { Metadata } from "next";

import { LegalPageShell } from "~/components/blink/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Blink",
  description:
    "How Blink collects, uses, and protects wallet, profile, analytics, and payment-related data.",
};

const sections = [
  {
    title: "What Blink collects",
    paragraphs: [
      "Blink is a self-serve trading product built around wallet-based identity. Depending on how you use the app, we may process wallet addresses, public profile data, referral codes, follow relationships, trading-related analytics, and optional social connections such as verified X ownership.",
      "If you purchase Blink Pro, payment and billing information is processed through third-party providers such as Stripe. Blink does not intentionally store full card numbers in the application database.",
    ],
  },
  {
    title: "How Blink uses data",
    paragraphs: [
      "We use data to operate the product, secure accounts, prevent abuse, personalize public profiles, power referrals and analytics, and improve product quality over time.",
    ],
    bullets: [
      "show public Blink profiles and verification state",
      "measure funnel events, feature usage, and growth performance",
      "support builder-fee routing, approvals, and membership entitlements",
      "detect suspicious activity, spam, or bot traffic",
    ],
  },
  {
    title: "Third-party services",
    paragraphs: [
      "Blink relies on third-party services to deliver core functionality. These may include Hyperliquid for trading infrastructure, Privy for authentication and wallet flows, X for verification, Stripe for billing, Vercel for hosting, and Discord for community or operational notifications.",
      "Those providers may process data according to their own privacy terms. Your use of Blink may therefore also involve those third-party policies.",
    ],
  },
  {
    title: "Cookies, local storage, and analytics",
    paragraphs: [
      "Blink may use cookies, local storage, and similar browser-side storage to preserve session context, attribution data, onboarding state, and product preferences. We also store internal analytics events to understand product usage and improve the experience.",
      "These analytics are intended for product and operational insight, not for selling personal data to external advertisers.",
    ],
  },
  {
    title: "Public profile surfaces",
    paragraphs: [
      "Blink is designed around shareable trading identity. Information that you choose to make public, or that is inherently public on connected systems, may appear on your Blink profile and related product surfaces.",
      "If you verify an X account or create a public profile slug, that information may be visible to other users and may be used in product-generated social or community surfaces.",
    ],
  },
  {
    title: "Data retention and requests",
    paragraphs: [
      "We retain data for as long as needed to operate Blink, comply with legal obligations, resolve disputes, and protect the product from abuse. Some onchain or third-party data cannot be deleted by Blink because it does not live solely in Blink-controlled systems.",
      "For questions about privacy or account-related concerns, contact the Blink team through the official Discord linked in the app footer.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description="This Privacy Policy explains how Blink handles product, profile, analytics, and payment-related information when you use the Blink trading experience."
      updatedAt="May 25, 2026"
      sections={sections}
    />
  );
}
