"use client";

import { useContext } from "react";
import { usePathname } from "next/navigation";
import { LangContext, type Lang } from "./LangProvider";

export type { Lang };

/** Public Vietnamese URL slugs; English keeps the established product slugs. */
export const VI_PUBLIC_PATHS: Record<string, string> = {
  "/marketplace": "/bat-dong-san",
  "/news": "/tin-tuc",
};

function canonicalPublicPath(pathname: string): string {
  return Object.entries(VI_PUBLIC_PATHS).reduce(
    (path, [canonical, localized]) => path === localized ? canonical : path,
    pathname,
  );
}

function localizedViPath(pathname: string): string {
  return VI_PUBLIC_PATHS[pathname] || pathname;
}

/**
 * Locale hien tai.
 * Uu tien context (do RootLayout bom vao tu header x-sgs-lang) vi middleware
 * rewrite /en/* -> /* nen usePathname() phia server khong con tien to /en.
 */
export function useLang(): Lang {
  const ctx = useContext(LangContext);
  const p = usePathname() || "/";
  if (ctx) return ctx;
  return p === "/en" || p.startsWith("/en/") ? "en" : "vi";
}

/** Duong dan tuong ung o ngon ngu con lai (dung cho nut doi ngon ngu). */
export function switchLangPath(pathname: string, to: Lang): string {
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const base = isEn ? pathname.slice(3) || "/" : pathname;
  const canonical = canonicalPublicPath(base);
  if (to === "en") return canonical === "/" ? "/en" : "/en" + canonical;
  return localizedViPath(canonical) || "/";
}
