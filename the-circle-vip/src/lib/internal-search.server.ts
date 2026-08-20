import "server-only";

import { listClaimLinks } from "@/lib/claim-links.server";
import { listCompGifts } from "@/lib/comp-gifts.server";
import { listRecentCryptoPayments } from "@/lib/crypto-verify.server";
import {
  type SearchGroup,
  type SearchIndexItem,
  type SearchIndexResponse,
} from "@/lib/internal-search-types";
import {
  SEARCH_ACTIONS,
  SEARCH_PAGES,
  searchItem,
} from "@/lib/internal-search-static";
import { listLeads } from "@/lib/leads.server";
import { LEAD_STATUS_LABEL } from "@/lib/leads-types";
import { getRecentVisitors } from "@/lib/pageviews.server";
import { listPersonEnrichments } from "@/lib/people-enrichment.server";
import { personEnrichmentId } from "@/lib/people-types";
import { FALLBACK_PLANS, PLAN_ORDER } from "@/lib/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { listWhopPaymentsFromStripe } from "@/lib/whop-stripe.server";

const PAGES = SEARCH_PAGES;
const ACTIONS = SEARCH_ACTIONS;

function item(
  id: string,
  group: SearchGroup,
  title: string,
  subtitle: string | undefined,
  href: string,
  keywords: Array<string | null | undefined>,
): SearchIndexItem {
  return searchItem(id, group, title, subtitle, href, keywords);
}

async function listMembersSlim(limit = 250) {
  if (!isStripeConfigured()) return [];
  const stripe = getStripe();
  const out: {
    id: string;
    email: string | null;
    name: string | null;
    telegramUsername: string | null;
    planLabel: string | null;
    status: string;
    source: string | null;
  }[] = [];

  let startingAfter: string | undefined;
  for (let page = 0; page < 5 && out.length < limit; page += 1) {
    const batch = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.customer"],
    });
    for (const sub of batch.data) {
      const customer =
        typeof sub.customer === "object" &&
        sub.customer &&
        !sub.customer.deleted
          ? sub.customer
          : null;
      const planId = sub.metadata?.planId?.trim() || null;
      const planLabel =
        (planId && planId in FALLBACK_PLANS
          ? FALLBACK_PLANS[planId as keyof typeof FALLBACK_PLANS].label
          : null) || planId;
      out.push({
        id: sub.id,
        email:
          customer && "email" in customer ? (customer.email ?? null) : null,
        name: customer && "name" in customer ? (customer.name ?? null) : null,
        telegramUsername:
          sub.metadata?.telegramUsername ||
          customer?.metadata?.telegramUsername ||
          null,
        planLabel,
        status: sub.status,
        source: sub.metadata?.source?.trim() || null,
      });
      if (out.length >= limit) break;
    }
    if (!batch.has_more) break;
    startingAfter = batch.data[batch.data.length - 1]?.id;
  }

  return out;
}

export async function buildInternalSearchIndex(): Promise<SearchIndexResponse> {
  const [
    members,
    leads,
    visitors,
    enrichments,
    claimLinks,
    comps,
    cryptoPays,
    stripePays,
  ] = await Promise.all([
    listMembersSlim(250).catch(() => []),
    listLeads(200).catch(() => []),
    getRecentVisitors(200).catch(() => []),
    listPersonEnrichments(400).catch(() => []),
    listClaimLinks(120).catch(() => []),
    listCompGifts(80).catch(() => []),
    listRecentCryptoPayments(150).catch(() => []),
    listWhopPaymentsFromStripe(150).catch(() => []),
  ]);

  const enrichmentByVisitor = new Map(
    enrichments
      .filter((row) => row.kind === "visitor" && row.visitorId)
      .map((row) => [row.visitorId!, row] as const),
  );
  const enrichmentByMember = new Map(
    enrichments
      .filter((row) => row.kind === "member" && row.memberId)
      .map((row) => [row.memberId!, row] as const),
  );

  const items: SearchIndexItem[] = [...PAGES, ...ACTIONS];

  for (const planId of PLAN_ORDER) {
    const plan = FALLBACK_PLANS[planId];
    items.push(
      item(
        `product-${plan.id}`,
        "products",
        plan.label,
        `${plan.amountEur} EUR / ${plan.amountUsd} USDC · ${plan.description}`,
        "/internal/products",
        [
          plan.id,
          plan.label,
          String(plan.amountEur),
          String(plan.amountUsd),
          "plan",
          "product",
          "usdc",
          "eur",
        ],
      ),
    );
  }

  for (const member of members) {
    const enrichment = enrichmentByMember.get(member.id);
    const label =
      enrichment?.name ||
      member.name ||
      (member.telegramUsername
        ? `@${member.telegramUsername.replace(/^@/, "")}`
        : null) ||
      member.email ||
      member.id;
    items.push(
      item(
        `member-${member.id}`,
        "members",
        label,
        [
          member.planLabel,
          member.status.replaceAll("_", " "),
          member.email,
          member.telegramUsername
            ? `@${member.telegramUsername.replace(/^@/, "")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        `/internal/people?kind=member&id=${encodeURIComponent(member.id)}&tab=members`,
        [
          member.id,
          member.email,
          member.name,
          member.telegramUsername,
          member.planLabel,
          member.status,
          member.source,
          enrichment?.name,
          enrichment?.email,
          enrichment?.phone,
          enrichment?.telegramUsername,
          enrichment?.discordUsername,
          enrichment?.xUsername,
          enrichment?.instagramUsername,
          enrichment?.note,
          ...(enrichment?.wallets ?? []),
        ],
      ),
    );
  }

  for (const visitor of visitors) {
    const enrichment = enrichmentByVisitor.get(visitor.id);
    const label =
      enrichment?.name ||
      (enrichment?.telegramUsername
        ? `@${enrichment.telegramUsername.replace(/^@/, "")}`
        : null) ||
      visitor.ip ||
      visitor.id;
    items.push(
      item(
        `visitor-${visitor.id}`,
        "people",
        label,
        [
          [visitor.city, visitor.country].filter(Boolean).join(", "),
          visitor.lastWalletBrand || visitor.lastWalletAddress?.slice(0, 10),
          `${visitor.visitDays}d · ${visitor.pageviews} imp`,
        ]
          .filter(Boolean)
          .join(" · "),
        `/internal/people?kind=visitor&id=${encodeURIComponent(visitor.id)}&tab=visitors`,
        [
          visitor.id,
          visitor.ip,
          visitor.country,
          visitor.city,
          visitor.region,
          visitor.lastPath,
          visitor.lastWalletAddress,
          visitor.lastWalletBrand,
          ...(visitor.wallets ?? []),
          enrichment?.name,
          enrichment?.email,
          enrichment?.phone,
          enrichment?.telegramUsername,
          enrichment?.discordUsername,
          enrichment?.xUsername,
          enrichment?.instagramUsername,
          enrichment?.note,
          ...(enrichment?.wallets ?? []),
          personEnrichmentId("visitor", visitor.id),
        ],
      ),
    );
  }

  for (const enrichment of enrichments) {
    if (enrichment.kind === "visitor" && enrichment.visitorId) {
      if (visitors.some((v) => v.id === enrichment.visitorId)) continue;
    }
    if (enrichment.kind === "member" && enrichment.memberId) {
      if (members.some((m) => m.id === enrichment.memberId)) continue;
    }
    const entityId =
      enrichment.kind === "member"
        ? enrichment.memberId
        : enrichment.visitorId;
    if (!entityId) continue;
    const label =
      enrichment.name ||
      (enrichment.telegramUsername
        ? `@${enrichment.telegramUsername.replace(/^@/, "")}`
        : null) ||
      enrichment.email ||
      entityId;
    items.push(
      item(
        `enrichment-${enrichment.id}`,
        enrichment.kind === "member" ? "members" : "people",
        label,
        [enrichment.email, enrichment.phone, enrichment.note]
          .filter(Boolean)
          .join(" · "),
        enrichment.kind === "member"
          ? `/internal/people?kind=member&id=${encodeURIComponent(entityId)}&tab=members`
          : `/internal/people?kind=visitor&id=${encodeURIComponent(entityId)}&tab=visitors`,
        [
          enrichment.id,
          entityId,
          enrichment.name,
          enrichment.email,
          enrichment.phone,
          enrichment.telegramUsername,
          enrichment.discordUsername,
          enrichment.xUsername,
          enrichment.instagramUsername,
          enrichment.note,
          ...enrichment.wallets,
        ],
      ),
    );
  }

  for (const lead of leads) {
    const label =
      lead.name ||
      (lead.telegramUsername
        ? `@${lead.telegramUsername.replace(/^@/, "")}`
        : null) ||
      lead.email ||
      lead.id;
    items.push(
      item(
        `lead-${lead.id}`,
        "leads",
        label,
        [
          LEAD_STATUS_LABEL[lead.status] ?? lead.status,
          lead.email,
          lead.source,
          lead.note,
        ]
          .filter(Boolean)
          .join(" · "),
        "/internal/leads",
        [
          lead.id,
          lead.name,
          lead.email,
          lead.telegramUsername,
          lead.source,
          lead.note,
          lead.status,
          LEAD_STATUS_LABEL[lead.status],
        ],
      ),
    );
  }

  for (const payment of stripePays) {
    const title =
      payment.email || payment.description || payment.invoiceId;
    items.push(
      item(
        `pay-stripe-${payment.invoiceId}`,
        "payments",
        `€${payment.amountUsd.toFixed(2)} · ${title}`,
        [
          "Stripe",
          payment.status,
          payment.tag,
          payment.country,
          payment.paidAt.slice(0, 10),
        ]
          .filter(Boolean)
          .join(" · "),
        "/internal/payments",
        [
          payment.invoiceId,
          payment.customerId,
          payment.email,
          payment.description,
          payment.whopPaymentId,
          payment.tag,
          payment.source,
          payment.country,
          String(payment.amountUsd),
          "stripe",
          "invoice",
          "payment",
        ],
      ),
    );
  }

  for (const payment of cryptoPays) {
    const title = payment.telegramUsername
      ? `@${payment.telegramUsername.replace(/^@/, "")}`
      : payment.fromAddress?.slice(0, 12) || payment.txHash.slice(0, 12);
    items.push(
      item(
        `pay-crypto-${payment.txHash}`,
        "payments",
        `${payment.amountUsdc} USDC · ${title}`,
        [
          "Crypto",
          payment.planId,
          payment.walletBrand,
          payment.chainId,
          payment.createdAt.slice(0, 10),
        ]
          .filter(Boolean)
          .join(" · "),
        "/internal/crypto",
        [
          payment.txHash,
          payment.fromAddress,
          payment.telegramUsername,
          payment.telegramUserId,
          payment.planId,
          payment.walletBrand,
          payment.chainId,
          String(payment.amountUsdc),
          "crypto",
          "usdc",
          "payment",
        ],
      ),
    );
  }

  for (const link of claimLinks) {
    const label =
      link.label || link.telegramUsername || link.email || link.id;
    items.push(
      item(
        `claim-${link.id}`,
        "checkout",
        String(label),
        [
          `€${(link.amountUsdCents / 100).toFixed(2)}`,
          link.status,
          link.telegramUsername
            ? `@${link.telegramUsername.replace(/^@/, "")}`
            : null,
          link.note,
        ]
          .filter(Boolean)
          .join(" · "),
        "/internal/checkout-links",
        [
          link.id,
          link.label,
          link.email,
          link.telegramUsername,
          link.note,
          link.status,
          link.subscriptionId,
          link.checkoutSessionId,
          String(link.amountUsdCents / 100),
          "claim",
          "checkout",
        ],
      ),
    );
  }

  for (const gift of comps) {
    const label =
      gift.label || gift.telegramUsername || gift.email || gift.id;
    items.push(
      item(
        `comp-${gift.id}`,
        "comps",
        String(label),
        [
          "Comp",
          gift.status,
          gift.telegramUsername
            ? `@${gift.telegramUsername.replace(/^@/, "")}`
            : null,
          gift.note,
        ]
          .filter(Boolean)
          .join(" · "),
        "/internal/memberships",
        [
          gift.id,
          gift.label,
          gift.email,
          gift.telegramUsername,
          gift.note,
          gift.status,
          gift.subscriptionId,
          "comp",
          "gift",
        ],
      ),
    );
  }

  const counts: Partial<Record<SearchGroup, number>> = {};
  for (const row of items) {
    counts[row.group] = (counts[row.group] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    items,
    counts,
  };
}
