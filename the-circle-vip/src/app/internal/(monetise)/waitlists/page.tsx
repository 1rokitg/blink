import { redirect } from "next/navigation";

import { requireInternalSession } from "@/lib/internal-session.server";

export const dynamic = "force-dynamic";

/** Waitlists fold into the Leads pipeline for now. */
export default async function WaitlistsPage() {
  await requireInternalSession();
  redirect("/internal/leads");
}
