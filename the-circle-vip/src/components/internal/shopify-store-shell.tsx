"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ShopifyStoreSnapshot } from "@/lib/shopify-types";

const POLL_MS = 30_000;

export const STORE_TABS = [
  { href: "/internal/store", label: "Overview", id: "overview" },
  {
    href: "/internal/store/submissions",
    label: "Submissions",
    id: "submissions",
  },
  { href: "/internal/store/customers", label: "Customers", id: "customers" },
  { href: "/internal/store/orders", label: "Orders", id: "orders" },
  { href: "/internal/store/payments", label: "Payments", id: "payments" },
  { href: "/internal/store/products", label: "Products", id: "products" },
] as const;

function emptySnapshot(): ShopifyStoreSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    configured: false,
    ok: false,
    error: null,
    apiVersion: "2026-07",
    storeDomain: "store.rokitg.com",
    adminShopDomain: null,
    domains: [],
    publicMeta: null,
    analytics: null,
    admin: null,
  };
}

function formatWhen(iso: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type StoreContextValue = {
  snapshot: ShopifyStoreSnapshot;
  error: string | null;
  refreshing: boolean;
  reload: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function useShopifyStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useShopifyStore must be used inside ShopifyStoreShell");
  }
  return ctx;
}

function tabIsActive(pathname: string, href: string) {
  if (href === "/internal/store") {
    return pathname === "/internal/store" || pathname === "/store";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShopifyStoreShell({
  initial,
  children,
}: {
  initial?: ShopifyStoreSnapshot;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<ShopifyStoreSnapshot>(
    initial ?? emptySnapshot(),
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/internal/shopify", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as ShopifyStoreSnapshot & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load Shopify store");
      }
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load(true);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, snapshot.admin]);

  const value = useMemo(
    () => ({
      snapshot,
      error,
      refreshing,
      reload: () => {
        void load(false);
      },
    }),
    [snapshot, error, refreshing, load],
  );

  const submissionsCount = snapshot.admin?.submissions?.length ?? 0;
  const customersCount = snapshot.admin?.customers?.length ?? 0;

  return (
    <StoreContext.Provider value={value}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#70a7ff] uppercase">
                Shopify · source of truth
              </p>
              <h1 className="mt-1 text-[32px] font-semibold tracking-tight text-[#fafafa]">
                Store
              </h1>
              <p className="mt-1 max-w-2xl text-[14px] text-[#a1a1aa]">
                Form submissions, customers, orders, and payments — linked so
                each lead traces back to a Shopify customer. Membership SKUs
                stay under Products (Stripe).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://${snapshot.storeDomain}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#262626] bg-[#141414] px-3 py-1.5 text-[12px] font-medium text-[#fafafa] transition hover:bg-[#1c1c1c]"
              >
                Open storefront
              </a>
              <span className="text-[12px] text-[#71717a]">
                {formatWhen(snapshot.generatedAt)}
                {refreshing ? " · refreshing…" : " · 30s"}
              </span>
              <button
                type="button"
                onClick={() => void load(false)}
                className="cursor-pointer rounded-full border border-[#262626] bg-[#141414] px-3 py-1.5 text-[12px] font-medium text-[#fafafa] transition hover:bg-[#1c1c1c]"
              >
                Refresh
              </button>
            </div>
          </div>

          <nav
            aria-label="Store sections"
            className="flex flex-wrap gap-1.5 border-b border-[#1f1f1f] pb-3"
          >
            {STORE_TABS.map((tab) => {
              const active = tabIsActive(pathname, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
                    active
                      ? "border-[#70a7ff]/40 bg-[#70a7ff]/10 text-[#fafafa]"
                      : "border-transparent text-[#a1a1aa] hover:border-[#262626] hover:bg-[#141414] hover:text-[#fafafa]"
                  }`}
                >
                  {tab.label}
                  {tab.id === "submissions" && submissionsCount > 0 ? (
                    <span className="ml-1.5 text-[#70a7ff]">
                      {submissionsCount}
                    </span>
                  ) : null}
                  {tab.id === "customers" && customersCount > 0 ? (
                    <span className="ml-1.5 text-[#71717a]">
                      {customersCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
            {error}
          </div>
        ) : null}

        {!snapshot.configured ||
        (snapshot.error &&
          /app_not_installed|token exchange/i.test(snapshot.error)) ? (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-[13px] text-amber-100/90">
            <p className="font-semibold text-amber-200">
              Connect Shopify Dev Dashboard app
            </p>
            <p className="mt-2 text-amber-100/75">
              Install <code className="text-amber-50">rokitg</code> on the shop
              (with updated scopes) and set{" "}
              <code className="text-amber-50">SHOPIFY_CLIENT_ID</code> /{" "}
              <code className="text-amber-50">SHOPIFY_CLIENT_SECRET</code>.
            </p>
            {snapshot.error ? (
              <p className="mt-2 text-amber-100/60">{snapshot.error}</p>
            ) : null}
          </div>
        ) : null}

        {snapshot.configured && !snapshot.ok && snapshot.error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
            {snapshot.error}
          </div>
        ) : null}

        {children}
      </div>
    </StoreContext.Provider>
  );
}
