/**
 * CRM tags + qualification for People profiles (operator-controlled).
 * Separate from Stripe {@link collectStripeMemberTags} billing tags.
 */

export const PERSON_QUALIFICATIONS = [
  "unqualified",
  "lead",
  "qualified",
  "nurture",
  "disqualified",
] as const;

export type PersonQualification = (typeof PERSON_QUALIFICATIONS)[number];

export const PERSON_QUALIFICATION_LABELS: Record<PersonQualification, string> =
  {
    unqualified: "Unqualified",
    lead: "Lead",
    qualified: "Qualified",
    nurture: "Nurture",
    disqualified: "Disqualified",
  };

/** Suggested CRM tags operators can apply from People. */
export const PERSON_CRM_TAG_CATALOG = [
  "Hot",
  "Warm",
  "Cold",
  "VIP",
  "Priority",
  "Upsell",
  "Churn risk",
  "Refund risk",
  "Crypto",
  "Card",
  "Substack",
  "Whop",
  "Twitter",
  "Telegram",
  "Partner",
  "Influencer",
  "Spanish",
  "English",
  "EU",
  "LATAM",
  "Early customer",
] as const;

export type PersonCrmTag = (typeof PERSON_CRM_TAG_CATALOG)[number];

export function normalizePersonQualification(
  value: unknown,
): PersonQualification {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if ((PERSON_QUALIFICATIONS as readonly string[]).includes(raw)) {
    return raw as PersonQualification;
  }
  return "unqualified";
}

export function normalizePersonCrmTags(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value.map((row) => String(row))
    : typeof value === "string"
      ? value.split(/[,|]/)
      : [];

  const out: string[] = [];
  for (const part of raw) {
    const tag = part.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!tag) continue;
    if (out.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      continue;
    }
    out.push(tag);
  }
  return out.slice(0, 24);
}

export function personQualificationTone(qualification: PersonQualification) {
  switch (qualification) {
    case "lead":
      return "border-amber-500/30 bg-amber-500/15 text-amber-200";
    case "qualified":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    case "nurture":
      return "border-sky-500/30 bg-sky-500/15 text-sky-200";
    case "disqualified":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-[#3f3f46] bg-[#18181b] text-[#a1a1aa]";
  }
}

export function personCrmTagTone(tag: string): string {
  const key = tag.trim().toLowerCase();
  if (key === "hot" || key === "priority" || key === "vip") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  if (key === "warm") {
    return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  }
  if (key === "cold") {
    return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
  if (key.includes("churn") || key.includes("refund") || key.includes("risk")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
  if (key === "crypto") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  }
  if (key === "whop" || key === "substack" || key === "partner") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-200";
  }
  if (key === "upsell" || key.includes("early")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  return "border-[#3f3f46] bg-[#18181b] text-[#d4d4d8]";
}

export function isCrmLeadQualification(qualification: PersonQualification) {
  return (
    qualification === "lead" ||
    qualification === "qualified" ||
    qualification === "nurture"
  );
}
