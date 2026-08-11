"use client";

import { useEffect, useState, useTransition } from "react";

type Mode = "instant" | "link";

type Result = {
  inviteLink?: string | null;
  mailto?: string | null;
  giftUrl?: string | null;
  message: string;
};

export function CompGiftModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("instant");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const body =
          mode === "instant"
            ? {
                action: "instant" as const,
                telegramUsername: telegramUsername.trim(),
                email: email.trim() || undefined,
                note: note.trim() || undefined,
              }
            : {
                action: "create_link" as const,
                telegramUsername: telegramUsername.trim() || undefined,
                email: email.trim() || undefined,
                note: note.trim() || undefined,
                label: "Complimentary month",
                expiresInDays: 14,
              };

        const res = await fetch("/api/internal/comp", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as {
          error?: string;
          inviteLink?: string | null;
          mailto?: string | null;
          gift?: { url?: string; mailto?: string | null };
        };
        if (!res.ok) throw new Error(data.error ?? "Comp failed");

        if (mode === "instant") {
          setResult({
            inviteLink: data.inviteLink,
            mailto: data.mailto,
            message: "1 month gifted. Share the invite or email draft below.",
          });
        } else {
          setResult({
            giftUrl: data.gift?.url ?? null,
            mailto: data.gift?.mailto ?? null,
            message: "Gift link ready — send the URL or email draft.",
          });
        }
        setTelegramUsername("");
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Comp failed");
      }
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#262626] bg-[#141414] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#fafafa]">
              Comp a month
            </h2>
            <p className="mt-1 text-[13px] text-[#a1a1aa]">
              Gift complimentary access — direct invite, shareable link, or both
              (invite + email draft).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-[#a1a1aa] hover:bg-[#1c1c1c] hover:text-white"
          >
            Esc
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#0f0f0f] p-1">
          <button
            type="button"
            onClick={() => setMode("instant")}
            className={`rounded-full px-3 py-2 text-[13px] font-semibold ${
              mode === "instant"
                ? "bg-white text-black"
                : "text-[#a1a1aa] hover:text-white"
            }`}
          >
            Instant invite
          </button>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={`rounded-full px-3 py-2 text-[13px] font-semibold ${
              mode === "link"
                ? "bg-white text-black"
                : "text-[#a1a1aa] hover:text-white"
            }`}
          >
            Gift link
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Telegram @username{mode === "instant" ? " *" : " (optional)"}
            </span>
            <input
              required={mode === "instant"}
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="@trader"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">
              Email {mode === "instant" ? "(for mailto draft)" : "(optional)"}
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@email.com"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-medium text-[#a1a1aa]">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Friend / collab / early access"
              className="w-full rounded-xl border border-[#262626] bg-[#0f0f0f] px-3 py-2.5 text-[14px] outline-none focus:border-[#52525b]"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-400">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="space-y-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-[13px] text-emerald-300">
              <p>{result.message}</p>
              {result.inviteLink ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="max-w-full break-all rounded-lg bg-black/30 px-2 py-1 text-[11px] text-[#fafafa]">
                    {result.inviteLink}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copy(result.inviteLink!)}
                    className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-black"
                  >
                    Copy invite
                  </button>
                </div>
              ) : null}
              {result.giftUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="max-w-full break-all rounded-lg bg-black/30 px-2 py-1 text-[11px] text-[#fafafa]">
                    {result.giftUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copy(result.giftUrl!)}
                    className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-black"
                  >
                    Copy gift link
                  </button>
                </div>
              ) : null}
              {result.mailto ? (
                <a
                  href={result.mailto}
                  className="inline-flex rounded-full border border-emerald-400/30 px-2.5 py-1 text-[12px] font-semibold text-emerald-200 hover:bg-emerald-500/10"
                >
                  Open email draft
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {pending
                ? "Working…"
                : mode === "instant"
                  ? "Gift month + invite"
                  : "Create gift link"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#262626] px-4 py-2.5 text-[13px] font-medium text-[#a1a1aa] hover:bg-[#1c1c1c]"
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
