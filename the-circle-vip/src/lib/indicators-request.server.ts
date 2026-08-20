import "server-only";

import { headers } from "next/headers";

import { isIndicatorsHost } from "@/lib/indicators-site";

/** True when middleware stamped the Indicators storefront surface. */
export async function isIndicatorsRequest() {
  const h = await headers();
  if (h.get("x-indicators-site") === "1") return true;
  const host = (h.get("host") || "").toLowerCase();
  return isIndicatorsHost(host);
}
