import "server-only";

import {
  EMAIL_AUDIENCES,
  EMAIL_CAMPAIGNS,
  EMAIL_SENDERS,
  type EmailAudienceId,
} from "@/lib/email-campaigns";
import type {
  EmailAudienceBoardRow,
  EmailAudienceMember,
  EmailBoard,
  EmailCampaignBoardRow,
  EmailPipelineKpis,
} from "@/lib/email-board-types";
import { getResendConfig } from "@/lib/email.server";
import { isEmailCaptureLead } from "@/lib/funnel-stats";
import { listLeads, type LeadRecord } from "@/lib/leads.server";
import { getProprSeedSummary } from "@/lib/propr-leads.server";
import { isSubstackMeta } from "@/lib/substack-meta";
import { listWhopLeadsFromStripe } from "@/lib/whop-stripe.server";

const SAMPLE_CAP = 12;
const LEAD_CAP = 2_000;
const WHOP_CAP = 1_000;

function daysAgo(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 9999;
  return (Date.now() - t) / 86_400_000;
}

function scoreLead(lead: LeadRecord): {
  score: number;
  reasons: string[];
  metaSummary: string | null;
  lifetimeUsd: number | null;
  opens6mo: number | null;
  activity30d: number | null;
} {
  let score = 20;
  const reasons: string[] = [];
  let metaSummary: string | null = null;
  let lifetimeUsd: number | null = null;
  let opens6mo: number | null = null;
  let activity30d: number | null = null;

  if (lead.email) {
    score += 15;
  } else {
    reasons.push("Missing email");
  }

  if (lead.status === "qualified") {
    score += 18;
    reasons.push("Qualified");
  } else if (lead.status === "contacted") {
    score += 8;
    reasons.push("Contacted");
  } else if (lead.status === "new") {
    score += 4;
  } else if (lead.status === "member") {
    score += 6;
    reasons.push("Already member");
  } else if (lead.status === "lost") {
    score -= 25;
    reasons.push("Lost");
  }

  if (daysAgo(lead.createdAt) <= 7) {
    score += 12;
    reasons.push("Fresh ≤7d");
  } else if (daysAgo(lead.createdAt) <= 30) {
    score += 6;
    reasons.push("Fresh ≤30d");
  }

  if (lead.source === "whop_member" || lead.source === "whop") {
    if (lead.status === "member") {
      score += 22;
      reasons.push("Whop paid → migrate");
    } else {
      score += 10;
      reasons.push("Whop unpaid");
    }
  }

  if (lead.source === "substack" && isSubstackMeta(lead.meta)) {
    const meta = lead.meta;
    opens6mo = meta.opens6mo;
    activity30d = meta.activity30d;
    lifetimeUsd = meta.stripe?.lifetimeUsd ?? null;
    metaSummary = `${meta.type} · ${meta.opens6mo} opens / 6mo`;
    if (meta.opens6mo >= 20) {
      score += 18;
      reasons.push("High Substack opens");
    } else if (meta.opens6mo >= 5) {
      score += 10;
      reasons.push("Active Substack reader");
    }
    if (meta.activity30d >= 3) {
      score += 8;
      reasons.push("Active 30d");
    }
    if (meta.linksClicked >= 5) {
      score += 6;
      reasons.push("Clicks links");
    }
    if (!meta.isPaidExport && lead.status !== "member") {
      score += 8;
      reasons.push("Free → convert");
    }
    if ((meta.stripe?.lifetimeUsd ?? 0) > 0) {
      score += 14;
      reasons.push("Circle Stripe revenue");
    }
  }

  if (lead.source === "propr") {
    score += lead.email ? 10 : -5;
    reasons.push(lead.email ? "Propr partner" : "Propr needs email");
  }

  if (isEmailCaptureLead(lead)) {
    score += 7;
    reasons.push("Waitlist capture");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    reasons: reasons.slice(0, 4),
    metaSummary,
    lifetimeUsd,
    opens6mo,
    activity30d,
  };
}

function toMember(lead: LeadRecord): EmailAudienceMember {
  const scored = scoreLead(lead);
  return {
    id: lead.id,
    email: lead.email,
    name: lead.name,
    telegramUsername: lead.telegramUsername,
    source: lead.source || "unknown",
    status: lead.status,
    createdAt: lead.createdAt,
    score: scored.score,
    scoreReasons: scored.reasons,
    metaSummary: scored.metaSummary,
    lifetimeUsd: scored.lifetimeUsd,
    opens6mo: scored.opens6mo,
    activity30d: scored.activity30d,
  };
}

function resolveAudienceLeads(
  id: EmailAudienceId,
  manual: LeadRecord[],
  whop: LeadRecord[],
): LeadRecord[] {
  switch (id) {
    case "waitlist":
      return manual.filter((l) => isEmailCaptureLead(l) && Boolean(l.email));
    case "substack":
      return manual.filter((l) => l.source === "substack");
    case "substack_free":
      return manual.filter(
        (l) =>
          l.source === "substack" &&
          l.email &&
          l.status !== "member" &&
          l.status !== "lost",
      );
    case "whop_members":
      return whop.filter((l) => l.status === "member" && Boolean(l.email));
    case "whop_unpaid":
      return whop.filter((l) => l.status !== "member" && Boolean(l.email));
    case "propr":
      return manual.filter((l) => l.source === "propr");
    case "propr_emailable":
      return manual.filter((l) => l.source === "propr" && Boolean(l.email));
    case "all_emailable": {
      const seen = new Set<string>();
      const out: LeadRecord[] = [];
      for (const lead of [...manual, ...whop]) {
        const email = lead.email?.toLowerCase();
        if (!email || lead.status === "lost" || seen.has(email)) continue;
        seen.add(email);
        out.push(lead);
      }
      return out;
    }
    default:
      return [];
  }
}

function buildAudienceRow(
  id: EmailAudienceId,
  manual: LeadRecord[],
  whop: LeadRecord[],
): EmailAudienceBoardRow {
  const def = EMAIL_AUDIENCES.find((a) => a.id === id)!;
  const leads = resolveAudienceLeads(id, manual, whop);
  const members = leads.map(toMember).sort((a, b) => b.score - a.score);
  const emailableCount = members.filter((m) => Boolean(m.email)).length;
  const memberCount = members.filter((m) => m.status === "member").length;
  const avgScore =
    members.length === 0
      ? 0
      : Math.round(
          members.reduce((sum, m) => sum + m.score, 0) / members.length,
        );
  const reasonFreq = new Map<string, number>();
  for (const member of members.slice(0, 80)) {
    for (const reason of member.scoreReasons) {
      reasonFreq.set(reason, (reasonFreq.get(reason) ?? 0) + 1);
    }
  }
  const topReasons = [...reasonFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);

  return {
    id,
    label: def.label,
    description: def.description,
    emailable: def.emailable,
    count: members.length,
    emailableCount,
    memberPct:
      members.length === 0
        ? 0
        : Math.round((memberCount / members.length) * 1000) / 10,
    avgScore,
    topReasons,
    sample: members.slice(0, SAMPLE_CAP),
  };
}

function campaignReadiness(
  campaign: (typeof EMAIL_CAMPAIGNS)[number],
  audience: EmailAudienceBoardRow,
  resendConfigured: boolean,
): Pick<EmailCampaignBoardRow, "blockers" | "readiness"> {
  const blockers: string[] = [];
  if (!resendConfigured) blockers.push("Resend API key missing");
  if (campaign.status === "draft") blockers.push("Campaign still draft");
  if (!audience.emailable) blockers.push("Audience not emailable");
  if (audience.emailableCount === 0) blockers.push("Zero emailable recipients");
  if (audience.id === "propr_emailable" && audience.emailableCount < 5) {
    blockers.push("Propr emails still thin — enrich CRM");
  }

  let readiness: EmailCampaignBoardRow["readiness"] = "ready";
  if (blockers.length > 0) readiness = "blocked";
  else if (audience.avgScore < 35 || audience.emailableCount < 10) {
    readiness = "needs_review";
  }

  return { blockers, readiness };
}

/**
 * Data-intensive Emails board: audiences with scored samples, campaign
 * readiness, pipeline KPIs. Blast ledger + Resend webhooks plug in later.
 */
export async function getEmailBoard(): Promise<EmailBoard> {
  const [manual, whop, propr, resend] = await Promise.all([
    listLeads(LEAD_CAP),
    listWhopLeadsFromStripe(WHOP_CAP),
    getProprSeedSummary(),
    Promise.resolve(getResendConfig()),
  ]);

  const audiences = EMAIL_AUDIENCES.map((audience) =>
    buildAudienceRow(audience.id, manual, whop),
  );
  const byId = new Map(audiences.map((row) => [row.id, row]));

  const campaigns: EmailCampaignBoardRow[] = EMAIL_CAMPAIGNS.map((campaign) => {
    const audience =
      byId.get(campaign.audienceId) ??
      buildAudienceRow(campaign.audienceId, manual, whop);
    const { blockers, readiness } = campaignReadiness(
      campaign,
      audience,
      resend.configured,
    );
    return {
      id: campaign.id,
      title: campaign.title,
      subject: campaign.subject,
      preview: campaign.preview,
      senderId: campaign.senderId,
      audienceId: campaign.audienceId,
      status: campaign.status,
      audienceCount: audience.count,
      audienceEmailable: audience.emailableCount,
      ctaLabel: campaign.ctaLabel,
      ctaHref: campaign.ctaHref,
      bodyHtml: campaign.bodyHtml,
      bodyText: campaign.bodyText,
      blockers,
      readiness,
    };
  });

  const allEmailable = byId.get("all_emailable");
  const substack = byId.get("substack");
  const waitlist = byId.get("waitlist");
  const whopPaid = byId.get("whop_members");
  const proprRow = byId.get("propr");
  const proprEmailable = byId.get("propr_emailable");

  const allMembersScored = resolveAudienceLeads(
    "all_emailable",
    manual,
    whop,
  ).map(toMember);
  const highIntent = allMembersScored.filter((m) => m.score >= 60).length;

  const substackEngaged = resolveAudienceLeads("substack", manual, whop)
    .map(toMember)
    .filter((m) => (m.opens6mo ?? 0) >= 5 || (m.activity30d ?? 0) >= 2)
    .length;

  const waitlistFresh7d = resolveAudienceLeads("waitlist", manual, whop).filter(
    (l) => daysAgo(l.createdAt) <= 7,
  ).length;

  // Circle members with email = CRM leads already marked member + emailable.
  const circleMembersEmailable = manual.filter(
    (l) => l.status === "member" && Boolean(l.email),
  ).length;

  const kpis: EmailPipelineKpis = {
    emailableTotal: allEmailable?.emailableCount ?? 0,
    audiences: audiences.length,
    campaignsReady: campaigns.filter((c) => c.readiness === "ready").length,
    campaignsDraft: campaigns.filter((c) => c.status === "draft").length,
    missingEmail:
      (proprRow?.count ?? 0) - (proprEmailable?.emailableCount ?? 0),
    highIntent,
    substackEngaged,
    whopMigrationPool: whopPaid?.emailableCount ?? 0,
    waitlistFresh7d,
    circleMembersEmailable,
  };

  return {
    generatedAt: new Date().toISOString(),
    kpis,
    deliverability: {
      resendConfigured: resend.configured,
      domain: resend.domain,
      senders: EMAIL_SENDERS,
      webhookConfigured: false,
      lastTestAt: null,
      notes: resend.configured
        ? [
            "Domain verified path assumed via Resend dashboard.",
            "Open/click/bounce webhooks not wired yet — Sends tab will light up after.",
          ]
        : [
            "Set RESEND_API_KEY Worker secret and verify SPF/DKIM for rokitg.com.",
          ],
    },
    audiences,
    campaigns,
    recentSends: [],
    automations: [
      {
        id: "whop_drip",
        title: "Whop migration drip",
        trigger: "Whop paid member without Circle Stripe sub",
        audienceHint: "whop_members",
        status: "planned",
        steps: ["Day 0 claim link", "Day 3 reminder", "Day 7 last call"],
      },
      {
        id: "waitlist_nurture",
        title: "Waitlist nurture",
        trigger: "New landing email capture",
        audienceHint: "waitlist",
        status: "planned",
        steps: ["Instant welcome", "Day 2 social proof", "Day 5 join CTA"],
      },
      {
        id: "substack_convert",
        title: "Substack free → Circle",
        trigger: "Free Substack with opens ≥ 5 / 6mo",
        audienceHint: "substack_free",
        status: "draft",
        steps: ["Score rank", "Personal CTA", "Store cross-sell"],
      },
      {
        id: "addon_upsell",
        title: "Indicators / Discord upsell",
        trigger: "Active Circle Stripe member (no add-on)",
        audienceHint: "circle_members",
        status: "planned",
        steps: ["Post-checkout offer", "Day 3 soft nudge", "Day 14 pack pitch"],
      },
    ],
    proprImported: propr?.uniqueUsers ?? 0,
    missingEmailPropr:
      (proprRow?.count ?? 0) - (proprEmailable?.emailableCount ?? 0),
  };
}
