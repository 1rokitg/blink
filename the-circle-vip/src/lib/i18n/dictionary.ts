import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { en, type Dictionary } from "@/messages/en";
import { es } from "@/messages/es";

const dictionaries: Record<Locale, Dictionary> = { en, es };

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

/** Tiny mustache-style interpolator: `Hello {{name}}` */
export function t(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{{${key}}}`,
  );
}

export type { Dictionary };
