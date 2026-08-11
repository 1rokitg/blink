import { redirect } from "next/navigation";

import { requireInternalSession } from "@/lib/internal-session.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "People · Internal Tools",
  robots: { index: false, follow: false },
};

/** Legacy /internal/users → People profiler. */
export default async function UsersRedirectPage() {
  await requireInternalSession();
  redirect("/internal/people");
}
