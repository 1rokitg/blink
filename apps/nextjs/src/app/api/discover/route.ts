import { NextResponse } from "next/server";
import { env } from "~/env";

const API_URL = "https://api.fomoscan.sh/v2/leaderboard/traders";

// FomoScan's payload isn't guaranteed to match the client's shape 1:1 —
// this is the one place that contract gets enforced, so the UI never has
// to know or care what the upstream field names are called.
type UpstreamTrader = Record<string, unknown>;

export type NormalizedTrader = {
  rank: number;
  id: string;
  handle: string | null;
  label: string | null;
  avatarUrl: string | null;
  pnl: number | null;
  pnlPercent: number | null;
  volume: number | null;
  followers: number | null;
  numTrades: number | null;
};

function pick<T = unknown>(obj: UpstreamTrader, keys: string[]): T | null {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key] as T;
  }
  return null;
}

function normalizeTrader(raw: UpstreamTrader, index: number): NormalizedTrader {
  return {
    rank: (pick<number>(raw, ["rank"]) ?? index + 1),
    id: String(pick<string>(raw, ["id", "trader_id", "traderId"]) ?? `trader_${index}`),
    handle: pick<string>(raw, ["handle", "username"]),
    label: pick<string>(raw, ["name", "label", "display_name", "displayName"]),
    avatarUrl: pick<string>(raw, ["avatar", "avatarUrl", "avatar_url", "profile_picture", "profilePicture"]),
    pnl: pick<number>(raw, ["pnl_24h", "pnl24h", "pnl"]),
    pnlPercent: pick<number>(raw, ["pnl_24h_percent", "pnl24hPercent", "pnl_percent"]),
    volume: pick<number>(raw, ["volume_24h", "volume"]),
    followers: pick<number>(raw, ["followers", "follower_count", "followerCount"]),
    numTrades: pick<number>(raw, ["trades_24h", "num_trades", "numTrades"]),
  };
}

function mockPayload() {
    const mocked: UpstreamTrader[] = [
      {
        id: "mocked_trader_1",
        rank: 1,
        name: "DumbCrayonE...",
        handle: "DumbCrayonEa...",
        avatar: "https://i.pravatar.cc/150?img=12",
        pnl_24h: 3_485_121.06,
        pnl_24h_percent: null,
        followers: 49,
      },
      {
        id: "mocked_trader_2",
        rank: 2,
        name: "change",
        handle: "change",
        avatar: "https://i.pravatar.cc/150?img=33",
        pnl_24h: 2_797_273.73,
        pnl_24h_percent: null,
        followers: 12,
      },
      {
        id: "mocked_trader_3",
        rank: 3,
        name: "PoorGoat 🐐...",
        handle: "PoorGoat_",
        avatar: "https://i.pravatar.cc/150?img=48",
        pnl_24h: 2_783_394.86,
        pnl_24h_percent: null,
        followers: 130,
      },
      {
        id: "mocked_trader_4",
        rank: 4,
        name: "Unipcs",
        handle: "unipcs",
        avatar: "https://prod-fomo-profile-pics.s3.amazonaws.com/685a72bf4e0ab7095593e7618caa5c8e.jpg?k=240SnZX3zoi9HYPWIbCN3C_SA",
        pnl_24h: 2_229_059.47,
        pnl_24h_percent: null,
        followers: 38,
      },
      {
        id: "mocked_trader_5",
        rank: 5,
        name: "Salem",
        handle: "Salem1299534",
        avatar: "https://i.pravatar.cc/150?img=11",
        pnl_24h: 2_118_628.36,
        pnl_24h_percent: null,
        followers: 11,
      },
      {
        id: "mocked_trader_6",
        rank: 6,
        name: "frank",
        handle: "frankdegods",
        avatar: "https://i.pravatar.cc/150?img=57",
        pnl_24h: 2_040_974.88,
        pnl_24h_percent: null,
        followers: 67,
      },
      {
        id: "mocked_trader_7",
        rank: 7,
        name: "Ethermonk ...",
        handle: "ether_monk",
        avatar: "https://i.pravatar.cc/150?img=68",
        pnl_24h: 1_930_972.47,
        pnl_24h_percent: null,
        followers: 72,
      },
    ];
  
    return {
      data: mocked.map(normalizeTrader),
      meta: {
        mock: true,
        description: "Mocked leaderboard data based on the provided reference image.",
      },
    };
  }

export async function GET() {
  const key = env.FOMOSCAN_API_KEY;

  if (!key) {
    return NextResponse.json(mockPayload(), { status: 200 });
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}?window=24h`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 30 },
    });
  } catch {
    return NextResponse.json({ error: "FomoScan request failed" }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "FomoScan request failed", status: response.status },
      { status: response.status }
    );
  }

  const json = await response.json();
  const rawList: UpstreamTrader[] = Array.isArray(json) ? json : (json.data ?? []);

  // Profile metadata (bio + canonical X) is fetched lazily by the client
  // through /api/traders/[id] so the feed doesn't spend 2,500 CU per
  // trader on every page load.
  return NextResponse.json(
    {
      data: rawList.map(normalizeTrader),
      meta: json.meta ?? null,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}