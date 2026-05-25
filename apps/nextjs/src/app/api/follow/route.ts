import { NextResponse } from "next/server";

import { checkBotId } from "botid/server";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@acme/db/client";
import { Follow } from "@acme/db/schema";

export const runtime = "nodejs";

const bodySchema = z.object({
  followerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  followingAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

/** GET /api/follow?address=0x... — returns follower/following counts + viewer follow state */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();
  const viewer = searchParams.get("viewer")?.toLowerCase();

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const [followersResult, followingResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(Follow)
      .where(eq(Follow.followingAddress, address)),
    db
      .select({ count: count() })
      .from(Follow)
      .where(eq(Follow.followerAddress, address)),
  ]);

  let isFollowing = false;
  if (viewer && viewer !== address) {
    const existing = await db
      .select({ id: Follow.id })
      .from(Follow)
      .where(
        and(
          eq(Follow.followerAddress, viewer),
          eq(Follow.followingAddress, address),
        ),
      )
      .limit(1);
    isFollowing = existing.length > 0;
  }

  return NextResponse.json({
    followers: followersResult[0]?.count ?? 0,
    following: followingResult[0]?.count ?? 0,
    isFollowing,
  });
}

/** POST /api/follow — toggle follow state */
export async function POST(request: Request) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { followerAddress, followingAddress } = parsed.data;
  const follower = followerAddress.toLowerCase();
  const following = followingAddress.toLowerCase();

  if (follower === following) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const existing = await db
    .select({ id: Follow.id })
    .from(Follow)
    .where(
      and(
        eq(Follow.followerAddress, follower),
        eq(Follow.followingAddress, following),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    // Unfollow
    await db
      .delete(Follow)
      .where(
        and(
          eq(Follow.followerAddress, follower),
          eq(Follow.followingAddress, following),
        ),
      );
    return NextResponse.json({ action: "unfollowed" });
  }

  // Follow
  await db.insert(Follow).values({ followerAddress: follower, followingAddress: following });
  return NextResponse.json({ action: "followed" });
}
