import { CircleLogo } from "@/components/circle-logo";
import { DashboardPortalButton } from "@/components/dashboard-portal-button";
import { localizePath } from "@/lib/i18n/path";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getTelegramSession } from "@/lib/telegram-session";
import { isTelegramLoginConfigured } from "@/lib/telegram";

export default async function DashboardPage() {
  const telegram = await getTelegramSession();
  const { locale, dictionary } = await getRequestDictionary();
  const copy = dictionary.dashboard;

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 circle-atmosphere" />
      <div className="relative w-full max-w-lg circle-panel rounded-3xl p-8">
        <CircleLogo size={48} />
        <p className="mt-4 text-xs font-bold tracking-[0.2em] text-[#ff9a4d] uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {dictionary.common.siteName}
        </h1>
        {telegram ? (
          <p className="mt-3 text-sm text-white/65">
            {copy.signedInAs}{" "}
            <span className="text-white">
              {telegram.username
                ? `@${telegram.username}`
                : telegram.firstName || telegram.id}
            </span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-white/65">{copy.connectHint}</p>
        )}

        <div className="mt-8 space-y-3">
          {telegram ? <DashboardPortalButton /> : null}
          {!telegram && isTelegramLoginConfigured() ? (
            <a
              href={localizePath(locale, "/join#checkout")}
              className="flex w-full items-center justify-center rounded-2xl bg-[#0b7cff] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0866d6]"
            >
              {copy.connectTelegram}
            </a>
          ) : null}
          <a
            href={localizePath(locale, "/")}
            className="flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            {copy.backHome}
          </a>
        </div>
      </div>
    </main>
  );
}
