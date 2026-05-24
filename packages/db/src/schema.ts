import { relations, sql } from "drizzle-orm";
import { pgTable, primaryKey } from "drizzle-orm/pg-core";
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
