import { NextResponse } from "next/server";

const API_URL = "https://api.fomoscan.sh/v2/leaderboard/traders";

export async function GET() {
  const key = process.env.FOMOSCAN_API_KEY;

  if (!key) {
    // Return mocked data if FOMOSCAN_API_KEY is missing
    const mockedData = {
      data: [
        {
          id: "mocked_trader_1",
          name: "Mocked Trader1",
          handle: "mocktrader1",
          avatar: "https://placekitten.com/100/100",
          pnl_24h: 1234.56,
          pnl_24h_percent: 15.2,
        },
        {
          id: "mocked_trader_2",
          name: "Mocked Trader2",
          handle: "mocktrader2",
          avatar: "https://placekitten.com/101/101",
          pnl_24h: 789.01,
          pnl_24h_percent: 9.8,
        }
      ],
      meta: {
        mock: true,
        description: "This is mocked data because FOMOSCAN_API_KEY is missing."
      }
    };
    return NextResponse.json(mockedData, { status: 200 });
  }

  const response = await fetch(`${API_URL}?window=24h`, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
    next: { revalidate: 30 },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "FomoScan request failed", status: response.status },
      { status: response.status }
    );
  }

  const data = await response.json();

  // The leaderboard gives us the 24h PnL + avatar/name/handle.
  // Profile metadata (bio + canonical X) is fetched lazily by the client
  // through /api/traders/[id] so the feed does not spend 2,500 CU for every
  // trader on every page load.
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}