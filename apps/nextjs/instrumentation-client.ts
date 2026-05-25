import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/api/referrals/claim", method: "POST" },
    { path: "/api/referrals/code", method: "POST" },
    { path: "/api/follow", method: "POST" },
    { path: "/api/metrics/event", method: "POST" },
    { path: "/api/stripe/checkout", method: "POST" },
  ],
});
