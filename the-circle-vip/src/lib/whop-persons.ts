/**
 * Whop CRM "persons" export (analytics people CSV).
 * Distinct from members.csv — includes storefront visitors + attributed users.
 */

export type WhopPersonRow = {
  personId: string;
  accountId: string;
  userId: string | null;
  username: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicUrl: string | null;
  memberId: string | null;
  memberStatus: "joined" | "left" | "drafted" | null;
  memberJoinedAt: string | null;
  memberUsdTotalSpend: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  eventCount: number;
  timezone: string | null;
  lastIp: string | null;
  purchaseCount: number;
  ltv: number;
  aov: number;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  firstSourceType: string | null;
  firstSourceDomain: string | null;
  firstSourcePlatform: string | null;
  lastSourceType: string | null;
  lastSourceDomain: string | null;
  lastSourcePlatform: string | null;
};

function cell(row: Record<string, string>, key: string) {
  return (row[key] ?? "").trim();
}

function num(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nullable(value: string) {
  return value || null;
}

function memberStatus(
  value: string,
): WhopPersonRow["memberStatus"] {
  if (value === "joined" || value === "left" || value === "drafted") {
    return value;
  }
  return null;
}

/** Parse a Whop persons CSV (DictReader-shaped rows). */
export function parseWhopPersonRows(
  rows: Record<string, string>[],
): WhopPersonRow[] {
  return rows
    .map((row) => {
      const personId = cell(row, "id");
      if (!personId) return null;
      return {
        personId,
        accountId: cell(row, "account_id"),
        userId: nullable(cell(row, "user.id")),
        username: nullable(cell(row, "user.username")),
        name: nullable(cell(row, "name") || cell(row, "user.name")),
        email: nullable(cell(row, "email").toLowerCase()),
        phone: nullable(cell(row, "phone")),
        profilePicUrl: nullable(cell(row, "user.profile_pic_url")),
        memberId: nullable(cell(row, "member.id")),
        memberStatus: memberStatus(cell(row, "member.status")),
        memberJoinedAt: nullable(cell(row, "member.joined_at")),
        memberUsdTotalSpend: num(cell(row, "member.usd_total_spend")),
        firstSeenAt: nullable(cell(row, "first_seen_at")),
        lastSeenAt: nullable(cell(row, "last_seen_at")),
        eventCount: Math.round(num(cell(row, "event_count"))),
        timezone: nullable(cell(row, "timezone")),
        lastIp: nullable(cell(row, "last_ip")),
        purchaseCount: Math.round(num(cell(row, "purchase_count"))),
        ltv: num(cell(row, "ltv")),
        aov: num(cell(row, "aov")),
        firstPurchaseAt: nullable(cell(row, "first_purchase_at")),
        lastPurchaseAt: nullable(cell(row, "last_purchase_at")),
        country: nullable(cell(row, "location.country")),
        city: nullable(cell(row, "location.city")),
        browser: nullable(cell(row, "device.browser")),
        os: nullable(cell(row, "device.os")),
        device: nullable(cell(row, "device.device")),
        firstSourceType: nullable(cell(row, "first_source.type")),
        firstSourceDomain: nullable(cell(row, "first_source.domain")),
        firstSourcePlatform: nullable(cell(row, "first_source.platform")),
        lastSourceType: nullable(cell(row, "last_source.type")),
        lastSourceDomain: nullable(cell(row, "last_source.domain")),
        lastSourcePlatform: nullable(cell(row, "last_source.platform")),
      } satisfies WhopPersonRow;
    })
    .filter((row): row is WhopPersonRow => Boolean(row));
}

/** Identified Whop accounts only — skip anonymous storefront hits. */
export function identifiedWhopPersons(rows: WhopPersonRow[]) {
  return rows.filter((row) => Boolean(row.userId));
}

export function whopPersonLeadId(userId: string) {
  const key = userId.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 48);
  return `ld_whop_user_${key}`.slice(0, 80);
}

export function formatWhopPersonNote(row: WhopPersonRow) {
  const source =
    row.firstSourceDomain ||
    row.firstSourcePlatform ||
    row.firstSourceType ||
    null;
  const parts = [
    `Whop person ${row.personId}`,
    row.userId ? `user ${row.userId}` : null,
    row.memberId
      ? `member ${row.memberId}${row.memberStatus ? ` (${row.memberStatus})` : ""}`
      : null,
    row.username ? `@${row.username}` : null,
    row.country || row.city
      ? [row.city, row.country].filter(Boolean).join(", ")
      : null,
    row.timezone ? `tz ${row.timezone}` : null,
    row.ltv > 0 ? `LTV $${row.ltv.toFixed(2)}` : null,
    row.purchaseCount > 0 ? `${row.purchaseCount} purchases` : null,
    source ? `src ${source}` : null,
    row.profilePicUrl ? `pfp ${row.profilePicUrl}` : null,
  ].filter(Boolean);
  return parts.join(" · ").slice(0, 400);
}

export function whopPersonAvatarSeed(row: WhopPersonRow) {
  return (
    row.username ||
    row.email ||
    row.userId ||
    row.personId
  ).slice(0, 64);
}
