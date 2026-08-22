// @ts-nocheck
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useLang, switchLangPath, VI_PUBLIC_PATHS } from "@/components/shared/useLang";
import { Sun, Moon, Globe, User, Menu, X, Sparkles, ChevronDown } from "lucide-react";

type Lang = "vi" | "en";
type Theme = "light" | "dark";

export function PublicHeader({ authed = false }: { authed?: boolean }) {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [realEstateOpen, setRealEstateOpen] = useState(false);
  const [theme, setTheme]         = useState<Theme>("light");
  // mounted flag: prevents typeof-document server/client branch that triggers hydration mismatch
  const [mounted, setMounted]     = useState(false);
  useEffect(() => setMounted(true), []);

  // Khoa cuon nen khi menu mobile mo
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    if (menuOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [menuOpen]);
  const pathname = usePathname();
  const lang = useLang();

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("sgs-theme") as Theme | null;
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
    } catch {}
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    html.classList.toggle("light", theme === "light");
    try { localStorage.setItem("sgs-theme", theme); } catch {}
  }, [theme]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleLang = () => {
    const next: Lang = lang === "vi" ? "en" : "vi";
    try { localStorage.setItem("sgs-lang", next); } catch {}
    window.dispatchEvent(new CustomEvent("sgs-lang-change", { detail: next }));
    // Middleware can rewrite /en/* before usePathname() sees it; use the
    // browser URL so language switching preserves the current page and slug.
    const current = new URL(window.location.href);
    current.pathname = switchLangPath(current.pathname || pathname || "/", next);
    // Keep marketplace filters and any article query state when changing language.
    window.location.assign(`${current.pathname}${current.search}${current.hash}`);
  };

  const realEstateLinks = [
    { href: "/mua",                 vi: "Mua",           en: "Buy"          },
    { href: "/thue",                vi: "Thuê",          en: "Rent"         },
    { href: "/du-an",              vi: "Dự Án",        en: "Projects"     },
  ];
  const navLinks = [
    { href: "/ai-valuation",         vi: "Định Giá AI",  en: "AI Valuation" },
    { href: "/news",                 vi: "Tin Tức",      en: "News"         },
    { href: "/contact",              vi: "Liên Hệ",      en: "Contact"      },
  ];
  const localizedHref = (href: string) => {
    const viPath = VI_PUBLIC_PATHS[href] || href;
    return lang === "en" ? "/en" + href : viPath;
  };

  const isHero = false; // hero is light — always use the light header treatment

  return (
    <header
      className="ui-public-header fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background:      isHero
          ? "linear-gradient(to bottom, rgba(10,30,51,0.72) 0%, rgba(10,30,51,0.0) 100%)"
          : "var(--hdr-bg)",
        backdropFilter:  isHero ? "none"   : "blur(14px)",
        WebkitBackdropFilter: isHero ? "none" : "blur(14px)",
        borderBottom:    isHero ? "none"   : "1px solid var(--hdr-border)",
        boxShadow:       isHero ? "none"   : "var(--hdr-shadow)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: "64px" }}>

          {/* ── Logo ─────────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src={theme === "dark" ? "/logo-white.png" : "/logo-navy.png"}
              alt="SGS Land"
              className="w-9 h-9 transition-transform group-hover:scale-105"
              style={{ objectFit: "contain" }}
            />
            <div>
              <div
                className="font-bold text-lg leading-tight"
                style={{
                  color: isHero
                    ? theme === "dark" ? "#FFFFFF" : "var(--sgs-primary)"
                    : theme === "dark" ? "#E4EDF5" : "var(--sgs-primary)",
                  fontFamily: "var(--font-display, Georgia, serif)",
                  letterSpacing: "-0.02em",
                }}
              >
                SGS <span style={{ color: "var(--sgs-accent)" }}>LAND</span>
              </div>
              <div
                className="text-[12px] font-semibold uppercase hidden sm:block"
                style={{
                  color: isHero
                    ? "rgba(200,150,62,0.85)"
                    : theme === "dark" ? "var(--sgs-accent)" : "var(--sgs-accent-text)",
                  letterSpacing: "0.2em",
                }}
              >
                Proptech
              </div>
            </div>
          </Link>

          {/* ── Desktop Nav ───────────────────────────────── */}
          <nav className="hidden lg:flex items-center gap-0.5">
            <div
              className="relative"
              onMouseEnter={() => setRealEstateOpen(true)}
              onMouseLeave={() => setRealEstateOpen(false)}
            >
              <button
                type="button"
                onClick={() => setRealEstateOpen(open => !open)}
                className="flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: isHero ? "rgba(255,255,255,0.85)" : "var(--sgs-primary)",
                  fontFamily: "var(--font-ui, var(--font-be-vietnam), sans-serif)",
                }}
                aria-haspopup="menu"
                aria-expanded={realEstateOpen}
              >
                {lang === "vi" ? "Bất Động Sản" : "Real Estate"}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${realEstateOpen ? "rotate-180" : ""}`} />
              </button>
              <div
                className={`absolute left-0 top-full mt-1 min-w-44 rounded-xl p-1.5 shadow-lg transition-all ${
                  realEstateOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
                }`}
                style={{
                  background: "var(--hdr-panel)",
                  border: "1px solid var(--hdr-border)",
                }}
                role="menu"
              >
                {realEstateLinks.map(link => (
                  <Link
                    key={link.href}
                    href={localizedHref(link.href)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgba(27,58,92,0.06)]"
                    style={{ color: "var(--sgs-primary)" }}
                    role="menuitem"
                  >
                    {lang === "vi" ? link.vi : link.en}
                  </Link>
                ))}
              </div>
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={localizedHref(link.href)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: isHero ? "rgba(255,255,255,0.85)" : "var(--sgs-primary)",
                  fontFamily: "var(--font-ui, var(--font-be-vietnam), sans-serif)",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = isHero ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.06)";
                  el.style.color = isHero ? "#FFFFFF" : "var(--sgs-primary-deep)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "transparent";
                  el.style.color = isHero ? "rgba(255,255,255,0.85)" : "var(--sgs-primary)";
                }}
              >
                {lang === "vi" ? link.vi : link.en}
              </Link>
            ))}
          </nav>

          {/* ── Right Controls ─────────────────────────────── */}
          <div className="hidden md:flex items-center gap-2">
            {/* VI/EN Toggle */}
            <button
              onClick={toggleLang}
              className="sgs-hdr-chip flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isHero ? "rgba(255,255,255,0.12)" : "transparent",
                border: `1px solid ${isHero ? "rgba(255,255,255,0.3)" : "transparent"}`,
                color: isHero ? "#FFFFFF" : "var(--hdr-muted)",
              }}
              aria-label="Chuyển ngôn ngữ VI / EN"
            >
                            {lang.toUpperCase()}
            </button>

            {/* Light / Dark Toggle */}
            <button
              onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
              className="sgs-hdr-chip w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: isHero ? "rgba(255,255,255,0.12)" : "transparent",
                border: `1px solid ${isHero ? "rgba(255,255,255,0.3)" : "transparent"}`,
                color: isHero ? "#FFFFFF" : "var(--hdr-muted)",
              }}
              aria-label="Chuyển chế độ sáng / tối"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Login — ghost outline */}
            <Link
              href={authed ? "/dashboard" : "/login"}
              className="sgs-hdr-ghost flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                border: `1.5px solid ${isHero ? "rgba(255,255,255,0.45)" : "transparent"}`,
                color: isHero ? "rgba(255,255,255,0.92)" : "var(--hdr-muted)",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = isHero ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.06)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {authed ? (lang === "vi" ? "Tổng quan" : "Dashboard") : (lang === "vi" ? "Đăng nhập" : "Sign in")}
            </Link>

            {/* CTA — Gold */}
            <Link
              href="/ai-valuation"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "var(--sgs-accent)",
                color: "var(--sgs-primary-deep)",
                boxShadow: "none",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#D9A94E"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--sgs-accent)"}
            >
              {lang === "vi" ? "Định giá miễn phí" : "Free Valuation"}
            </Link>
          </div>

          {/* ── Mobile Hamburger ──────────────────────────── */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: isHero ? "#FFFFFF" : "var(--sgs-primary)" }}
            aria-label="Mở menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Menu Drawer ─────────────────────────────── */}
      {/* Lop phu: bam ra ngoai de dong, tranh noi dung phia sau canh tranh thi giac */}
      {mounted && menuOpen &&
        createPortal(
          <div
            className="md:hidden fixed inset-0 z-40"
            style={{ top: 64, background: "rgba(0,0,0,0.45)" }}
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />,
          document.body
        )}
      {menuOpen && (
        <div
          className="md:hidden relative z-50"
          style={{
            background: "var(--hdr-panel)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderBottom: "1px solid var(--hdr-border)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            <button
              type="button"
              onClick={() => setRealEstateOpen(open => !open)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-sgs-bg"
              style={{ color: "var(--sgs-primary)" }}
              aria-haspopup="menu"
              aria-expanded={realEstateOpen}
            >
              <span>{lang === "vi" ? "Bất Động Sản" : "Real Estate"}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${realEstateOpen ? "rotate-180" : ""}`} />
            </button>
            {realEstateOpen && (
              <div className="ml-3 space-y-1 border-l border-[var(--hdr-border)] pl-2" role="menu">
                {realEstateLinks.map(link => (
                  <Link
                    key={link.href}
                    href={localizedHref(link.href)}
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-sgs-bg"
                    style={{ color: "var(--sgs-primary)" }}
                    role="menuitem"
                  >
                    {lang === "vi" ? link.vi : link.en}
                  </Link>
                ))}
              </div>
            )}
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={localizedHref(link.href)}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-sgs-bg"
                style={{ color: "var(--sgs-primary)" }}
              >
                {lang === "vi" ? link.vi : link.en}
              </Link>
            ))}
            <div
              className="pt-3 flex gap-2"
              style={{ borderTop: "1px solid rgba(27,58,92,0.08)" }}
            >
              <button
                onClick={toggleLang}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg"
                style={{ background: "var(--hdr-panel)", border: "1px solid var(--hdr-border)", color: "var(--sgs-primary)" }}
                aria-label="Chuyển ngôn ngữ"
              >
                {lang.toUpperCase()}
              </button>
              <button
                onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg"
                style={{ background: "var(--hdr-panel)", border: "1px solid var(--hdr-border)", color: "var(--sgs-primary)" }}
                aria-label="Chuyển chế độ sáng tối"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-2">
              <Link
                href={authed ? "/dashboard" : "/login"}
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm font-medium py-2.5 rounded-lg transition-colors"
                style={{ border: "1.5px solid var(--sgs-primary)", color: "var(--sgs-primary)" }}
              >
                {authed ? (lang === "vi" ? "Tổng quan" : "Dashboard") : (lang === "vi" ? "Đăng nhập" : "Sign in")}
              </Link>
              <Link
                href="/ai-valuation"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm font-semibold py-2.5 rounded-lg"
                style={{ background: "var(--sgs-accent)", color: "var(--sgs-primary-deep)" }}
              >
                Định Giá AI
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default PublicHeader;
