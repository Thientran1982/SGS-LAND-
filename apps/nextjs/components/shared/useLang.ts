"use client";

import { useContext } from "react";
import { usePathname } from "next/navigation";
import { LangContext, type Lang } from "./LangProvider";

export type { Lang };

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
  if (to === "en") return base === "/" ? "/en" : "/en" + base;
  return base || "/";
}
