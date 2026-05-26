import { NextResponse } from "next/server";

import { getBlinkTokenProgress } from "~/lib/blink/clanker.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await getBlinkTokenProgress();

    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load token progress",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
