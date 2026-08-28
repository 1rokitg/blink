"use client";

import { useEffect, useState } from "react";
import { Menu, X, TrendingUp } from "lucide-react";

const links = [
  { label: "Inside", href: "#inside" },
  { label: "Mentor", href: "#mentor" },
  { label: "What You Get", href: "#included" },
  { label: "Apply", href: "#apply" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-ink-950/80 backdrop-blur-xl border-b border-white/[0.06]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-lg shadow-accent-500/20 transition-transform group-hover:scale-105">
            <TrendingUp className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg font-700 tracking-tight text-white">
            Social<span className="text-accent-400"> Capital</span>
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-500 text-ink-200 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://whop.com/rokitg/exp_WvNuGuiGDJd0Ig/app/"
            className="rounded-full bg-accent-500 px-5 py-2.5 text-sm font-600 text-ink-950 shadow-lg shadow-accent-500/20 transition-all hover:bg-accent-400 hover:shadow-accent-400/30"
          >
            Apply now
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-100 transition-colors hover:bg-white/5 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden border-t border-white/[0.06] bg-ink-950/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 md:hidden ${
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-5 py-4">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-500 text-ink-200 transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://whop.com/rokitg/exp_WvNuGuiGDJd0Ig/app/"
            onClick={() => setOpen(false)}
            className="mt-2 rounded-full bg-accent-500 px-5 py-3 text-center text-sm font-600 text-ink-950"
          >
            Apply Now
          </a>
        </div>
      </div>
    </header>
  );
}
