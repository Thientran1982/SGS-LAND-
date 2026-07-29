"use client";

import { createContext } from "react";

export type Lang = "vi" | "en";

/** null = chua co provider (fallback ve URL trong useLang) */
export const LangContext = createContext<Lang | null>(null);

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}
