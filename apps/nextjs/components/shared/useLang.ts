"use client";
import { useState, useEffect } from "react";

export type Lang = "vi" | "en";

/**
 * useLang – reads the current language from localStorage / CustomEvent
 * dispatched by PublicHeader when user toggles VI / EN.
 *
 * #3 FIX: All client components that render language-sensitive content
 * should use this hook instead of hardcoding Vietnamese text,
 * so that switching language in the header instantly updates every page.
 */
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("vi");

  useEffect(() => {
    // Hydrate from localStorage on mount
    try {
      const saved = localStorage.getItem("sgs-lang") as Lang | null;
      if (saved === "vi" || saved === "en") setLang(saved);
    } catch {}

    // Listen for header toggle events
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Lang>).detail;
      if (detail === "vi" || detail === "en") setLang(detail);
    };
    window.addEventListener("sgs-lang-change", handler);
    return () => window.removeEventListener("sgs-lang-change", handler);
  }, []);

  return lang;
}
