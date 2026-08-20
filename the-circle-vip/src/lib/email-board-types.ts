import type {
  EmailAudienceId,
  EmailCampaignId,
  EmailSenderId,
} from "@/lib/email-campaigns";

export type EmailBoardTab =
  | "overview"
  | "audiences"
  | "campaigns"
  | "sends"
  | "automation";

export type EmailAudienceMember = {
  id: string;
  email: string | null;
  name: string | null;
  telegramUsername: string | null;
  source: string;
  status: string;
  createdAt: string;
  /** 0–100 priority score for convert / send order. */
  score: number;
  scoreReasons: string[];
  metaSummary: string | null;
  lifetimeUsd: number | null;
  opens6mo: number | null;
  activity30d: number | null;
};

export type EmailAudienceBoardRow = {
  id: EmailAudienceId;
  label: string;
  description: string;
  emailable: boolean;
  count: number;
  emailableCount: number;
  /** Share of segment that already converted to member. */
  memberPct: number;
  avgScore: number;
  topReasons: string[];
  sample: EmailAudienceMember[];
};

export type EmailCampaignBoardRow = {
  id: EmailCampaignId;
  title: string;
  subject: string;
  preview: string;
  senderId: EmailSenderId;
  audienceId: EmailAudienceId;
  status: "draft" | "ready";
  audienceCount: number;
  audienceEmailable: number;
  ctaLabel: string;
  ctaHref: string;
  bodyHtml: string;
  bodyText: string;
  /** Blockers before a real blast can ship. */
  blockers: string[];
  readiness: "blocked" | "needs_review" | "ready";
};

export type EmailPipelineKpis = {
  emailableTotal: number;
  audiences: number;
  campaignsReady: number;
  campaignsDraft: number;
  missingEmail: number;
  highIntent: number;
  substackEngaged: number;
  whopMigrationPool: number;
  waitlistFresh7d: number;
  circleMembersEmailable: number;
};

export type EmailDeliverabilitySnapshot = {
  resendConfigured: boolean;
  domain: string;
  senders: { id: EmailSenderId; from: string; label: string; purpose: string }[];
  /** Placeholder until Resend webhooks land. */
  webhookConfigured: boolean;
  lastTestAt: string | null;
  notes: string[];
};

export type EmailSendLogEntry = {
  id: string;
  kind: "test" | "blast" | "automation";
  campaignId: EmailCampaignId | null;
  to: string;
  status: "queued" | "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed";
  createdAt: string;
  resendId: string | null;
  note: string | null;
};

export type EmailAutomationStub = {
  id: string;
  title: string;
  trigger: string;
  audienceHint: string;
  status: "planned" | "draft" | "live";
  steps: string[];
};

export type EmailBoard = {
  generatedAt: string;
  kpis: EmailPipelineKpis;
  deliverability: EmailDeliverabilitySnapshot;
  audiences: EmailAudienceBoardRow[];
  campaigns: EmailCampaignBoardRow[];
  /** Empty until blast/webhook ledger ships — UI still renders the table. */
  recentSends: EmailSendLogEntry[];
  automations: EmailAutomationStub[];
  proprImported: number;
  missingEmailPropr: number;
};
