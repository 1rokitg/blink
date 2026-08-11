"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export function InternalLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/internal/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!response.ok) {
          setError(
            response.status === 401
              ? "Invalid credentials."
              : "Unable to sign in.",
          );
          return;
        }
        router.replace(
          window.location.host.startsWith("internal.") ? "/" : "/internal",
        );
        router.refresh();
      } catch {
        setError("Unable to sign in.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[#a1a1aa]">Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="w-full rounded-xl border border-[#262626] bg-[#0a0a0a] px-3 py-2.5 text-sm text-[#fafafa] outline-none focus:border-[#52525b]"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[#a1a1aa]">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-[#262626] bg-[#0a0a0a] px-3 py-2.5 text-sm text-[#fafafa] outline-none focus:border-[#52525b]"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-60"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </form>
  );
}
