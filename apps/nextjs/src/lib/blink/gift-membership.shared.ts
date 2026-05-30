export type GiftMembershipInfo = {
  isGift: boolean;
  isActiveGift: boolean;
  /** Human label for superuser UI, e.g. "Gifted Pro · 30d · 12d left". */
  label: string | null;
  /** Best-effort tier length from created → period end. */
  giftedDurationDays: 30 | 90 | 365 | "lifetime" | null;
  daysRemaining: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function describeGiftedMembership(
  membership: {
    paymentMethod: string;
    status: string;
    currentPeriodEnd: string | null;
    createdAt: string | null;
  } | null,
): GiftMembershipInfo {
  if (!membership || membership.paymentMethod !== "gift") {
    return {
      isGift: false,
      isActiveGift: false,
      label: null,
      giftedDurationDays: null,
      daysRemaining: null,
    };
  }

  const periodEnd = membership.currentPeriodEnd
    ? new Date(membership.currentPeriodEnd)
    : null;
  const createdAt = membership.createdAt
    ? new Date(membership.createdAt)
    : null;
  const now = Date.now();
  const isActiveGift =
    membership.status === "active" &&
    periodEnd !== null &&
    periodEnd.getTime() > now;

  const daysRemaining =
    periodEnd && periodEnd.getTime() > now
      ? Math.max(0, Math.ceil((periodEnd.getTime() - now) / DAY_MS))
      : 0;

  let giftedDurationDays: GiftMembershipInfo["giftedDurationDays"] = null;
  if (createdAt && periodEnd) {
    const spanDays = Math.round(
      (periodEnd.getTime() - createdAt.getTime()) / DAY_MS,
    );
    if (spanDays >= 3_650) {
      giftedDurationDays = "lifetime";
    } else if (spanDays >= 25 && spanDays <= 40) {
      giftedDurationDays = 30;
    } else if (spanDays >= 80 && spanDays <= 100) {
      giftedDurationDays = 90;
    } else if (spanDays >= 330 && spanDays <= 400) {
      giftedDurationDays = 365;
    }
  }

  const durationPart =
    giftedDurationDays === "lifetime"
      ? "lifetime"
      : giftedDurationDays
        ? `${giftedDurationDays}d`
        : null;

  const label = isActiveGift
    ? `Gifted Pro${durationPart ? ` · ${durationPart}` : ""} · ${daysRemaining}d left`
    : "Gifted Pro (expired)";

  return {
    isGift: true,
    isActiveGift,
    label,
    giftedDurationDays,
    daysRemaining: isActiveGift ? daysRemaining : 0,
  };
}
