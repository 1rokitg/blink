import { EmailsView } from "@/components/internal/emails-view";
import { getEmailBoard } from "@/lib/email-board.server";
import { requireInternalSession } from "@/lib/internal-session.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Emails · Internal Tools",
  robots: { index: false, follow: false },
};

export default async function EmailsPage() {
  await requireInternalSession();
  const board = await getEmailBoard();
  return <EmailsView initialBoard={board} />;
}
