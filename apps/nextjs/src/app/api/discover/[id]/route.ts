import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const key = process.env.FOMOSCAN_API_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "Missing FOMOSCAN_API_KEY" },
      { status: 500 }
    );
  }

  const response = await fetch(
    `https://api.fomoscan.sh/v2/user/id/${encodeURIComponent(id)}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      next: { revalidate: 300 },
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "FomoScan profile lookup failed", status: response.status },
      { status: response.status }
    );
  }

  return NextResponse.json(await response.json(), {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}