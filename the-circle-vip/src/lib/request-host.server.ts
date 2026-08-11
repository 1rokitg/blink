import "server-only";

import { headers } from "next/headers";

/** True when middleware stamped the ops / internal surface. */
export async function isInternalRequest() {
  const h = await headers();
  if (h.get("x-circle-internal") === "1") return true;
  const host = (h.get("host") || "").toLowerCase();
  return host.startsWith("internal.");
}
