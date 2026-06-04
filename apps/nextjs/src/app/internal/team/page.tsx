import { AdminDashboard } from "~/components/blink/admin-dashboard";

export const dynamic = "force-dynamic";

export default function InternalTeamPage() {
  return <AdminDashboard section="team" />;
}
