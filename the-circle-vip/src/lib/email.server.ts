import "server-only";

import {
  EMAIL_CAMPAIGNS,
  EMAIL_SENDERS,
  renderEmailTemplate,
  type EmailCampaignId,
  type EmailSenderId,
} from "@/lib/email-campaigns";
import { isEmailCaptureLead } from "@/lib/funnel-stats";
import { listLeads } from "@/lib/leads.server";
import { listWhopLeadsFromStripe } from "@/lib/whop-stripe.server";

function trimEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export function getResendConfig() {
  const apiKey = trimEnv("RESEND_API_KEY");
  return {
    configured: Boolean(apiKey),
    apiKey,
    domain: trimEnv("RESEND_DOMAIN") || "rokitg.com",
  };
}

export async function getEmailAudienceCounts() {
  const [manual, whop] = await Promise.all([
    listLeads(500),
    listWhopLeadsFromStripe(300),
  ]);

  const waitlist = manual.filter(
    (l) => isEmailCaptureLead(l) && Boolean(l.email),
  );
  const substack = manual.filter((l) => l.source === "substack");
  const substackFree = substack.filter(
    (l) => l.email && l.status !== "member" && l.status !== "lost",
  );
  const propr = manual.filter((l) => l.source === "propr");
  const proprEmailable = propr.filter((l) => Boolean(l.email));
  const whopPaid = whop.filter(
    (l) => l.status === "member" && Boolean(l.email),
  );
  const whopUnpaid = whop.filter(
    (l) => l.status !== "member" && Boolean(l.email),
  );
  const allEmailable = [
    ...manual.filter((l) => l.email && l.status !== "lost"),
    ...whop.filter(
      (l) =>
        l.email &&
        l.status !== "lost" &&
        !manual.some((m) => m.email && m.email === l.email),
    ),
  ];

  return {
    waitlist: waitlist.length,
    substack: substack.length,
    substack_free: substackFree.length,
    whop_members: whopPaid.length,
    whop_unpaid: whopUnpaid.length,
    propr: propr.length,
    propr_emailable: proprEmailable.length,
    all_emailable: allEmailable.length,
    missingEmailPropr: propr.length - proprEmailable.length,
  };
}

export async function sendTestEmail(input: {
  to: string;
  campaignId: EmailCampaignId;
  senderId?: EmailSenderId;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const config = getResendConfig();
  if (!config.configured) {
    return {
      ok: false,
      error:
        "Set RESEND_API_KEY (and verify rokitg.com in Resend) before sending.",
    };
  }

  const campaign = EMAIL_CAMPAIGNS.find((c) => c.id === input.campaignId);
  if (!campaign) return { ok: false, error: "Unknown campaign." };

  const sender =
    EMAIL_SENDERS.find((s) => s.id === (input.senderId || campaign.senderId)) ??
    EMAIL_SENDERS[0]!;

  const html = renderEmailTemplate(campaign.bodyHtml, {
    name: input.to.split("@")[0],
    email: input.to,
  });
  const text = renderEmailTemplate(campaign.bodyText, {
    name: input.to.split("@")[0],
    email: input.to,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender.from,
        to: [input.to],
        subject: `[TEST] ${campaign.subject}`,
        html,
        text,
        tags: [
          { name: "campaign", value: campaign.id },
          { name: "kind", value: "test" },
        ],
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      id?: string;
      message?: string;
      error?: { message?: string };
    } | null;
    if (!res.ok || !body?.id) {
      return {
        ok: false,
        error:
          body?.error?.message ||
          body?.message ||
          `Resend ${res.status}`,
      };
    }
    return { ok: true, id: body.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Send failed.",
    };
  }
}
