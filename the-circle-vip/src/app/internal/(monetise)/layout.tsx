import { MonetiseShell } from "@/components/internal/shell";
import { requireInternalSession } from "@/lib/internal-session.server";

export default async function MonetiseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireInternalSession();
  return (
    <MonetiseShell username={session.username}>{children}</MonetiseShell>
  );
}
