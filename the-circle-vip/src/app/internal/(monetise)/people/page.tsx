import { PeopleView } from "@/components/internal/people-view";
import {
  isMemberConversionLead,
  memberToLeadRecord,
} from "@/lib/lead-classification";
import { mergeLeadStubsIntoMembers } from "@/lib/lead-people";
import { listLeads } from "@/lib/leads.server";
import { requireInternalSession } from "@/lib/internal-session.server";
import { getInternalDashboardStats } from "@/lib/internal-stats.server";
import { listPersonEnrichments } from "@/lib/people-enrichment.server";
import { listWhopLeadsFromStripe } from "@/lib/whop-stripe.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "People · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function PeoplePage() {
  await requireInternalSession();
  const [stats, enrichments, manual, whop] = await Promise.all([
    getInternalDashboardStats(),
    listPersonEnrichments(400),
    listLeads(200),
    listWhopLeadsFromStripe(200),
  ]);

  const byId = new Map(whop.map((lead) => [lead.id, lead]));
  for (const lead of manual) {
    if (lead.source === "whop_member") continue;
    byId.set(lead.id, lead);
  }
  for (const member of stats.members) {
    if (!isMemberConversionLead(member)) continue;
    if (member.source === "whop_member") continue;
    const lead = memberToLeadRecord(member, "new");
    if (!byId.has(lead.id)) byId.set(lead.id, lead);
  }

  const members = mergeLeadStubsIntoMembers(stats.members, [
    ...byId.values(),
  ]);

  return (
    <PeopleView
      people={stats.people}
      members={members}
      initialEnrichments={enrichments}
    />
  );
}
