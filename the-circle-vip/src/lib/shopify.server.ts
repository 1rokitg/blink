import "server-only";

import type {
  RokitDomainCard,
  ShopifyAdminShop,
  ShopifyAnalyticsBlock,
  ShopifyCustomerRow,
  ShopifyOrderRow,
  ShopifyPaymentRow,
  ShopifyProductRow,
  ShopifyPublicMeta,
  ShopifySeriesPoint,
  ShopifySubmissionRow,
  ShopifyStoreSnapshot,
} from "@/lib/shopify-types";

const DEFAULT_STORE_HOST = "store.rokitg.com";
const DEFAULT_MYSHOPIFY = "tfrdn9-ku.myshopify.com";
const DEFAULT_API_VERSION = "2026-07";
const ANALYTICS_RANGE_DAYS = 90;

/** In-memory access token cache (Worker isolate). Tokens last ~24h. */
let cachedToken: { value: string; expiresAtMs: number } | null = null;

function trimEnv(name: string): string {
  return process.env[name]?.trim() || "";
}

function normalizeShopDomain(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function getShopifyConfig() {
  const storefrontHost =
    trimEnv("SHOPIFY_STOREFRONT_HOST") || DEFAULT_STORE_HOST;
  const adminShopDomain = normalizeShopDomain(
    trimEnv("SHOPIFY_STORE_DOMAIN") ||
      trimEnv("SHOPIFY_MYSHOPIFY_DOMAIN") ||
      DEFAULT_MYSHOPIFY,
  );
  const accessToken = trimEnv("SHOPIFY_ADMIN_ACCESS_TOKEN");
  const clientId = trimEnv("SHOPIFY_CLIENT_ID");
  const clientSecret = trimEnv("SHOPIFY_CLIENT_SECRET");
  const apiVersion = trimEnv("SHOPIFY_API_VERSION") || DEFAULT_API_VERSION;
  const configured = Boolean(accessToken || (clientId && clientSecret));

  return {
    storefrontHost,
    adminShopDomain,
    accessToken,
    clientId,
    clientSecret,
    apiVersion,
    configured,
  };
}

export function getRokitDomainMap(): RokitDomainCard[] {
  const { storefrontHost, adminShopDomain } = getShopifyConfig();
  const myshopify = adminShopDomain || DEFAULT_MYSHOPIFY;
  return [
    {
      role: "marketing",
      host: "rokitg.com",
      href: "https://rokitg.com",
      title: "Marketing + Circle",
      description: "Landing, waitlist, /join membership checkout (Stripe).",
      origin: "worker",
      statusHint: "Worker custom domain",
    },
    {
      role: "internal",
      host: "internal.rokitg.com",
      href: "https://internal.rokitg.com",
      title: "Internal tools",
      description: "Owner dashboard — this app.",
      origin: "worker",
      statusHint: "Worker custom domain",
    },
    {
      role: "storefront",
      host: storefrontHost,
      href: `https://${storefrontHost}`,
      title: "Shopify storefront",
      description: "Internet Culture merch / commerce — Shopify Online Store.",
      origin: "shopify",
      statusHint: "CNAME → shops.myshopify.com",
    },
    {
      role: "customer_account",
      host: "account.rokitg.com",
      href: "https://account.rokitg.com",
      title: "Customer accounts",
      description: "Shopify new customer accounts (orders, login).",
      origin: "shopify_accounts",
      statusHint: "CNAME → shops.myshopify.com",
    },
    {
      role: "myshopify",
      host: myshopify,
      href: `https://${myshopify}`,
      title: "myshopify admin host",
      description: "Canonical Shopify shop domain for Admin API calls.",
      origin: "shopify",
      statusHint: "Redirects to primary domain",
    },
  ];
}

async function fetchPublicMeta(
  storefrontHost: string,
): Promise<ShopifyPublicMeta | null> {
  try {
    const res = await fetch(`https://${storefrontHost}/meta.json`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ShopifyPublicMeta;
  } catch {
    return null;
  }
}

async function resolveAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const { accessToken, clientId, clientSecret, adminShopDomain } =
    getShopifyConfig();

  if (accessToken) return { ok: true, token: accessToken };

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      error:
        "Set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (or SHOPIFY_ADMIN_ACCESS_TOKEN).",
    };
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) {
    return { ok: true, token: cachedToken.value };
  }

  try {
    const res = await fetch(
      `https://${adminShopDomain}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        cache: "no-store",
      },
    );
    const body = (await res.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    } | null;

    if (!res.ok || !body?.access_token) {
      const detail =
        body?.error_description || body?.error || res.statusText;
      return {
        ok: false,
        error: `Shopify token exchange failed (${res.status}): ${detail}. If you see app_not_installed, install the app on the shop first.`,
      };
    }

    const ttlSec =
      typeof body.expires_in === "number" ? body.expires_in : 86_400;
    cachedToken = {
      value: body.access_token,
      expiresAtMs: now + Math.max(60, ttlSec - 120) * 1000,
    };
    return { ok: true, token: body.access_token };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Shopify token exchange failed.",
    };
  }
}

async function shopifyAdminGet<T>(
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const { adminShopDomain, apiVersion } = getShopifyConfig();
  const tokenRes = await resolveAccessToken();
  if (!tokenRes.ok) return tokenRes;

  const url = `https://${adminShopDomain}/admin/api/${apiVersion}${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": tokenRes.token,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401) cachedToken = null;
      return {
        ok: false,
        error: `Shopify Admin ${res.status}: ${body.slice(0, 200) || res.statusText}`,
      };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Shopify Admin request failed.",
    };
  }
}

async function shopifyGraphql<T>(
  query: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const { adminShopDomain, apiVersion } = getShopifyConfig();
  const tokenRes = await resolveAccessToken();
  if (!tokenRes.ok) return tokenRes;

  try {
    const res = await fetch(
      `https://${adminShopDomain}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": tokenRes.token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query }),
        cache: "no-store",
      },
    );
    const json = (await res.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok || json.errors?.length) {
      if (res.status === 401) cachedToken = null;
      return {
        ok: false,
        error:
          json.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
          `GraphQL ${res.status}`,
      };
    }
    if (!json.data) return { ok: false, error: "Empty GraphQL response." };
    return { ok: true, data: json.data };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Shopify GraphQL failed.",
    };
  }
}

type AdminShopJson = {
  shop?: {
    id: number;
    name: string;
    email?: string | null;
    domain?: string;
    myshopify_domain?: string;
    currency?: string;
    plan_name?: string | null;
    password_enabled?: boolean | null;
    created_at?: string | null;
  };
};

type AdminProductsJson = {
  products?: Array<{
    id: number;
    title: string;
    status?: string;
    handle?: string;
    vendor?: string;
    product_type?: string;
    variants?: Array<{ inventory_quantity?: number | null }>;
    image?: { src?: string | null } | null;
    updated_at?: string;
  }>;
};

type AdminOrdersJson = {
  orders?: Array<{
    id: number;
    name?: string;
    created_at?: string;
    financial_status?: string;
    fulfillment_status?: string | null;
    total_price?: string;
    currency?: string;
    email?: string | null;
    payment_gateway_names?: string[];
    source_name?: string | null;
    customer?: {
      id?: number;
      first_name?: string | null;
      last_name?: string | null;
      default_address?: {
        country?: string | null;
        city?: string | null;
      } | null;
    } | null;
    line_items?: unknown[];
  }>;
};

type AdminCustomersJson = {
  customers?: Array<{
    id: number;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    orders_count?: number;
    total_spent?: string;
    currency?: string;
    created_at?: string;
    state?: string | null;
    tags?: string;
    email_marketing_consent?: {
      state?: string | null;
    } | null;
    default_address?: {
      country?: string | null;
      city?: string | null;
    } | null;
  }>;
};

type CustomerEventsGraphql = {
  customers?: {
    edges?: Array<{
      node?: {
        legacyResourceId?: string;
        events?: {
          edges?: Array<{
            node?: {
              createdAt?: string;
              message?: string;
            } | null;
          }>;
        } | null;
      } | null;
    }>;
  } | null;
};

type AdminTransactionsJson = {
  transactions?: Array<{
    id: number;
    order_id?: number;
    kind?: string;
    gateway?: string;
    status?: string;
    amount?: string;
    currency?: string;
    created_at?: string;
    test?: boolean;
    payment_details?: {
      credit_card_company?: string | null;
      credit_card_number?: string | null;
      payment_method_name?: string | null;
    } | null;
  }>;
};

type CountJson = { count?: number };

type ShopifyqlData = {
  shopifyqlQuery?: {
    parseErrors?: string[];
    tableData?: {
      columns?: Array<{ name: string }>;
      rows?: Array<Record<string, string>>;
    } | null;
  } | null;
};

function mapProduct(
  row: NonNullable<AdminProductsJson["products"]>[number],
  storefrontHost: string,
): ShopifyProductRow {
  const inventory = (row.variants ?? []).reduce<number | null>((sum, variant) => {
    const qty = variant.inventory_quantity;
    if (typeof qty !== "number") return sum;
    return (sum ?? 0) + qty;
  }, null);

  return {
    id: row.id,
    title: row.title,
    status: row.status ?? "unknown",
    handle: row.handle ?? "",
    vendor: row.vendor ?? "",
    productType: row.product_type ?? "",
    totalVariants: row.variants?.length ?? 0,
    totalInventory: inventory,
    updatedAt: row.updated_at ?? "",
    imageUrl: row.image?.src ?? null,
    onlineStoreUrl: row.handle
      ? `https://${storefrontHost}/products/${row.handle}`
      : null,
  };
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formIdsFromTags(tags: string[]): string[] {
  return tags
    .filter((tag) => /^shopify-forms-\d+/i.test(tag))
    .map((tag) => tag.replace(/^shopify-forms-/i, ""));
}

function customerAdminUrl(adminShopDomain: string, customerId: number) {
  const handle = adminShopDomain.replace(/\.myshopify\.com$/i, "");
  return `https://admin.shopify.com/store/${handle}/customers/${customerId}`;
}

function mapOrder(
  row: NonNullable<AdminOrdersJson["orders"]>[number],
): ShopifyOrderRow {
  const first = row.customer?.first_name?.trim() ?? "";
  const last = row.customer?.last_name?.trim() ?? "";
  const customerName = [first, last].filter(Boolean).join(" ") || null;
  return {
    id: row.id,
    name: row.name ?? `#${row.id}`,
    createdAt: row.created_at ?? "",
    financialStatus: row.financial_status ?? "unknown",
    fulfillmentStatus: row.fulfillment_status ?? null,
    totalPrice: row.total_price ?? "0",
    currency: row.currency ?? "EUR",
    email: row.email ?? null,
    customerId: row.customer?.id ?? null,
    customerName,
    itemCount: row.line_items?.length ?? 0,
    gateway: row.payment_gateway_names?.[0] ?? null,
    sourceName: row.source_name ?? null,
    country: row.customer?.default_address?.country ?? null,
    city: row.customer?.default_address?.city ?? null,
  };
}

function mapCustomer(
  row: NonNullable<AdminCustomersJson["customers"]>[number],
  adminShopDomain: string,
  formEventByCustomerId: Map<number, { createdAt: string; message: string }>,
): ShopifyCustomerRow {
  const first = row.first_name?.trim() ?? "";
  const last = row.last_name?.trim() ?? "";
  const tags = parseTags(row.tags);
  const formIds = formIdsFromTags(tags);
  const formEvent = formEventByCustomerId.get(row.id);
  const source: ShopifyCustomerRow["source"] =
    formIds.length > 0 || formEvent
      ? "shopify_forms"
      : (row.orders_count ?? 0) > 0
        ? "online_store"
        : "other";

  return {
    id: row.id,
    email: row.email ?? null,
    name: [first, last].filter(Boolean).join(" ") || null,
    ordersCount: row.orders_count ?? 0,
    totalSpent: row.total_spent ?? "0.00",
    currency: row.currency ?? "EUR",
    createdAt: row.created_at ?? "",
    state: row.state ?? null,
    country: row.default_address?.country ?? null,
    city: row.default_address?.city ?? null,
    tags,
    marketingState: row.email_marketing_consent?.state ?? null,
    source,
    formIds,
    adminUrl: customerAdminUrl(adminShopDomain, row.id),
  };
}

function buildSubmissions(
  customers: ShopifyCustomerRow[],
  formEventByCustomerId: Map<number, { createdAt: string; message: string }>,
): ShopifySubmissionRow[] {
  return customers
    .filter((customer) => customer.source === "shopify_forms")
    .map((customer) => {
      const formEvent = formEventByCustomerId.get(customer.id);
      return {
        id: `submission-${customer.id}`,
        customerId: customer.id,
        email: customer.email,
        name: customer.name,
        submittedAt: formEvent?.createdAt || customer.createdAt,
        source: customer.source,
        formId: customer.formIds[0] ?? null,
        formTags: customer.tags.filter(
          (tag) =>
            /^shopify-forms-/i.test(tag) ||
            /^(emails|launch|newsletter|waitlist)$/i.test(tag),
        ),
        marketingState: customer.marketingState,
        ordersCount: customer.ordersCount,
        eventMessage: formEvent?.message ?? "Forms created this customer.",
        adminUrl: customer.adminUrl,
      } satisfies ShopifySubmissionRow;
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

async function fetchFormCustomerEvents(): Promise<
  Map<number, { createdAt: string; message: string }>
> {
  const query = `
    query InternalCustomerFormEvents {
      customers(first: 50, sortKey: UPDATED_AT, reverse: true) {
        edges {
          node {
            legacyResourceId
            events(first: 12, sortKey: CREATED_AT, reverse: true) {
              edges {
                node {
                  createdAt
                  message
                }
              }
            }
          }
        }
      }
    }
  `;
  const res = await shopifyGraphql<CustomerEventsGraphql>(query);
  const map = new Map<number, { createdAt: string; message: string }>();
  if (!res.ok) return map;

  for (const edge of res.data.customers?.edges ?? []) {
    const node = edge.node;
    if (!node?.legacyResourceId) continue;
    const id = Number(node.legacyResourceId);
    if (!Number.isFinite(id)) continue;
    const event = (node.events?.edges ?? [])
      .map((e) => e.node)
      .find((e) => /forms created this customer/i.test(e?.message ?? ""));
    if (event?.createdAt && event.message) {
      map.set(id, { createdAt: event.createdAt, message: event.message });
    }
  }
  return map;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function buildSalesSeries(
  orders: ShopifyOrderRow[],
  rangeDays: number,
): ShopifySeriesPoint[] {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (rangeDays - 1));

  const buckets = new Map<string, { sales: number; orders: number }>();
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { sales: 0, orders: 0 });
  }

  for (const order of orders) {
    const key = dayKey(order.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (
      order.financialStatus === "paid" ||
      order.financialStatus === "partially_paid" ||
      order.financialStatus === "partially_refunded"
    ) {
      bucket.sales += Number(order.totalPrice) || 0;
      bucket.orders += 1;
    }
  }

  return [...buckets.entries()].map(([date, value]) => ({
    date,
    label: new Date(`${date}T00:00:00Z`).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    }),
    sales: value.sales,
    orders: value.orders,
  }));
}

async function fetchShopifyqlSeries(
  rangeDays: number,
): Promise<{
  ok: boolean;
  error: string | null;
  sessionsSeries: ShopifyAnalyticsBlock["sessionsSeries"];
  sessionsByLocation: ShopifyAnalyticsBlock["sessionsByLocation"];
}> {
  const sessionsQ = `FROM sessions SHOW sessions TIMESERIES day SINCE startOfDay(-${rangeDays}d) UNTIL today ORDER BY day`;
  const locationQ = `FROM sessions SHOW sessions GROUP BY session_country, session_city SINCE startOfDay(-${rangeDays}d) UNTIL today ORDER BY sessions DESC LIMIT 8`;

  const [sessionsRes, locationRes] = await Promise.all([
    shopifyGraphql<ShopifyqlData>(
      `query { shopifyqlQuery(query: ${JSON.stringify(sessionsQ)}) { parseErrors tableData { columns { name } rows } } }`,
    ),
    shopifyGraphql<ShopifyqlData>(
      `query { shopifyqlQuery(query: ${JSON.stringify(locationQ)}) { parseErrors tableData { columns { name } rows } } }`,
    ),
  ]);

  if (!sessionsRes.ok) {
    return {
      ok: false,
      error: sessionsRes.error,
      sessionsSeries: [],
      sessionsByLocation: [],
    };
  }

  const parseErrors = sessionsRes.data.shopifyqlQuery?.parseErrors ?? [];
  if (parseErrors.length || !sessionsRes.data.shopifyqlQuery?.tableData) {
    return {
      ok: false,
      error: parseErrors.join("; ") || "ShopifyQL sessions unavailable.",
      sessionsSeries: [],
      sessionsByLocation: [],
    };
  }

  const sessionsSeries = (sessionsRes.data.shopifyqlQuery.tableData.rows ?? []).map(
    (row) => {
      const date = row.day ?? row.date ?? Object.values(row)[0] ?? "";
      return {
        date,
        label: date
          ? new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })
          : "",
        sessions: Number(row.sessions ?? 0) || 0,
      };
    },
  );

  const sessionsByLocation =
    locationRes.ok && locationRes.data.shopifyqlQuery?.tableData?.rows
      ? locationRes.data.shopifyqlQuery.tableData.rows.map((row) => ({
          label: [row.session_country, row.session_city]
            .filter(Boolean)
            .join(" · ") || "Unknown",
          sessions: Number(row.sessions ?? 0) || 0,
        }))
      : [];

  return { ok: true, error: null, sessionsSeries, sessionsByLocation };
}

export async function getShopifyStoreSnapshot(): Promise<ShopifyStoreSnapshot> {
  const { storefrontHost, adminShopDomain, apiVersion, configured } =
    getShopifyConfig();
  const domains = getRokitDomainMap();
  const publicMeta = await fetchPublicMeta(storefrontHost);

  const base: ShopifyStoreSnapshot = {
    generatedAt: new Date().toISOString(),
    configured,
    ok: true,
    error: null,
    apiVersion,
    storeDomain: storefrontHost,
    adminShopDomain,
    domains,
    publicMeta,
    analytics: null,
    admin: null,
  };

  if (!configured) {
    return {
      ...base,
      ok: true,
      error:
        "Add SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (Dev Dashboard app) and install the app on the shop.",
    };
  }

  const [
    shopRes,
    productsRes,
    ordersRes,
    customersRes,
    productCountRes,
    orderCountRes,
    customerCountRes,
  ] = await Promise.all([
    shopifyAdminGet<AdminShopJson>("/shop.json"),
    shopifyAdminGet<AdminProductsJson>("/products.json?limit=50"),
    shopifyAdminGet<AdminOrdersJson>(
      "/orders.json?status=any&limit=50&order=created_at+desc",
    ),
    shopifyAdminGet<AdminCustomersJson>("/customers.json?limit=50"),
    shopifyAdminGet<CountJson>("/products/count.json"),
    shopifyAdminGet<CountJson>("/orders/count.json?status=any"),
    shopifyAdminGet<CountJson>("/customers/count.json"),
  ]);

  if (!shopRes.ok) {
    return { ...base, ok: false, error: shopRes.error };
  }
  if (!productsRes.ok) {
    return { ...base, ok: false, error: productsRes.error };
  }
  if (!ordersRes.ok) {
    return { ...base, ok: false, error: ordersRes.error };
  }
  if (!customersRes.ok) {
    return { ...base, ok: false, error: customersRes.error };
  }

  const shopRaw = shopRes.data.shop;
  const shop: ShopifyAdminShop | null = shopRaw
    ? {
        id: shopRaw.id,
        name: shopRaw.name,
        email: shopRaw.email ?? null,
        domain: shopRaw.domain ?? storefrontHost,
        myshopifyDomain: shopRaw.myshopify_domain ?? adminShopDomain,
        currency: shopRaw.currency ?? publicMeta?.currency ?? "EUR",
        planName: shopRaw.plan_name ?? null,
        passwordEnabled: shopRaw.password_enabled ?? null,
        createdAt: shopRaw.created_at ?? null,
      }
    : null;

  const products = (productsRes.data.products ?? []).map((row) =>
    mapProduct(row, storefrontHost),
  );
  const orders = (ordersRes.data.orders ?? []).map(mapOrder);
  const formEventByCustomerId = await fetchFormCustomerEvents();
  const customers = (customersRes.data.customers ?? []).map((row) =>
    mapCustomer(row, adminShopDomain, formEventByCustomerId),
  );
  const submissions = buildSubmissions(customers, formEventByCustomerId);

  const paymentResults = await Promise.all(
    orders.slice(0, 25).map(async (order) => {
      const tx = await shopifyAdminGet<AdminTransactionsJson>(
        `/orders/${order.id}/transactions.json`,
      );
      if (!tx.ok) return [] as ShopifyPaymentRow[];
      return (tx.data.transactions ?? []).map((row) => {
        const cardNumber = row.payment_details?.credit_card_number ?? "";
        const last4 = cardNumber.match(/(\d{4})\s*$/)?.[1] ?? null;
        return {
          id: row.id,
          orderId: order.id,
          orderName: order.name,
          customerId: order.customerId,
          kind: row.kind ?? "sale",
          gateway: row.gateway ?? "unknown",
          status: row.status ?? "unknown",
          amount: row.amount ?? "0",
          currency: row.currency ?? order.currency,
          createdAt: row.created_at ?? order.createdAt,
          cardBrand:
            row.payment_details?.credit_card_company ??
            row.payment_details?.payment_method_name ??
            null,
          cardLast4: last4,
          test: Boolean(row.test),
        } satisfies ShopifyPaymentRow;
      });
    }),
  );
  const payments = paymentResults.flat().sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const paidOrders = orders.filter((o) => o.financialStatus === "paid");
  const fulfilledOrders = orders.filter(
    (o) =>
      o.fulfillmentStatus === "fulfilled" ||
      o.fulfillmentStatus === "partial",
  );
  const openOrders = orders.filter(
    (o) =>
      o.financialStatus !== "paid" ||
      !o.fulfillmentStatus ||
      o.fulfillmentStatus === "unfulfilled" ||
      o.fulfillmentStatus === "partial",
  ).length;

  const grossSales = paidOrders.reduce(
    (sum, order) => sum + (Number(order.totalPrice) || 0),
    0,
  );
  const customersWithOrders = customers.filter((c) => c.ordersCount > 0);
  const returningCustomers = customers.filter((c) => c.ordersCount > 1);
  const returningCustomerRate =
    customersWithOrders.length > 0
      ? returningCustomers.length / customersWithOrders.length
      : null;

  const salesSeries = buildSalesSeries(orders, ANALYTICS_RANGE_DAYS);
  const shopifyql = await fetchShopifyqlSeries(ANALYTICS_RANGE_DAYS);
  const sessionsTotal = shopifyql.sessionsSeries.reduce(
    (sum, point) => sum + point.sessions,
    0,
  );

  const productCount =
    productCountRes.ok ? (productCountRes.data.count ?? products.length) : products.length;
  const orderCount =
    orderCountRes.ok ? (orderCountRes.data.count ?? orders.length) : orders.length;
  const customerCount =
    customerCountRes.ok
      ? (customerCountRes.data.count ?? customers.length)
      : customers.length;
  const formSubmissions = submissions.filter(
    (row) => row.source === "shopify_forms",
  ).length;

  const analytics: ShopifyAnalyticsBlock = {
    shopifyqlOk: shopifyql.ok,
    error: shopifyql.error,
    rangeDays: ANALYTICS_RANGE_DAYS,
    kpis: {
      grossSales,
      totalSales: grossSales,
      orders: orderCount,
      ordersFulfilled: fulfilledOrders.length,
      customers: customerCount,
      submissions: submissions.length,
      formSubmissions,
      returningCustomerRate,
      successfulPayments: payments.filter((p) => p.status === "success").length,
      products: productCount,
      sessions: shopifyql.ok ? sessionsTotal : null,
    },
    salesSeries,
    sessionsSeries: shopifyql.sessionsSeries,
    sessionsByLocation: shopifyql.sessionsByLocation,
  };

  return {
    ...base,
    ok: true,
    error: null,
    analytics,
    admin: {
      shop,
      products,
      orders,
      customers,
      submissions,
      payments,
      counts: {
        products: productCount,
        orders: orderCount,
        customers: customerCount,
        submissions: submissions.length,
        formSubmissions,
        openOrders,
        paidOrders: paidOrders.length,
        fulfilledOrders: fulfilledOrders.length,
      },
    },
  };
}
