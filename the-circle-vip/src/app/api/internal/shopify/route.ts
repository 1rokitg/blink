import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";
import { getShopifyStoreSnapshot } from "@/lib/shopify.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const session = readInternalSession(
    jar.get(INTERNAL_SESSION_COOKIE)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getShopifyStoreSnapshot();
  return NextResponse.json(snapshot);
}
