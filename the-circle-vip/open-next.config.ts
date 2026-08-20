import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Lean defaults — see https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({
  routePreloadingBehavior: "none",
});
