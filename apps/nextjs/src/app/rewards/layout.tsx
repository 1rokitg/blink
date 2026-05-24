import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rewards · Blink",
  description:
    "Earn rewards by inviting friends to Blink. Share your referral code and get fee rebates on every trade they make.",
  openGraph: {
    title: "Rewards · Blink",
    description:
      "Invite friends, earn fee rebates. The Blink referral program rewards you for growing the community.",
    url: "https://blink.lat/rewards",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rewards · Blink",
    description:
      "Invite friends, earn fee rebates. The Blink referral program rewards you for growing the community.",
  },
};

export default function RewardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
