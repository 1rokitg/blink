"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { AreaLineChart } from "@/components/internal/charts";
import { useShopifyStore } from "@/components/internal/shopify-store-shell";
import type { ShopifyCustomerRow } from "@/lib/shopify-types";

function formatMoney(amount: number | string, currency: string) {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
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

function formatPct(rate: number | null) {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(0)}%`;
}

export function customerAnchor(id: number) {
  return `customer-${id}`;
}

export function submissionAnchor(id: string) {
  return id.startsWith("submission-") ? id : `submission-${id}`;
}

function CustomerLink({
  customerId,
  children,
}: {
  customerId: number | null | undefined;
  children: ReactNode;
}) {
  if (!customerId) return <span>{children}</span>;
  return (
    <Link
      href={`/internal/store/customers#${customerAnchor(customerId)}`}
      className="text-[#70a7ff] underline-offset-2 transition hover:underline"
    >
      {children}
    </Link>
  );
}

function SubmissionLink({
  customerId,
  children,
}: {
  customerId: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={`/internal/store/submissions#${submissionAnchor(`submission-${customerId}`)}`}
      className="text-[#70a7ff] underline-offset-2 transition hover:underline"
    >
      {children}
    </Link>
  );
}

function SourcePill({ source }: { source: ShopifyCustomerRow["source"] }) {
  const label =
    source === "shopify_forms"
      ? "Forms"
      : source === "online_store"
        ? "Store"
        : "Other";
  const tone =
    source === "shopify_forms"
      ? "border-sky-500/25 bg-sky-500/10 text-sky-200"
      : source === "online_store"
        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
        : "border-[#262626] bg-[#0f0f0f] text-[#a1a1aa]";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${tone}`}
    >
      {label}
    </span>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="text-[#52525b]">—</span>;
  }
  return (
    <div className="flex max-w-[220px] flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-md border border-[#262626] bg-[#141414] px-1.5 py-0.5 text-[10px] text-[#a1a1aa]"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-4">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[#71717a] uppercase">
        {label}
      </p>
      <p className="mt-2 truncate text-[24px] font-semibold tracking-tight text-[#fafafa]">
        {value}
      </p>
      <p className="mt-1 truncate text-[12px] text-[#71717a]">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-[#fafafa]">{title}</h2>
        <p className="text-[12px] text-[#71717a]">{body}</p>
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mb-1">
      <h2 className="text-[16px] font-semibold text-[#fafafa]">{title}</h2>
      {body ? <p className="mt-1 text-[13px] text-[#71717a]">{body}</p> : null}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-56 place-items-center rounded-xl border border-dashed border-[#262626] text-[13px] text-[#71717a]">
      No activity in this range yet
    </div>
  );
}

function ScopeHint({ error }: { error: string | null }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-5 text-[13px] leading-relaxed text-amber-100/80">
      <p className="font-medium text-amber-100">
        App version includes <code className="text-amber-50">read_reports</code>
        — reinstall / update the <code className="text-amber-50">rokitg</code>{" "}
        app on the shop so the new scopes apply to the access token.
      </p>
      <p className="mt-2 text-amber-100/60">
        ShopifyQL also needs Protected Customer Data access (Level 2) in the
        Partner/Dev Dashboard. After that, sessions and locations match Shopify
        Admin → Analytics.
      </p>
      {error ? (
        <p className="mt-2 break-words text-[11px] text-amber-100/45">{error}</p>
      ) : null}
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "paid" ||
    value === "success" ||
    value === "fulfilled" ||
    value === "active"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : value === "pending" ||
          value === "unfulfilled" ||
          value === "partial"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
        : "border-[#262626] bg-[#0f0f0f] text-[#a1a1aa]";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] capitalize ${tone}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#262626] px-4 py-10 text-center text-[13px] text-[#71717a]">
        {empty}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#262626]">
      <table className="min-w-full text-left text-[13px]">
        <thead className="bg-[#141414] text-[11px] tracking-[0.12em] text-[#71717a] uppercase">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-bold whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1f1f1f] bg-[#0f0f0f]">
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex} className="align-top">
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-[#a1a1aa]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminRequired({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#262626] px-4 py-10 text-center text-[13px] text-[#71717a]">
      Connect Shopify Admin to load {label}.
    </div>
  );
}

export function StoreOverviewSection() {
  const { snapshot } = useShopifyStore();
  const analytics = snapshot.analytics;
  const admin = snapshot.admin;
  const currency =
    admin?.shop?.currency ?? snapshot.publicMeta?.currency ?? "EUR";
  const salesSeries = analytics?.salesSeries ?? [];
  const sessionsSeries = analytics?.sessionsSeries ?? [];

  return (
    <section className="space-y-4">
      {analytics ? (
        <>
          <SectionTitle
            title="Overview"
            body={`Last ${analytics.rangeDays} days · Shopify Admin + Forms leads`}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi
              label="Gross sales"
              value={formatMoney(analytics.kpis.grossSales, currency)}
              hint="Paid orders in range"
            />
            <Kpi
              label="Orders"
              value={String(analytics.kpis.orders)}
              hint={`${analytics.kpis.ordersFulfilled} fulfilled`}
            />
            <Kpi
              label="Customers"
              value={String(analytics.kpis.customers)}
              hint={`Returning ${formatPct(analytics.kpis.returningCustomerRate)}`}
            />
            <Kpi
              label="Submissions"
              value={String(analytics.kpis.submissions)}
              hint={`${analytics.kpis.formSubmissions} from Shopify Forms`}
            />
            <Kpi
              label="Payments"
              value={String(analytics.kpis.successfulPayments)}
              hint={`${analytics.kpis.products} products`}
            />
            <Kpi
              label="Sessions"
              value={
                analytics.kpis.sessions != null
                  ? String(analytics.kpis.sessions)
                  : "—"
              }
              hint={
                analytics.shopifyqlOk
                  ? "ShopifyQL storefront sessions"
                  : "Needs read_reports"
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/internal/store/submissions"
              className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-4 transition hover:border-[#70a7ff]/35"
            >
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#71717a] uppercase">
                Submissions
              </p>
              <p className="mt-2 text-[24px] font-semibold text-[#fafafa]">
                {admin?.submissions.length ?? 0}
              </p>
              <p className="mt-1 text-[12px] text-[#70a7ff]">Open tab →</p>
            </Link>
            <Link
              href="/internal/store/customers"
              className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-4 transition hover:border-[#70a7ff]/35"
            >
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#71717a] uppercase">
                Customers
              </p>
              <p className="mt-2 text-[24px] font-semibold text-[#fafafa]">
                {admin?.customers.length ?? 0}
              </p>
              <p className="mt-1 text-[12px] text-[#70a7ff]">Open tab →</p>
            </Link>
            <Link
              href="/internal/store/orders"
              className="rounded-2xl border border-[#262626] bg-[#141414] px-4 py-4 transition hover:border-[#70a7ff]/35"
            >
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#71717a] uppercase">
                Orders
              </p>
              <p className="mt-2 text-[24px] font-semibold text-[#fafafa]">
                {admin?.orders.length ?? 0}
              </p>
              <p className="mt-1 text-[12px] text-[#70a7ff]">Open tab →</p>
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Total sales over time"
              body={`Paid order volume · last ${analytics.rangeDays} days`}
            >
              {salesSeries.some((p) => p.sales > 0) ? (
                <AreaLineChart
                  primary={salesSeries.map((p) => p.sales)}
                  labels={salesSeries.map((p) => p.label)}
                  label="Sales"
                  heightClass="h-56"
                  showLegend={false}
                  primaryStroke="#70a7ff"
                />
              ) : (
                <EmptyChart />
              )}
            </Panel>
            <Panel
              title="Orders over time"
              body={`Order count · last ${analytics.rangeDays} days`}
            >
              {salesSeries.some((p) => p.orders > 0) ? (
                <AreaLineChart
                  primary={salesSeries.map((p) => p.orders)}
                  labels={salesSeries.map((p) => p.label)}
                  label="Orders"
                  heightClass="h-56"
                  showLegend={false}
                  primaryStroke="#34d399"
                />
              ) : (
                <EmptyChart />
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Sessions over time"
              body={
                analytics.shopifyqlOk
                  ? "ShopifyQL sessions"
                  : "Needs read_reports scope for ShopifyQL"
              }
            >
              {analytics.shopifyqlOk && sessionsSeries.length > 0 ? (
                <AreaLineChart
                  primary={sessionsSeries.map((p) => p.sessions)}
                  labels={sessionsSeries.map((p) => p.label)}
                  label="Sessions"
                  heightClass="h-56"
                  showLegend={false}
                  primaryStroke="#a78bfa"
                />
              ) : (
                <ScopeHint error={analytics.error} />
              )}
            </Panel>
            <Panel
              title="Sessions by location"
              body={
                analytics.shopifyqlOk
                  ? "Top locations"
                  : "Unlock with read_reports"
              }
            >
              {analytics.shopifyqlOk &&
              analytics.sessionsByLocation.length > 0 ? (
                <ul className="space-y-2">
                  {analytics.sessionsByLocation.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] px-3 py-2 text-[13px]"
                    >
                      <span className="truncate text-[#fafafa]">
                        {row.label}
                      </span>
                      <span className="shrink-0 text-[#a1a1aa]">
                        {row.sessions}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ScopeHint error={analytics.error} />
              )}
            </Panel>
          </div>
        </>
      ) : (
        <SectionTitle
          title="Overview"
          body="Connect Shopify to load analytics."
        />
      )}
    </section>
  );
}

export function StoreSubmissionsSection() {
  const { snapshot } = useShopifyStore();
  const admin = snapshot.admin;
  if (!admin) return <AdminRequired label="form submissions" />;

  return (
    <section className="space-y-3">
      <SectionTitle
        title="Submissions"
        body="Every Shopify Forms capture creates a customer — jump between submission and customer records."
      />
      <DataTable
        empty="No form submissions yet. Captures from Shopify Forms appear here once a customer is created."
        headers={[
          "Submission",
          "Customer",
          "Form",
          "Tags",
          "Marketing",
          "When",
        ]}
        rows={admin.submissions.map((row) => [
          <span
            key="s"
            id={submissionAnchor(row.id)}
            className="scroll-mt-28 block"
          >
            <div className="font-medium text-[#fafafa]">
              {row.eventMessage ?? "Form submission"}
            </div>
            <div className="text-[11px] text-[#71717a]">{row.id}</div>
          </span>,
          <span key="c">
            <CustomerLink customerId={row.customerId}>
              <span className="font-medium">
                {row.name || row.email || `Customer ${row.customerId}`}
              </span>
            </CustomerLink>
            <div className="text-[11px] text-[#71717a]">
              {row.email ?? "—"}
            </div>
          </span>,
          <span key="f">
            <SourcePill source={row.source} />
            <div className="mt-1 text-[11px] text-[#71717a]">
              {row.formId ? `Form ${row.formId}` : "—"}
            </div>
          </span>,
          <TagList key="t" tags={row.formTags} />,
          row.marketingState ?? "—",
          <span key="w">
            <div>{formatWhen(row.submittedAt)}</div>
            <a
              href={row.adminUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-[#70a7ff] hover:underline"
            >
              Shopify admin
            </a>
          </span>,
        ])}
      />
    </section>
  );
}

export function StoreCustomersSection() {
  const { snapshot } = useShopifyStore();
  const admin = snapshot.admin;
  if (!admin) return <AdminRequired label="customers" />;

  const submissionByCustomer = new Map(
    admin.submissions.map((row) => [row.customerId, row] as const),
  );

  return (
    <section className="space-y-3">
      <SectionTitle
        title="Customers"
        body="Linked to form submissions when tags or timeline events show a Forms capture."
      />
      <DataTable
        empty="No customers yet."
        headers={[
          "Customer",
          "Source",
          "Submission",
          "Orders",
          "Spent",
          "Joined",
        ]}
        rows={admin.customers.map((customer) => {
          const submission = submissionByCustomer.get(customer.id);
          return [
            <span
              key="c"
              id={customerAnchor(customer.id)}
              className="scroll-mt-28 block"
            >
              <div className="font-medium text-[#fafafa]">
                {customer.name ?? "—"}
              </div>
              <div className="text-[11px] text-[#71717a]">
                {customer.email ?? ""}
              </div>
              <div className="mt-1 text-[11px] text-[#52525b]">
                {[customer.city, customer.country]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </div>
            </span>,
            <span key="src" className="space-y-1">
              <SourcePill source={customer.source} />
              <TagList tags={customer.tags.slice(0, 4)} />
            </span>,
            submission ? (
              <SubmissionLink key="sub" customerId={customer.id}>
                View submission
              </SubmissionLink>
            ) : (
              <span key="sub" className="text-[#52525b]">
                —
              </span>
            ),
            String(customer.ordersCount),
            formatMoney(customer.totalSpent, customer.currency),
            <span key="w">
              <div>{formatWhen(customer.createdAt)}</div>
              <a
                href={customer.adminUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#70a7ff] hover:underline"
              >
                Shopify admin
              </a>
            </span>,
          ];
        })}
      />
    </section>
  );
}

export function StoreOrdersSection() {
  const { snapshot } = useShopifyStore();
  const admin = snapshot.admin;
  if (!admin) return <AdminRequired label="orders" />;

  return (
    <section className="space-y-3">
      <SectionTitle title="Recent orders" />
      <DataTable
        empty="No orders yet."
        headers={[
          "Order",
          "Customer",
          "Total",
          "Payment",
          "Fulfillment",
          "When",
        ]}
        rows={admin.orders.map((order) => [
          <span key="n" className="font-medium text-[#fafafa]">
            {order.name}
            {order.gateway ? (
              <span className="ml-2 text-[11px] text-[#52525b]">
                {order.gateway}
              </span>
            ) : null}
          </span>,
          <span key="c">
            <CustomerLink customerId={order.customerId}>
              {order.customerName ?? order.email ?? "—"}
            </CustomerLink>
            <div className="text-[11px] text-[#71717a]">
              {[order.city, order.country].filter(Boolean).join(", ") ||
                order.email ||
                ""}
            </div>
          </span>,
          formatMoney(order.totalPrice, order.currency),
          <StatusPill key="p" value={order.financialStatus} />,
          <StatusPill
            key="f"
            value={order.fulfillmentStatus ?? "unfulfilled"}
          />,
          formatWhen(order.createdAt),
        ])}
      />
    </section>
  );
}

export function StorePaymentsSection() {
  const { snapshot } = useShopifyStore();
  const admin = snapshot.admin;
  if (!admin) return <AdminRequired label="payments" />;

  const customers = admin.customers;

  return (
    <section className="space-y-3">
      <SectionTitle title="Payments" />
      <DataTable
        empty="No payment transactions yet."
        headers={[
          "Order",
          "Customer",
          "Gateway",
          "Amount",
          "Status",
          "When",
        ]}
        rows={admin.payments.map((payment) => [
          payment.orderName,
          <CustomerLink key="c" customerId={payment.customerId}>
            {payment.customerId
              ? customers.find((c) => c.id === payment.customerId)?.name ||
                customers.find((c) => c.id === payment.customerId)?.email ||
                `Customer ${payment.customerId}`
              : "—"}
          </CustomerLink>,
          <span key="g">
            <div>{payment.gateway}</div>
            <div className="text-[11px] text-[#71717a]">
              {payment.cardBrand
                ? `${payment.cardBrand}${payment.cardLast4 ? ` · ${payment.cardLast4}` : ""}`
                : "—"}
            </div>
          </span>,
          formatMoney(payment.amount, payment.currency),
          <StatusPill key="s" value={payment.status} />,
          formatWhen(payment.createdAt),
        ])}
      />
    </section>
  );
}

export function StoreProductsSection() {
  const { snapshot } = useShopifyStore();
  const admin = snapshot.admin;
  if (!admin) return <AdminRequired label="products" />;

  return (
    <section className="space-y-3">
      <SectionTitle title="Products" />
      <DataTable
        empty="No products published."
        headers={["Product", "Status", "Inventory", "Updated"]}
        rows={admin.products.map((product) => [
          <span key="p" className="flex items-center gap-3">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt=""
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#1c1c1c] text-[10px] text-[#52525b]">
                SKU
              </div>
            )}
            <span>
              {product.onlineStoreUrl ? (
                <a
                  href={product.onlineStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[#fafafa] hover:underline"
                >
                  {product.title}
                </a>
              ) : (
                <span className="font-medium text-[#fafafa]">
                  {product.title}
                </span>
              )}
              <div className="text-[11px] text-[#71717a]">
                {product.vendor || product.productType || "—"}
              </div>
            </span>
          </span>,
          <StatusPill key="s" value={product.status} />,
          `${product.totalInventory ?? "—"} · ${product.totalVariants} var`,
          formatWhen(product.updatedAt),
        ])}
      />
    </section>
  );
}
