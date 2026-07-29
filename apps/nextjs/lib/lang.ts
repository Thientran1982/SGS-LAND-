import { headers } from "next/headers";

export type Lang = "vi" | "en";

/** Locale for the current request. Middleware rewrites /en/* and sets x-sgs-lang. */
export async function getLang(): Promise<Lang> {
  try {
    const h = await headers();
    return h.get("x-sgs-lang") === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
}

/** Same route in the other language: "/marketplace" <-> "/en/marketplace". */
export function localePath(pathname: string, lang: Lang): string {
  const clean = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (lang === "en") return clean === "/" ? "/en" : "/en" + clean;
  return clean;
}

/** hreflang block for a page's metadata. */
export function langAlternates(pathname: string) {
  const base = "https://sgsland.vn";
  const clean = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return {
    languages: {
      "vi-VN": base + clean,
      "en-US": base + (clean === "/" ? "/en" : "/en" + clean),
      "x-default": base + clean,
    },
  };
}
