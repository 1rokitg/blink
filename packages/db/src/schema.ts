import { relations, sql } from "drizzle-orm";
import { jsonb, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const Post = pgTable("post", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(256),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const User = pgTable("user", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  name: t.varchar({ length: 255 }),
  email: t.varchar({ length: 255 }).notNull(),
  emailVerified: t.timestamp({ mode: "date", withTimezone: true }),
  image: t.varchar({ length: 255 }),
}));

export const UserRelations = relations(User, ({ many }) => ({
  accounts: many(Account),
}));

export const Account = pgTable(
  "account",
  (t) => ({
    userId: t
      .uuid()
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }),
    type: t
      .varchar({ length: 255 })
      .$type<"email" | "oauth" | "oidc" | "webauthn">()
      .notNull(),
    provider: t.varchar({ length: 255 }).notNull(),
    providerAccountId: t.varchar({ length: 255 }).notNull(),
    refresh_token: t.varchar({ length: 255 }),
    access_token: t.text(),
    expires_at: t.integer(),
    token_type: t.varchar({ length: 255 }),
    scope: t.varchar({ length: 255 }),
    id_token: t.text(),
    session_state: t.varchar({ length: 255 }),
  }),
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const AccountRelations = relations(Account, ({ one }) => ({
  user: one(User, { fields: [Account.userId], references: [User.id] }),
}));

export const Session = pgTable("session", (t) => ({
  sessionToken: t.varchar({ length: 255 }).notNull().primaryKey(),
  userId: t
    .uuid()
    .notNull()
    .references(() => User.id, { onDelete: "cascade" }),
  expires: t.timestamp({ mode: "date", withTimezone: true }).notNull(),
}));

export const SessionRelations = relations(Session, ({ one }) => ({
  user: one(User, { fields: [Session.userId], references: [User.id] }),
}));

/**
 * Tracks verified Twitter connections per wallet.
 * Written after a successful OAuth 2.0 PKCE flow.
 */
export const TwitterConnection = pgTable("twitter_connection", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  /** The user's EVM wallet address (lower-cased). One connection per wallet. */
  walletAddress: t.varchar({ length: 42 }).notNull().unique(),
  /** Twitter user ID (numeric string). */
  twitterId: t.varchar({ length: 64 }).notNull(),
  /** Twitter @username (without the @). */
  twitterUsername: t.varchar({ length: 64 }).notNull(),
  /** Twitter display name. */
  twitterName: t.varchar({ length: 255 }),
  connectedAt: t.timestamp().defaultNow().notNull(),
}));

/**
 * Tracks builder fee approvals per wallet.
 * Written after a successful approveBuilderFee tx so we can skip the
 * approval check on subsequent visits without hitting the chain.
 */
export const BuilderApproval = pgTable("builder_approval", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  /** The user's EVM wallet address (lower-cased). */
  walletAddress: t.varchar({ length: 42 }).notNull(),
  /** The builder address that was approved. */
  builderAddress: t.varchar({ length: 42 }).notNull(),
  /** Max fee rate approved, e.g. "0.01%". */
  maxFeeRate: t.varchar({ length: 16 }).notNull(),
  /** Hyperliquid response status from the approval tx. */
  status: t.varchar({ length: 32 }).notNull().default("approved"),
  approvedAt: t.timestamp().defaultNow().notNull(),
}));

export const CreateBuilderApprovalSchema = createInsertSchema(
  BuilderApproval,
).omit({
  id: true,
  approvedAt: true,
});

/**
 * Wallet-level Blink Pro membership entitlements.
 * Stripe webhooks should upsert this table so fee routing can apply instantly.
 */
export const BlinkMembership = pgTable("blink_membership", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  walletAddress: t.varchar({ length: 42 }).notNull().unique(),
  tier: t.varchar({ length: 32 }).notNull().default("basic"),
  status: t.varchar({ length: 32 }).notNull().default("active"),
  paymentMethod: t.varchar({ length: 32 }).notNull().default("card"),
  stripeCustomerId: t.varchar({ length: 128 }),
  stripeSubscriptionId: t.varchar({ length: 128 }),
  currentPeriodEnd: t.timestamp(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

/**
 * Social follow graph — who follows whom, keyed by wallet address.
 * Enables follower/following counts and "people you follow" feeds.
 */
export const Follow = pgTable(
  "follow",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    /** Wallet address of the user who is following. */
    followerAddress: t.varchar({ length: 42 }).notNull(),
    /** Wallet address of the trader being followed. */
    followingAddress: t.varchar({ length: 42 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
);

/**
 * User profile metadata stored in Neon.
 * Privy handles auth; this table stores social/display preferences.
 */
export const UserProfile = pgTable("user_profile", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  walletAddress: t.varchar({ length: 42 }).notNull().unique(),
  /** Display name (can differ from Privy Google name). */
  displayName: t.varchar({ length: 64 }),
  /** Short bio shown on the profile page. */
  bio: t.varchar({ length: 160 }),
  /** ENS name if resolved. */
  ensName: t.varchar({ length: 128 }),
  /** Whether the user has Blink Pro (mirrors blink_membership but faster to read). */
  isPro: t.boolean().notNull().default(false),
  /** Timestamp user first connected (first builder approval or login). */
  joinedAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

/**
 * Referral codes — one unique slug per wallet.
 * Defaults to ENS name or the first 8 chars of the wallet address.
 * Powers blink.lat/r/{code} links.
 */
export const ReferralCode = pgTable("referral_code", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  /** Wallet address of the referrer (lower-cased). */
  walletAddress: t.varchar({ length: 42 }).notNull().unique(),
  /** Unique URL-safe slug, e.g. "rokitg" or "0xabc123". */
  code: t.varchar({ length: 64 }).notNull().unique(),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

/**
 * Referral relationships — tracks who referred whom.
 * referredAddress is unique: a user can only be referred once.
 */
export const Referral = pgTable("referral", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  /** Wallet address of the person who sent the referral. */
  referrerAddress: t.varchar({ length: 42 }).notNull(),
  /** Wallet address of the person who joined via the referral. */
  referredAddress: t.varchar({ length: 42 }).notNull().unique(),
  /** The code that was used (for audit / leaderboard). */
  code: t.varchar({ length: 64 }).notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

/**
 * Internal product analytics events (server-side canonical stream).
 * This powers /internal KPIs and funnel metrics.
 */
export const MetricEvent = pgTable("metric_event", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  eventType: t.varchar({ length: 64 }).notNull(),
  walletAddress: t.varchar({ length: 42 }),
  source: t.varchar({ length: 64 }),
  metadata: jsonb(),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

/**
 * Daily rollups for builder analytics (HL volume + estimated builder revenue).
 * One row per UTC day.
 */
export const BuilderDailyMetric = pgTable("builder_daily_metric", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  day: t.date().notNull().unique(),
  activeUsers: t.integer().notNull().default(0),
  fillsCount: t.integer().notNull().default(0),
  volumeUsd: t.doublePrecision().notNull().default(0),
  feeUsd: t.doublePrecision().notNull().default(0),
  builderFeeUsd: t.doublePrecision().notNull().default(0),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

/**
 * Runtime feature flags managed from /internal.
 * Values here override .env defaults when read server-side.
 */
export const FeatureFlag = pgTable("feature_flag", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  key: t.varchar({ length: 64 }).notNull().unique(),
  enabled: t.boolean().notNull().default(false),
  description: t.varchar({ length: 255 }),
  updatedBy: t.varchar({ length: 42 }),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));
