/** Public Shopify shop identity from `/meta.json` (no Admin token needed). */
export type ShopifyPublicMeta = {
  id: number;
  name: string;
  city: string | null;
  province: string | null;
  country: string | null;
  currency: string;
  domain: string;
  url: string;
  myshopify_domain: string;
  description: string;
  ships_to_countries: string[];
  money_format: string;
  published_collections_count: number;
  published_products_count: number;
  shopify_pay_enabled_card_brands: string[];
  offers_shop_pay_installments: boolean;
};

export type RokitDomainRole =
  | "marketing"
  | "internal"
  | "storefront"
  | "customer_account"
  | "myshopify";

export type RokitDomainCard = {
  role: RokitDomainRole;
  host: string;
  href: string;
  title: string;
  description: string;
  origin: "worker" | "shopify" | "shopify_accounts";
  statusHint: string;
};

export type ShopifyProductRow = {
  id: number;
  title: string;
  status: string;
  handle: string;
  vendor: string;
  productType: string;
  totalVariants: number;
  totalInventory: number | null;
  updatedAt: string;
  imageUrl: string | null;
  onlineStoreUrl: string | null;
};

export type ShopifyOrderRow = {
  id: number;
  name: string;
  createdAt: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  totalPrice: string;
  currency: string;
  email: string | null;
  customerId: number | null;
  customerName: string | null;
  itemCount: number;
  gateway: string | null;
  sourceName: string | null;
  country: string | null;
  city: string | null;
};

export type ShopifyCustomerRow = {
  id: number;
  email: string | null;
  name: string | null;
  ordersCount: number;
  totalSpent: string;
  currency: string;
  createdAt: string;
  state: string | null;
  country: string | null;
  city: string | null;
  tags: string[];
  marketingState: string | null;
  source: "shopify_forms" | "online_store" | "other";
  formIds: string[];
  adminUrl: string;
};

export type ShopifySubmissionRow = {
  id: string;
  customerId: number;
  email: string | null;
  name: string | null;
  submittedAt: string;
  source: "shopify_forms" | "online_store" | "other";
  formId: string | null;
  formTags: string[];
  marketingState: string | null;
  ordersCount: number;
  eventMessage: string | null;
  adminUrl: string;
};

export type ShopifyPaymentRow = {
  id: number;
  orderId: number;
  orderName: string;
  customerId: number | null;
  kind: string;
  gateway: string;
  status: string;
  amount: string;
  currency: string;
  createdAt: string;
  cardBrand: string | null;
  cardLast4: string | null;
  test: boolean;
};

export type ShopifySeriesPoint = {
  date: string;
  label: string;
  sales: number;
  orders: number;
};

export type ShopifyAdminShop = {
  id: number;
  name: string;
  email: string | null;
  domain: string;
  myshopifyDomain: string;
  currency: string;
  planName: string | null;
  passwordEnabled: boolean | null;
  createdAt: string | null;
};

export type ShopifyAnalyticsBlock = {
  /** True when ShopifyQL / read_reports is available. */
  shopifyqlOk: boolean;
  error: string | null;
  rangeDays: number;
  kpis: {
    grossSales: number;
    totalSales: number;
    orders: number;
    ordersFulfilled: number;
    customers: number;
    submissions: number;
    formSubmissions: number;
    returningCustomerRate: number | null;
    successfulPayments: number;
    products: number;
    sessions: number | null;
  };
  salesSeries: ShopifySeriesPoint[];
  /** Sessions series — only when ShopifyQL is permitted. */
  sessionsSeries: Array<{ date: string; label: string; sessions: number }>;
  sessionsByLocation: Array<{
    label: string;
    sessions: number;
  }>;
};

export type ShopifyStoreSnapshot = {
  generatedAt: string;
  configured: boolean;
  ok: boolean;
  error: string | null;
  apiVersion: string;
  storeDomain: string;
  adminShopDomain: string | null;
  domains: RokitDomainCard[];
  publicMeta: ShopifyPublicMeta | null;
  analytics: ShopifyAnalyticsBlock | null;
  admin: {
    shop: ShopifyAdminShop | null;
    products: ShopifyProductRow[];
    orders: ShopifyOrderRow[];
    customers: ShopifyCustomerRow[];
    submissions: ShopifySubmissionRow[];
    payments: ShopifyPaymentRow[];
    counts: {
      products: number;
      orders: number;
      customers: number;
      submissions: number;
      formSubmissions: number;
      openOrders: number;
      paidOrders: number;
      fulfilledOrders: number;
    };
  } | null;
};
