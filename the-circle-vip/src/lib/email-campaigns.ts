/** Email marketing types for Circle (rokitg.com). */

export type EmailSenderId = "info" | "members" | "hello";

export type EmailSender = {
  id: EmailSenderId;
  from: string;
  label: string;
  purpose: string;
};

export const EMAIL_SENDERS: EmailSender[] = [
  {
    id: "info",
    from: "The Circle <info@rokitg.com>",
    label: "info@rokitg.com",
    purpose: "Marketing, waitlist, partner outreach",
  },
  {
    id: "members",
    from: "The Circle <members@rokitg.com>",
    label: "members@rokitg.com",
    purpose: "Member claims, Whop migration, billing notices",
  },
  {
    id: "hello",
    from: "Rokitg <hello@rokitg.com>",
    label: "hello@rokitg.com",
    purpose: "General + store cross-sell",
  },
];

export type EmailAudienceId =
  | "waitlist"
  | "whop_members"
  | "whop_unpaid"
  | "substack"
  | "substack_free"
  | "propr"
  | "propr_emailable"
  | "all_emailable";

export type EmailAudience = {
  id: EmailAudienceId;
  label: string;
  description: string;
  /** True when this segment can receive email today. */
  emailable: boolean;
};

export const EMAIL_AUDIENCES: EmailAudience[] = [
  {
    id: "waitlist",
    label: "Waitlist / landing emails",
    description: "Captured on rokitg.com with a real email address.",
    emailable: true,
  },
  {
    id: "substack",
    label: "Substack (all)",
    description: "rokitg's circle subscriber export — free + paid.",
    emailable: true,
  },
  {
    id: "substack_free",
    label: "Substack free → convert",
    description: "Free Substack readers — prime Circle / store conversion list.",
    emailable: true,
  },
  {
    id: "whop_members",
    label: "Whop members (paid)",
    description: "Stripe customers tagged whop_member with email — migration priority.",
    emailable: true,
  },
  {
    id: "whop_unpaid",
    label: "Whop unpaid / leads",
    description: "Whop profiles without paid invoice — convert or migrate.",
    emailable: true,
  },
  {
    id: "propr",
    label: "Propr partner leads",
    description: "Referral activity usernames — need email enrichment before send.",
    emailable: false,
  },
  {
    id: "propr_emailable",
    label: "Propr (with email)",
    description: "Propr leads after you paste/enrich emails.",
    emailable: true,
  },
  {
    id: "all_emailable",
    label: "All emailable leads",
    description: "Every CRM lead with an email, excluding lost.",
    emailable: true,
  },
];

export type EmailCampaignId =
  | "whop_migration"
  | "circle_convert"
  | "store_convert"
  | "propr_intro"
  | "substack_convert";

export type EmailCampaign = {
  id: EmailCampaignId;
  title: string;
  subject: string;
  preview: string;
  senderId: EmailSenderId;
  audienceId: EmailAudienceId;
  ctaLabel: string;
  ctaHref: string;
  bodyHtml: string;
  bodyText: string;
  status: "draft" | "ready";
};

export const EMAIL_CAMPAIGNS: EmailCampaign[] = [
  {
    id: "whop_migration",
    title: "Whop → The Circle migration",
    subject: "The Circle is moving off Whop — claim your access",
    preview: "Same Circle. New home on rokitg.com. Takes one minute.",
    senderId: "members",
    audienceId: "whop_members",
    ctaLabel: "Claim membership",
    ctaHref: "https://rokitg.com/join",
    status: "ready",
    bodyText: `Hey {{name}},

The Circle is migrating away from Whop.

Your membership continues on rokitg.com — claim access with the email you used on Whop, or pay with USDC / card if you need a fresh seat.

Claim: https://rokitg.com/join

Questions? Reply to this email.

— The Circle`,
    bodyHtml: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.55;color:#111;max-width:560px">
<p>Hey {{name}},</p>
<p><strong>The Circle is migrating away from Whop.</strong></p>
<p>Your membership continues on <a href="https://rokitg.com">rokitg.com</a> — claim access with the email you used on Whop, or start fresh with USDC / card.</p>
<p style="margin:28px 0"><a href="https://rokitg.com/join" style="background:#ff6a00;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">Claim membership</a></p>
<p style="color:#555;font-size:14px">Questions? Reply to this email.<br/>— The Circle</p>
</div>`,
  },
  {
    id: "circle_convert",
    title: "Convert waitlist → paid Circle",
    subject: "You're on the list — doors are open",
    preview: "Join The Circle on rokitg.com. USDC or card.",
    senderId: "info",
    audienceId: "waitlist",
    ctaLabel: "Join The Circle",
    ctaHref: "https://rokitg.com/join",
    status: "ready",
    bodyText: `Hey {{name}},

You signed up for The Circle updates.

Membership is live — join the private group on rokitg.com (USDC or card, Telegram access after pay).

Join: https://rokitg.com/join

— The Circle`,
    bodyHtml: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.55;color:#111;max-width:560px">
<p>Hey {{name}},</p>
<p>You signed up for The Circle updates.</p>
<p>Membership is live — join the private group on rokitg.com (USDC or card).</p>
<p style="margin:28px 0"><a href="https://rokitg.com/join" style="background:#ff6a00;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">Join The Circle</a></p>
<p style="color:#555;font-size:14px">— The Circle</p>
</div>`,
  },
  {
    id: "store_convert",
    title: "Cross-sell Internet Culture store",
    subject: "New drops from Internet Culture",
    preview: "Merch at store.rokitg.com — same world as The Circle.",
    senderId: "hello",
    audienceId: "all_emailable",
    ctaLabel: "Shop the store",
    ctaHref: "https://store.rokitg.com",
    status: "ready",
    bodyText: `Hey {{name}},

Internet Culture is live at store.rokitg.com — merch from the same world as The Circle.

Shop: https://store.rokitg.com

— Rokitg`,
    bodyHtml: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.55;color:#111;max-width:560px">
<p>Hey {{name}},</p>
<p>Internet Culture is live at <a href="https://store.rokitg.com">store.rokitg.com</a> — merch from the same world as The Circle.</p>
<p style="margin:28px 0"><a href="https://store.rokitg.com" style="background:#111;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">Shop the store</a></p>
<p style="color:#555;font-size:14px">— Rokitg</p>
</div>`,
  },
  {
    id: "propr_intro",
    title: "Propr partner follow-up",
    subject: "You're in — finish setup on The Circle",
    preview: "Thanks for coming through Propr. Here's how to join.",
    senderId: "info",
    audienceId: "propr_emailable",
    ctaLabel: "Open The Circle",
    ctaHref: "https://rokitg.com/join?utm_source=propr&utm_campaign=partner_propr",
    status: "draft",
    bodyText: `Hey {{name}},

You came through our Propr partner link.

The Circle lives on rokitg.com now — join with USDC or card and get Telegram access instantly.

Join: https://rokitg.com/join?utm_source=propr&utm_campaign=partner_propr

— The Circle`,
    bodyHtml: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.55;color:#111;max-width:560px">
<p>Hey {{name}},</p>
<p>You came through our Propr partner link.</p>
<p>The Circle lives on rokitg.com now — join with USDC or card and get Telegram access instantly.</p>
<p style="margin:28px 0"><a href="https://rokitg.com/join?utm_source=propr&utm_campaign=partner_propr" style="background:#ff6a00;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">Open The Circle</a></p>
<p style="color:#555;font-size:14px">— The Circle</p>
</div>`,
  },
  {
    id: "substack_convert",
    title: "Substack free → Circle",
    subject: "From Substack to The Circle",
    preview: "You already follow rokitg's circle — unlock the private group.",
    senderId: "info",
    audienceId: "substack_free",
    ctaLabel: "Join The Circle",
    ctaHref: "https://rokitg.com/join?utm_source=substack&utm_campaign=rokitgs_circle",
    status: "ready",
    bodyText: `Hey {{name}},

You're on the Substack list for rokitg's circle.

The private Circle is live on rokitg.com — USDC or card, Telegram access after pay. Merch lives at store.rokitg.com.

Join: https://rokitg.com/join?utm_source=substack&utm_campaign=rokitgs_circle

— The Circle`,
    bodyHtml: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.55;color:#111;max-width:560px">
<p>Hey {{name}},</p>
<p>You're on the Substack list for <strong>rokitg's circle</strong>.</p>
<p>The private Circle is live on rokitg.com — USDC or card, Telegram access after pay. Merch: <a href="https://store.rokitg.com">store.rokitg.com</a>.</p>
<p style="margin:28px 0"><a href="https://rokitg.com/join?utm_source=substack&utm_campaign=rokitgs_circle" style="background:#ff6a00;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">Join The Circle</a></p>
<p style="color:#555;font-size:14px">— The Circle</p>
</div>`,
  },
];

export function renderEmailTemplate(
  template: string,
  vars: { name?: string | null; email?: string | null },
) {
  const name = vars.name?.trim() || vars.email?.split("@")[0] || "there";
  return template
    .replaceAll("{{name}}", name)
    .replaceAll("{{email}}", vars.email?.trim() || "");
}
