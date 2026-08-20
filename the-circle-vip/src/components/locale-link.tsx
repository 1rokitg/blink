"use client";

import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

import { useI18n } from "@/components/i18n-provider";
import { localizePath } from "@/lib/i18n/path";

type Props = Omit<LinkProps, "href"> & {
  href: string;
  children: ReactNode;
  className?: string;
};

/** Next.js Link that prefixes the active locale (`/es/join`, etc.). */
export function LocaleLink({ href, ...props }: Props) {
  const { locale } = useI18n();
  const localized =
    href.startsWith("http") || href.startsWith("mailto:")
      ? href
      : localizePath(locale, href);

  return <Link href={localized} {...props} />;
}
