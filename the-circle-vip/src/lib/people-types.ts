/**
 * CRM overlay for People — members (Stripe) and unpaid site visitors.
 * Billing remains on Stripe; this stores operator-enriched profiling fields.
 */
export type PersonKind = "member" | "visitor";

export type PersonEnrichment = {
  id: string;
  kind: PersonKind;
  /** Stripe subscription id or customer id for members. */
  memberId: string | null;
  /** First-party visitor hash for unpaid / anonymous traffic. */
  visitorId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramUsername: string | null;
  discordUsername: string | null;
  xUsername: string | null;
  instagramUsername: string | null;
  /** Optional avatar.vercel.sh seed (not a remote image URL). */
  pfpUrl: string | null;
  /**
   * Face / reference photos — https URLs or small data:image uploads.
   * Used for CRM profiling (e.g. Substack / partner leads) with no visitor row.
   */
  photoUrls: string[];
  /** Free-text payment method notes (card brand/last4, bank, etc.). */
  paymentMethods: string | null;
  /** Extra wallets beyond visitor auto-detect (comma or newline separated in UI). */
  wallets: string[];
  note: string | null;
  /** Manual link to the other side of the identity. */
  linkedMemberId: string | null;
  linkedVisitorId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export function personEnrichmentId(kind: PersonKind, entityId: string) {
  const safe = entityId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return `pe_${kind}_${safe}`;
}

export function hueFromPersonId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 33 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
