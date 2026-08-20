"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type { Locale } from "@/lib/i18n/config";
import { t as interpolate, type Dictionary } from "@/lib/i18n/dictionary";

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  t: (template: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const t = useCallback(
    (template: string, vars?: Record<string, string | number>) =>
      interpolate(template, vars),
    [],
  );

  const value = useMemo(
    () => ({ locale, dictionary, t }),
    [locale, dictionary, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
