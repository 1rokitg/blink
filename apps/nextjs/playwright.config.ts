import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3111",
    trace: "on-first-retry",
  },
  webServer: {
    command: "NEXT_PUBLIC_E2E_MODE=1 pnpm with-env next dev --port 3111",
    url: "http://127.0.0.1:3111",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
