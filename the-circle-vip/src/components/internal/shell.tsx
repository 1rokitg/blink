"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { CircleLogo } from "@/components/circle-logo";
import {
  CommandSearch,
  SearchTrigger,
} from "@/components/internal/command-search";
import { CompGiftModal } from "@/components/internal/comp-gift-modal";
import { CreateMenuModal } from "@/components/internal/create-menu-modal";

type Props = {
  username: string;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5 12 4l8 4.5v9L12 22 4 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 22V13M4 8.5 12 13l8-4.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13 19.07"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M22 21v-2a3.5 3.5 0 0 0-2.5-3.35M16.5 3.7a3.5 3.5 0 0 1 0 6.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBadge() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 4.5 6.5v5.2c0 4.4 3 8.4 7.5 9.8 4.5-1.4 7.5-5.4 7.5-9.8V6.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m9.2 12 1.8 1.8 3.8-3.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconCash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2.5"
        y="6"
        width="19"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6 10v4M18 10v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1H7.5A2.5 2.5 0 0 0 5 10.5V18H5.5A2.5 2.5 0 0 1 3 15.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 10h12v8a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="16.5" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M4 19h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 15v-4M12 15V8M16 15v-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconStats() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.5v5l3.2 1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFunnel() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h16l-5.5 7.5V19l-5 2v-8.5L4 5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m4.5 7.5 7.5 5.5 7.5-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12.5V5.8A1.8 1.8 0 0 1 4.8 4H11.5L21 13.5l-7.5 7.5L3 12.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}

function IconStore() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 5.2 5.8A1.5 1.5 0 0 1 6.66 4.5h10.68A1.5 1.5 0 0 1 18.8 5.8L20 10.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M4 10.5h16v8A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 20v-5h5v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHandshake() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 13.5 11 16.5l2-2M3.5 12.5l3.2-3.2a2 2 0 0 1 2.5-.2L11 10.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 12.5 17.3 9.3a2 2 0 0 0-2.5-.2L13 10.5M8.5 9 10 7.5a2 2 0 0 1 2.5 0L14 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 16.5c1.2 1.6 3 2.5 5 2.5h1.5M20 16.5c-1.2 1.6-3 2.5-5 2.5H13.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h12M8 12h12M8 17h12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="4.5" cy="7" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4.5" cy="17" r="1.2" fill="currentColor" />
    </svg>
  );
}

const SECTIONS: NavSection[] = [
  {
    title: "General",
    items: [
      { href: "/internal", label: "Home", icon: <IconHome /> },
      { href: "/internal/products", label: "Products", icon: <IconBox /> },
      { href: "/internal/store", label: "Store", icon: <IconStore /> },
      {
        href: "/internal/checkout-links",
        label: "Checkout links",
        icon: <IconLink />,
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        href: "/internal/memberships",
        label: "Memberships",
        icon: <IconBadge />,
      },
      { href: "/internal/people", label: "People", icon: <IconUsers /> },
      { href: "/internal/leads", label: "Leads", icon: <IconList /> },
    ],
  },
  {
    title: "Payments",
    items: [
      { href: "/internal/earnings", label: "Earnings", icon: <IconCash /> },
      { href: "/internal/payments", label: "Payments", icon: <IconCard /> },
      { href: "/internal/crypto", label: "Crypto", icon: <IconWallet /> },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/internal/stats", label: "Stats", icon: <IconStats /> },
      { href: "/internal/funnel", label: "Funnel", icon: <IconFunnel /> },
      { href: "/internal/emails", label: "Emails", icon: <IconMail /> },
      { href: "/internal/traffic", label: "Traffic", icon: <IconChart /> },
      {
        href: "/internal/affiliates",
        label: "Affiliates",
        icon: <IconHandshake />,
      },
      { href: "/internal/promos", label: "Promo codes", icon: <IconTag /> },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/internal") {
    return pathname === "/internal" || pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MonetiseShell({ username, children }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  async function logout() {
    await fetch("/api/internal/logout", { method: "POST" });
    window.location.href = window.location.host.startsWith("internal.")
      ? "/login"
      : "/internal/login";
  }

  return (
    <div className="monetise min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      <div className="flex min-h-screen">
        <div className="hidden w-14 shrink-0 flex-col items-center border-r border-[#262626] bg-[#0a0a0a] py-4 lg:flex">
          <CircleLogo size={36} />
        </div>

        <aside
          className={`fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col border-r border-[#262626] bg-[#141414] transition-transform lg:static lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#1f1f1f] px-5 py-4">
            <div className="flex items-center gap-3">
              <CircleLogo size={32} className="lg:hidden" />
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[#71717a] uppercase">
                  The Circle
                </p>
                <p className="text-base font-semibold tracking-tight">
                  Internal Tools
                </p>
              </div>
            </div>
            <a
              href="https://rokitg.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#262626] px-3 py-1 text-xs font-medium text-[#a1a1aa] hover:bg-[#1c1c1c]"
            >
              Open shop
            </a>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="px-2 text-[11px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                  {section.title}
                </p>
                <ul className="mt-2 space-y-1">
                  {section.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2.5 rounded-full px-3 py-2 text-sm font-medium transition ${
                            active
                              ? "bg-[#1f1f1f] text-white"
                              : "text-[#a1a1aa] hover:bg-[#1c1c1c] hover:text-[#fafafa]"
                          }`}
                        >
                          <span
                            className={active ? "text-[#70a7ff]" : "text-[#71717a]"}
                          >
                            {item.icon}
                          </span>
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-[#1f1f1f] px-4 py-4">
            <p className="truncate text-sm font-medium">{username}</p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-2 text-xs font-medium text-[#a1a1aa] hover:text-[#e4e4e7]"
            >
              Log out
            </button>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-20 bg-black/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-[#262626] bg-[#0a0a0a]/90 px-4 backdrop-blur sm:px-6">
            <button
              type="button"
              className="rounded-full border border-[#262626] px-3 py-1.5 text-sm lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              Menu
            </button>
            <div className="min-w-0 flex-1 md:max-w-md">
              <SearchTrigger onClick={() => setSearchOpen(true)} />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setCompOpen(true)}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/15"
              >
                Comp
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
              >
                Create
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      <CreateMenuModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onOpenComp={() => setCompOpen(true)}
      />
      <CompGiftModal open={compOpen} onClose={() => setCompOpen(false)} />
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
