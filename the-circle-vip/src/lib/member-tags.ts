/**
 * Stripe metadata tags for members (same pattern as Whop `metadata.tag`).
 * Claim-link / early-access pricing uses {@link EARLY_CUSTOMER_DISCOUNT_TAG}.
 */

export const EARLY_CUSTOMER_DISCOUNT_TAG = "Early customer discount";

/** Canonical Stripe metadata key for discount-class tags (keeps Whop `tag`). */
export const DISCOUNT_TAG_KEY = "discount_tag";

const META_TAG_KEYS = ["tag", "discount_tag", "discount_label", "claim_label"] as const;

function pushUnique(tags: string[], raw: string | null | undefined) {
  if (!raw) return;
  for (const part of raw.split(/[,|]/)) {
    const value = part.trim();
    if (!value) continue;
    if (tags.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      continue;
    }
    tags.push(value);
  }
}

function readMetaTags(
  metadata: Record<string, string> | null | undefined,
  tags: string[],
) {
  if (!metadata) return;
  for (const key of META_TAG_KEYS) {
    pushUnique(tags, metadata[key]);
  }
  if (metadata.discount === "early_customer") {
    pushUnique(tags, EARLY_CUSTOMER_DISCOUNT_TAG);
  }
}

/**
 * Collect display tags from Stripe subscription + customer metadata.
 * Also derives Early customer discount / Whop when source or claim ids imply it.
 */
export function collectStripeMemberTags(input: {
  subscriptionMetadata?: Record<string, string> | null;
  customerMetadata?: Record<string, string> | null;
  subscriptionDescription?: string | null;
  source?: string | null;
}): string[] {
  const tags: string[] = [];
  const sub = input.subscriptionMetadata ?? undefined;
  const cust = input.customerMetadata ?? undefined;

  readMetaTags(sub, tags);
  readMetaTags(cust, tags);

  const description = input.subscriptionDescription?.trim();
  if (description && description.length <= 48) {
    pushUnique(tags, description);
  }

  const source = (
    input.source ||
    sub?.source ||
    cust?.source ||
    ""
  ).trim().toLowerCase();

  const isClaim =
    source === "claim_link" ||
    Boolean(sub?.claimId?.trim()) ||
    sub?.discount === "early_customer" ||
    cust?.discount === "early_customer";

  if (isClaim) {
    pushUnique(tags, EARLY_CUSTOMER_DISCOUNT_TAG);
  }

  if (
    source.includes("whop") ||
    cust?.tag === "Whop" ||
    sub?.tag === "Whop"
  ) {
    pushUnique(tags, "Whop");
  }

  if (
    source === "crypto" ||
    cust?.preferredPaymentMethod === "crypto" ||
    sub?.preferredPaymentMethod === "crypto" ||
    cust?.paymentRail === "crypto_usdc" ||
    sub?.paymentRail === "crypto_usdc"
  ) {
    pushUnique(tags, "Crypto");
  }

  return tags;
}

/** Metadata patch written onto claim-link checkouts / subscriptions. */
export function claimDiscountStripeMetadata(input?: {
  label?: string | null;
  note?: string | null;
}): Record<string, string> {
  const label = input?.label?.trim().slice(0, 120) || null;
  const note = input?.note?.trim().slice(0, 200) || null;
  return {
    tag: EARLY_CUSTOMER_DISCOUNT_TAG,
    discount: "early_customer",
    [DISCOUNT_TAG_KEY]: EARLY_CUSTOMER_DISCOUNT_TAG,
    ...(label ? { claim_label: label, discount_label: label } : {}),
    ...(note ? { note } : {}),
  };
}

export function memberTagTone(tag: string): string {
  const key = tag.trim().toLowerCase();
  if (key === "early customer discount" || key.includes("early")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (key === "whop") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-200";
  }
  if (key === "crypto") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  }
  if (key.includes("claim") || key.includes("access")) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }
  return "border-[#3f3f46] bg-[#18181b] text-[#d4d4d8]";
}
