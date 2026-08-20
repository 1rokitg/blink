import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Defaults keep bundle lean: routePreloadingBehavior "none", useWorkerdCondition true.
// Incremental cache / R2 overrides add bindings — see opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({
  routePreloadingBehavior: "none",
});
