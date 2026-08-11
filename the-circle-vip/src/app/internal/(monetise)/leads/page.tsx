import { LeadsView } from "@/components/internal/leads-view";
import {
  isMemberConversionLead,
  memberToLeadRecord,
} from "@/lib/lead-classification";
import { tagLeads } from "@/lib/lead-cross-tags.server";
import { peopleHrefForLead } from "@/lib/lead-people";
import { listLeads } from "@/lib/leads.server";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";
import { getSubstackMetaByLeadId } from "@/lib/substack-leads.server";
import {
  listWhopLeadsFromStripe,
  listWhopMembersFromStripe,
} from "@/lib/whop-stripe.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Leads · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function LeadsPage() {
  await requireInternalSession();
  const [manual, whop, whopMembers, stats] = await Promise.all([
    listLeads(500),
    listWhopLeadsFromStripe(200),
    listWhopMembersFromStripe(300),
    getInternalDashboardStats(),
  ]);

  // Stripe Whop customers are source of truth for migrants; manual CRM leads fill gaps.
  const byId = new Map(whop.map((lead) => [lead.id, lead]));
  for (const lead of manual) {
    if (lead.source === "whop_member") continue;
    byId.set(lead.id, lead);
  }

  // Trialing Stripe / manual_grant members are conversion leads.
  for (const member of stats.members) {
    if (!isMemberConversionLead(member)) continue;
    // Whop unpaid already projected above as status=new.
    if (member.source === "whop_member") continue;
    const lead = memberToLeadRecord(member, "new");
    if (!byId.has(lead.id)) byId.set(lead.id, lead);
  }

  const leads = [...byId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const peopleHrefs: Record<string, string> = {};
  for (const lead of leads) {
    const href = peopleHrefForLead(lead, stats.members);
    if (href) peopleHrefs[lead.id] = href;
  }

  const [tagsByLeadId, substackByLeadId] = await Promise.all([
    tagLeads(leads, {
      whopMembers,
      circleMembers: stats.members,
    }),
    getSubstackMetaByLeadId(leads),
  ]);

  return (
    <LeadsView
      initialLeads={leads}
      peopleHrefs={peopleHrefs}
      tagsByLeadId={tagsByLeadId}
      substackByLeadId={substackByLeadId}
    />
  );
}
