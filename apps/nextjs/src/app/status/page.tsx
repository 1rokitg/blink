import { SystemStatusPage } from "~/components/blink/system-status-page";

export const metadata = {
  title: "Blink Status",
  description:
    "Live health for Blink APIs, Neon, and Hyperliquid connectivity.",
};

export default function StatusPage() {
  return <SystemStatusPage />;
}
