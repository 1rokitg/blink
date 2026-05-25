import type { Metadata } from "next";

import { LegalPageShell } from "~/components/blink/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service | Blink",
  description:
    "The core terms governing use of Blink, including eligibility, third-party integrations, payments, and product disclaimers.",
};

const sections = [
  {
    title: "Acceptance of terms",
    paragraphs: [
      "By accessing or using Blink, you agree to these Terms of Service. If you do not agree, do not use the product.",
      "Blink may update these terms from time to time. Continued use of the product after updates means you accept the revised terms.",
    ],
  },
  {
    title: "Eligibility and access",
    paragraphs: [
      "You are responsible for ensuring that your use of Blink is lawful in your jurisdiction and consistent with any product restrictions presented in the app.",
      "Blink may limit, suspend, or terminate access where necessary for abuse prevention, compliance, operational safety, or product integrity.",
    ],
  },
  {
    title: "Third-party infrastructure",
    paragraphs: [
      "Blink relies on third-party services and networks, including Hyperliquid, wallet providers, authentication providers, payment processors, and social platforms. Blink does not control those services and is not responsible for outages, losses, policy changes, or failures caused by them.",
      "Trading, funding, custody, wallet security, and transaction approval remain your responsibility.",
    ],
  },
  {
    title: "Subscriptions and payments",
    paragraphs: [
      "Paid plans such as Blink Pro may renew automatically according to the billing cycle presented at checkout unless canceled. By starting a paid subscription, you authorize the applicable recurring charges.",
      "Pricing, plan features, and billing providers may change over time. Taxes, network fees, or other external charges may apply depending on your payment method and jurisdiction.",
    ],
  },
  {
    title: "No financial advice",
    paragraphs: [
      "Blink is software infrastructure and product tooling. Nothing in Blink constitutes investment, legal, tax, or financial advice.",
      "You are solely responsible for your trading decisions, risk management, and any losses that result from use of the product or related third-party systems.",
    ],
  },
  {
    title: "Product status and warranties",
    paragraphs: [
      "Blink may evolve quickly and may contain beta features, incomplete functionality, downtime, inaccurate data, or degraded integrations. The product is provided on an as-is and as-available basis to the maximum extent permitted by law.",
      "We do not guarantee uninterrupted access, perfect data accuracy, execution success, or compatibility with all wallets, devices, or jurisdictions.",
    ],
  },
  {
    title: "Public identity and user content",
    paragraphs: [
      "If you create a public profile, claim a referral code, connect social accounts, or otherwise publish identity signals through Blink, you are responsible for the information you choose to make public.",
      "You agree not to use Blink for unlawful conduct, impersonation, abuse, spam, security violations, or attempts to disrupt the platform.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "For questions about these terms, product access, or account-related concerns, contact the Blink team through the official Discord linked in the application footer.",
    ],
  },
];

export default function TosPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      description="These Terms of Service govern your access to Blink and set the baseline rules around eligibility, subscriptions, public profiles, and use of the trading product."
      updatedAt="May 25, 2026"
      sections={sections}
    />
  );
}
