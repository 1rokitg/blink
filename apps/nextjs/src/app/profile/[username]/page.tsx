import Link from "next/link";

import {
  ChevronRight,
  Dot,
  Ellipsis,
  Search,
} from "lucide-react";

function avatarUrl(id: string, size = 80) {
  return `https://avatar.vercel.sh/${encodeURIComponent(id)}.png?size=${size}`;
}

export default async function ProfilePage(props: {
  params: Promise<{ username: string }>;
}) {
  const params = await props.params;
  const username = decodeURIComponent(params.username);

  return (
    <main className="min-h-screen bg-background px-3 pb-8 pt-3 text-[#f2f4f7]">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1900px] grid-cols-[366px_1fr] gap-3">
        <aside className="flex min-h-[calc(100vh-7rem)] flex-col gap-2.5">
          <div className="flex h-[68px] items-end px-1 py-1">
            <h1 className="text-5xl font-bold tracking-[-0.04em] text-white">
              blink
            </h1>
          </div>
          <section className="glass-panel p-4">
            <div className="flex items-center gap-3">
              <img src={avatarUrl(username, 72)} alt="Profile avatar" className="size-14 rounded-full border border-white/20" />
              <div>
                <p className="text-2xl font-semibold text-white">{username}</p>
                <p className="text-sm text-white/55">@{username.toLowerCase()}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Link href="/trade/BTC" className="block rounded-[10px] border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/85 hover:bg-white/[0.06]">
                Terminal
              </Link>
              <button type="button" className="w-full rounded-[10px] border border-[#41ddb670] bg-[#41ddb626] px-3 py-2 text-left text-sm text-white">
                Balances
              </button>
              <button type="button" className="w-full rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2 text-left text-sm text-white/60">
                Activity
              </button>
            </div>
          </section>
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex h-[68px] items-center justify-center">
            <div className="relative w-full max-w-[740px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45" />
              <input
                className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0c101c] pl-9 pr-3 text-base outline-none placeholder:text-white/35"
                placeholder="Search profile assets..."
              />
            </div>
          </div>

          <section className="glass-panel mx-auto w-full max-w-[980px] p-6">
            <p className="text-xl text-white/70">Total balance</p>
            <h1 className="mt-2 text-6xl font-semibold">$114.30 USD</h1>

            <div className="mt-5 flex items-center gap-3">
              <button type="button" className="whop-blue-btn h-10 rounded-xl px-5">
                Deposit
              </button>
              <button type="button" className="whop-blue-btn h-10 rounded-xl px-5">
                Withdraw
              </button>
              <button type="button" className="whop-blue-btn h-10 rounded-xl px-5">
                Move
              </button>
              <button type="button" className="whop-secondary-btn h-10 rounded-xl px-3">
                <Ellipsis className="size-4" />
              </button>
            </div>

            <div className="mt-6 h-4 overflow-hidden rounded bg-[#4b4f56]">
              <div className="flex h-full w-full">
                <div className="w-[30%] bg-[#666b72]" />
                <div className="w-[2%] bg-[#2b8dcc]" />
                <div className="w-[68%] bg-[#42b35e]" />
              </div>
            </div>

            <div className="mt-5 space-y-3 text-2xl">
              {[
                ["Available cash", "-$26.92", "#2160ff"],
                ["Pending", "$40.02", "#6a6d73"],
                ["Cards", "$1.74", "#1f8fd4"],
                ["Treasury", "$99.46", "#44b760"],
              ].map(([label, value, color]) => (
                <div key={label} className="flex items-center justify-between">
                  <p className="inline-flex items-center gap-2 text-white/85">
                    <span className="size-3 rounded-sm" style={{ backgroundColor: color }} />
                    {label}
                  </p>
                  <p className="font-medium text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 border-b border-white/10">
              <div className="flex items-center gap-8 text-2xl">
                <button type="button" className="border-b-2 border-[#276cff] pb-3 text-white">Balances</button>
                <button type="button" className="pb-3 text-white/45">All activity</button>
                <button type="button" className="pb-3 text-white/45">Withdrawals</button>
                <button type="button" className="pb-3 text-white/45">Top ups</button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {[
                ["Cash", "USD", "$13.10"],
                ["Cards", "USD", "$1.74"],
                ["Treasury", "USDT · Bitcoin · Gold", "$99.46"],
              ].map(([title, sub, value]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-[#0f1114] p-5"
                >
                  <p className="text-4xl font-semibold">{title}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-2xl text-white/80">{sub}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-2xl font-medium">{value}</p>
                      <ChevronRight className="size-4 text-white/45" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-7 text-center text-sm text-white/35">
              Blink is a terminal product, not a bank. Balances shown are for prototype display.
            </p>
            <div className="mt-4 flex justify-center">
              <Link href="/trade/BTC" className="inline-flex items-center text-sm text-white/55 hover:text-white">
                <Dot className="size-4" />
                Back to trading
              </Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
