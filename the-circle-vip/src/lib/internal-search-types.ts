export type SearchGroup =
  | "pages"
  | "actions"
  | "members"
  | "people"
  | "leads"
  | "payments"
  | "checkout"
  | "comps"
  | "products";

export type SearchIndexItem = {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string;
  href: string;
  /** Flattened string cmdk uses for filtering. */
  value: string;
};

export type SearchIndexResponse = {
  generatedAt: string;
  items: SearchIndexItem[];
  counts: Partial<Record<SearchGroup, number>>;
};

export const SEARCH_GROUP_LABEL: Record<SearchGroup, string> = {
  pages: "Pages",
  actions: "Actions",
  members: "Members",
  people: "People",
  leads: "Leads",
  payments: "Payments",
  checkout: "Checkout links",
  comps: "Comp gifts",
  products: "Products",
};

export const SEARCH_GROUP_ORDER: SearchGroup[] = [
  "pages",
  "actions",
  "members",
  "people",
  "leads",
  "payments",
  "checkout",
  "comps",
  "products",
];
