export type LeadTagId =
  | "whop"
  | "substack"
  | "propr"
  | "circle"
  | "waitlist"
  | "shopify";

export type LeadTag = {
  id: LeadTagId;
  label: string;
  /** How the match was made — email, telegram, username, or source. */
  via: "email" | "telegram" | "username" | "source" | "name";
};

export const LEAD_TAG_LABEL: Record<LeadTagId, string> = {
  whop: "Whop",
  substack: "Substack",
  propr: "Propr",
  circle: "Circle",
  waitlist: "Waitlist",
  shopify: "Shopify",
};

export function leadTagTone(id: LeadTagId) {
  switch (id) {
    case "whop":
      return "border-orange-500/30 bg-orange-500/10 text-orange-200";
    case "substack":
      return "border-amber-500/30 bg-amber-500/10 text-amber-100";
    case "propr":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "circle":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "waitlist":
      return "border-violet-500/30 bg-violet-500/10 text-violet-200";
    case "shopify":
      return "border-[#70a7ff]/30 bg-[#70a7ff]/10 text-[#9ec5ff]";
  }
}

export function normalizeLeadEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

export function normalizeLeadHandle(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/^@/, "").toLowerCase() ?? "";
  return trimmed || null;
}

/** Primary source → tag id when the lead already belongs to that dataset. */
export function primarySourceTag(
  source: string | null | undefined,
): LeadTagId | null {
  const s = (source || "").toLowerCase();
  if (s === "whop_member" || s === "whop_person" || s === "whop") return "whop";
  if (s === "substack") return "substack";
  if (s === "propr") return "propr";
  if (s === "waitlist") return "waitlist";
  if (s === "shopify" || s === "shopify_forms") return "shopify";
  if (
    s === "checkout" ||
    s === "crypto" ||
    s === "manual_grant" ||
    s === "stripe" ||
    s === "trialing"
  ) {
    return "circle";
  }
  return null;
}

export type CrossIndex = {
  whopEmails: Set<string>;
  whopHandles: Set<string>;
  substackEmails: Set<string>;
  proprHandles: Set<string>;
  circleEmails: Set<string>;
  circleHandles: Set<string>;
  waitlistEmails: Set<string>;
  shopifyEmails: Set<string>;
};

export function emptyCrossIndex(): CrossIndex {
  return {
    whopEmails: new Set(),
    whopHandles: new Set(),
    substackEmails: new Set(),
    proprHandles: new Set(),
    circleEmails: new Set(),
    circleHandles: new Set(),
    waitlistEmails: new Set(),
    shopifyEmails: new Set(),
  };
}

/**
 * Tag a lead against every dataset index.
 * Always includes the primary source tag; adds cross tags when the same
 * person appears elsewhere (email / telegram / username).
 */
export function tagsForLead(
  lead: {
    email?: string | null;
    telegramUsername?: string | null;
    name?: string | null;
    source?: string | null;
  },
  index: CrossIndex,
): LeadTag[] {
  const tags: LeadTag[] = [];
  const seen = new Set<LeadTagId>();

  const push = (id: LeadTagId, via: LeadTag["via"]) => {
    if (seen.has(id)) return;
    seen.add(id);
    tags.push({ id, label: LEAD_TAG_LABEL[id], via });
  };

  const primary = primarySourceTag(lead.source);
  if (primary) push(primary, "source");

  const email = normalizeLeadEmail(lead.email);
  const handle =
    normalizeLeadHandle(lead.telegramUsername) ||
    normalizeLeadHandle(lead.name);

  if (email && index.whopEmails.has(email)) push("whop", "email");
  if (handle && index.whopHandles.has(handle)) push("whop", "username");

  if (email && index.substackEmails.has(email)) push("substack", "email");

  if (handle && index.proprHandles.has(handle)) push("propr", "username");

  if (email && index.circleEmails.has(email)) push("circle", "email");
  if (handle && index.circleHandles.has(handle)) push("circle", "telegram");

  if (email && index.waitlistEmails.has(email)) push("waitlist", "email");

  if (email && index.shopifyEmails.has(email)) push("shopify", "email");

  return tags;
}

/** True when the lead appears in a dataset beyond its primary source. */
export function hasCrossMatch(tags: LeadTag[], source: string | null) {
  const primary = primarySourceTag(source);
  return tags.some((tag) => tag.id !== primary);
}
