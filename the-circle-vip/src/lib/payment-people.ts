import type { VisitorProfile } from "@/lib/analytics-types";
import type { StripeMemberRow } from "@/lib/internal-stats-types";
import type { PersonEnrichment, PersonKind } from "@/lib/people-types";

export type PersonRef = {
  kind: PersonKind;
  id: string;
  label: string;
  href: string;
};

export type UnifiedPayment = {
  id: string;
  rail: "stripe" | "crypto";
  amountUsd: number;
  amountLabel: string;
  at: string;
  title: string;
  subtitle: string;
  tag: string;
  externalHref: string | null;
};

export type StripePaymentLike = {
  invoiceId: string;
  customerId: string | null;
  email: string | null;
  amountUsd: number;
  paidAt: string;
  description: string | null;
  tag: string;
  country: string | null;
  status: string;
};

export type CryptoPaymentLike = {
  txHash: string;
  amountUsdc: number;
  createdAt: string;
  planId?: string | null;
  planLabel?: string | null;
  telegramUsername?: string | null;
  telegramUserId?: string | null;
  walletAddress?: string | null;
  walletBrand?: string | null;
  explorerUrl?: string | null;
  chainLabel?: string | null;
};

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export function normalizeTelegram(value: string | null | undefined) {
  const trimmed = value?.trim().replace(/^@/, "").toLowerCase() ?? "";
  return trimmed || null;
}

export function normalizeWallet(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

function memberLabel(member: StripeMemberRow) {
  return (
    member.name ||
    (member.telegramUsername
      ? `@${member.telegramUsername.replace(/^@/, "")}`
      : null) ||
    member.email ||
    member.id
  );
}

function visitorLabel(
  visitor: VisitorProfile,
  enrichment: PersonEnrichment | null | undefined,
) {
  return (
    enrichment?.name ||
    (enrichment?.telegramUsername
      ? `@${enrichment.telegramUsername.replace(/^@/, "")}`
      : null) ||
    visitor.lastWalletAddress?.slice(0, 10) ||
    visitor.ip ||
    visitor.id
  );
}

function peopleHref(kind: PersonKind, id: string, tab?: string) {
  const params = new URLSearchParams({
    kind,
    id,
    tab: tab || (kind === "member" ? "members" : "visitors"),
  });
  return `/internal/people?${params.toString()}`;
}

function enrichmentForMember(
  member: StripeMemberRow,
  enrichments: PersonEnrichment[],
) {
  return (
    enrichments.find(
      (row) =>
        row.kind === "member" &&
        (row.memberId === member.id ||
          (member.customerId && row.memberId === member.customerId)),
    ) ?? null
  );
}

function enrichmentForVisitor(
  visitor: VisitorProfile,
  enrichments: PersonEnrichment[],
) {
  return (
    enrichments.find(
      (row) => row.kind === "visitor" && row.visitorId === visitor.id,
    ) ?? null
  );
}

export function resolvePersonForStripePayment(
  payment: StripePaymentLike,
  members: StripeMemberRow[],
  enrichments: PersonEnrichment[] = [],
): PersonRef | null {
  const customerId = payment.customerId?.trim() || null;
  const email = normalizeEmail(payment.email);

  if (customerId) {
    const byCustomer = members.find(
      (member) =>
        member.customerId === customerId || member.id === customerId,
    );
    if (byCustomer) {
      return {
        kind: "member",
        id: byCustomer.id,
        label: memberLabel(byCustomer),
        href: peopleHref("member", byCustomer.id),
      };
    }
  }

  if (email) {
    const byEmail = members.find(
      (member) => normalizeEmail(member.email) === email,
    );
    if (byEmail) {
      return {
        kind: "member",
        id: byEmail.id,
        label: memberLabel(byEmail),
        href: peopleHref("member", byEmail.id),
      };
    }

    const enrichment = enrichments.find(
      (row) => normalizeEmail(row.email) === email && row.kind === "member",
    );
    if (enrichment?.memberId) {
      return {
        kind: "member",
        id: enrichment.memberId,
        label: enrichment.name || enrichment.email || enrichment.memberId,
        href: peopleHref("member", enrichment.memberId),
      };
    }
  }

  return null;
}

export function resolvePersonForCryptoPayment(
  payment: CryptoPaymentLike,
  members: StripeMemberRow[],
  visitors: VisitorProfile[],
  enrichments: PersonEnrichment[] = [],
): PersonRef | null {
  const telegram = normalizeTelegram(payment.telegramUsername);
  const telegramUserId = payment.telegramUserId?.trim() || null;
  const wallet = normalizeWallet(payment.walletAddress);

  if (telegram) {
    const byTg = members.find(
      (member) => normalizeTelegram(member.telegramUsername) === telegram,
    );
    if (byTg) {
      return {
        kind: "member",
        id: byTg.id,
        label: memberLabel(byTg),
        href: peopleHref("member", byTg.id),
      };
    }
    const enrichment = enrichments.find(
      (row) => normalizeTelegram(row.telegramUsername) === telegram,
    );
    if (enrichment?.kind === "member" && enrichment.memberId) {
      return {
        kind: "member",
        id: enrichment.memberId,
        label: enrichment.name || `@${telegram}`,
        href: peopleHref("member", enrichment.memberId),
      };
    }
    if (enrichment?.kind === "visitor" && enrichment.visitorId) {
      return {
        kind: "visitor",
        id: enrichment.visitorId,
        label: enrichment.name || `@${telegram}`,
        href: peopleHref("visitor", enrichment.visitorId),
      };
    }
  }

  if (telegramUserId && !telegramUserId.startsWith("guest:")) {
    const byTgId = members.find(
      (member) => member.telegramUserId === telegramUserId,
    );
    if (byTgId) {
      return {
        kind: "member",
        id: byTgId.id,
        label: memberLabel(byTgId),
        href: peopleHref("member", byTgId.id),
      };
    }
  }

  if (wallet) {
    const visitor = visitors.find((row) => {
      if (normalizeWallet(row.lastWalletAddress) === wallet) return true;
      return (row.wallets ?? []).some((w) => normalizeWallet(w) === wallet);
    });
    if (visitor) {
      const enrichment = enrichmentForVisitor(visitor, enrichments);
      return {
        kind: "visitor",
        id: visitor.id,
        label: visitorLabel(visitor, enrichment),
        href: peopleHref("visitor", visitor.id),
      };
    }

    const enrichment = enrichments.find((row) =>
      row.wallets.some((w) => normalizeWallet(w) === wallet),
    );
    if (enrichment?.kind === "visitor" && enrichment.visitorId) {
      return {
        kind: "visitor",
        id: enrichment.visitorId,
        label: enrichment.name || wallet.slice(0, 10),
        href: peopleHref("visitor", enrichment.visitorId),
      };
    }
    if (enrichment?.kind === "member" && enrichment.memberId) {
      return {
        kind: "member",
        id: enrichment.memberId,
        label: enrichment.name || wallet.slice(0, 10),
        href: peopleHref("member", enrichment.memberId),
      };
    }
  }

  return null;
}

function stripeMatchesPerson(
  payment: StripePaymentLike,
  kind: PersonKind,
  entityId: string,
  member: StripeMemberRow | null,
  enrichment: PersonEnrichment | null,
): boolean {
  if (kind !== "member") return false;
  const customerId = payment.customerId?.trim() || null;
  const email = normalizeEmail(payment.email);
  if (customerId) {
    if (customerId === entityId) return true;
    if (member?.customerId && customerId === member.customerId) return true;
    if (enrichment?.memberId && customerId === enrichment.memberId) return true;
    if (
      enrichment?.linkedMemberId &&
      customerId === enrichment.linkedMemberId
    ) {
      return true;
    }
  }
  if (email) {
    if (normalizeEmail(member?.email) === email) return true;
    if (normalizeEmail(enrichment?.email) === email) return true;
  }
  return false;
}

function cryptoMatchesPerson(
  payment: CryptoPaymentLike,
  kind: PersonKind,
  entityId: string,
  member: StripeMemberRow | null,
  visitor: VisitorProfile | null,
  enrichment: PersonEnrichment | null,
): boolean {
  const telegram = normalizeTelegram(payment.telegramUsername);
  const wallet = normalizeWallet(payment.walletAddress);
  const formTg = normalizeTelegram(
    enrichment?.telegramUsername || member?.telegramUsername,
  );
  const tgUserId = payment.telegramUserId?.trim() || null;

  if (telegram && formTg && telegram === formTg) return true;
  if (
    tgUserId &&
    member?.telegramUserId &&
    tgUserId === member.telegramUserId
  ) {
    return true;
  }

  if (wallet) {
    const wallets = new Set(
      [
        ...(enrichment?.wallets ?? []),
        ...(visitor?.wallets ?? []),
        visitor?.lastWalletAddress,
      ]
        .map(normalizeWallet)
        .filter(Boolean),
    );
    if (wallets.has(wallet)) return true;
  }

  // Linked identities
  if (kind === "member" && enrichment?.linkedVisitorId && visitor) {
    // already covered via wallets on linked visitor if passed
  }
  if (kind === "visitor" && entityId && visitor?.id === entityId && wallet) {
    // wallets checked above
  }

  return false;
}

export function paymentsForPerson(input: {
  kind: PersonKind;
  entityId: string;
  member: StripeMemberRow | null;
  visitor: VisitorProfile | null;
  enrichment: PersonEnrichment | null;
  stripePayments: StripePaymentLike[];
  cryptoPayments: CryptoPaymentLike[];
}): UnifiedPayment[] {
  const {
    kind,
    entityId,
    member,
    visitor,
    enrichment,
    stripePayments,
    cryptoPayments,
  } = input;

  const rows: UnifiedPayment[] = [];

  for (const payment of stripePayments) {
    if (
      !stripeMatchesPerson(payment, kind, entityId, member, enrichment)
    ) {
      continue;
    }
    rows.push({
      id: `stripe-${payment.invoiceId}`,
      rail: "stripe",
      amountUsd: payment.amountUsd,
      amountLabel: `€${payment.amountUsd.toFixed(2)}`,
      at: payment.paidAt,
      title: payment.description || payment.tag || "Stripe payment",
      subtitle: [payment.tag, payment.country, payment.status]
        .filter(Boolean)
        .join(" · "),
      tag: payment.tag || "Stripe",
      externalHref: `https://dashboard.stripe.com/invoices/${payment.invoiceId}`,
    });
  }

  for (const payment of cryptoPayments) {
    if (
      !cryptoMatchesPerson(
        payment,
        kind,
        entityId,
        member,
        visitor,
        enrichment,
      )
    ) {
      continue;
    }
    rows.push({
      id: `crypto-${payment.txHash}`,
      rail: "crypto",
      amountUsd: payment.amountUsdc,
      amountLabel: `${payment.amountUsdc} USDC`,
      at: payment.createdAt,
      title: payment.planLabel || payment.planId || "Crypto payment",
      subtitle: [
        payment.chainLabel,
        payment.walletBrand,
        payment.telegramUsername
          ? `@${payment.telegramUsername.replace(/^@/, "")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      tag: "Crypto",
      externalHref: payment.explorerUrl ?? null,
    });
  }

  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function buildPersonIndex(input: {
  members: StripeMemberRow[];
  visitors: VisitorProfile[];
  enrichments: PersonEnrichment[];
}) {
  return {
    members: input.members,
    visitors: input.visitors,
    enrichments: input.enrichments,
    enrichmentForMember: (member: StripeMemberRow) =>
      enrichmentForMember(member, input.enrichments),
    enrichmentForVisitor: (visitor: VisitorProfile) =>
      enrichmentForVisitor(visitor, input.enrichments),
  };
}
