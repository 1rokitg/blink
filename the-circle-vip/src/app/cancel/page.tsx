import { getRequestDictionary } from "@/lib/i18n/server";
import { localizePath } from "@/lib/i18n/path";

export default async function CancelPage() {
  const { locale, dictionary } = await getRequestDictionary();
  const copy = dictionary.cancel;

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 circle-atmosphere" />
      <div className="relative w-full max-w-lg circle-panel rounded-3xl p-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm text-white/65">{copy.body}</p>
        <a
          href={localizePath(locale, "/join#checkout")}
          className="circle-cta mt-8 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold text-white"
        >
          {copy.back}
        </a>
      </div>
    </main>
  );
}
