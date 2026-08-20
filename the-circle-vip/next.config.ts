import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  serverExternalPackages: ["stripe"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // Enables Next.js coordination with the View Transitions API (App Router).
    viewTransition: true,
  },
  async rewrites() {
    // Shareable locale prefixes → real app routes (middleware sets the locale).
    return {
      beforeFiles: [
        { source: "/en", destination: "/" },
        { source: "/es", destination: "/" },
        { source: "/en/:path*", destination: "/:path*" },
        { source: "/es/:path*", destination: "/:path*" },
      ],
    };
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
