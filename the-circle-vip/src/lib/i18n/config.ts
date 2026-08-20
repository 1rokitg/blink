export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie stores an explicit preference (manual switch or first auto-detect). */
export const LOCALE_COOKIE = "circle_locale";

/** Middleware → RSC request header so layouts can read locale without cookies alone. */
export const LOCALE_HEADER = "x-circle-locale";

/** Detection source header for debugging / analytics (cf-country | accept-language | default | cookie | query). */
export const LOCALE_SOURCE_HEADER = "x-circle-locale-source";

/**
 * ISO 3166-1 alpha-2 countries where Spanish is a primary/official language.
 * Used with Cloudflare `CF-IPCountry` / `request.cf.country`.
 */
export const SPANISH_COUNTRIES = new Set([
  "ES", // Spain
  "MX", // Mexico
  "AR", // Argentina
  "CO", // Colombia
  "CL", // Chile
  "PE", // Peru
  "VE", // Venezuela
  "EC", // Ecuador
  "GT", // Guatemala
  "CU", // Cuba
  "BO", // Bolivia
  "DO", // Dominican Republic
  "HN", // Honduras
  "PY", // Paraguay
  "SV", // El Salvador
  "NI", // Nicaragua
  "CR", // Costa Rica
  "PA", // Panama
  "UY", // Uruguay
  "PR", // Puerto Rico
  "GQ", // Equatorial Guinea
]);

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "es";
}
