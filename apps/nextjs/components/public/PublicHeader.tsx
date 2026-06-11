// @ts-nocheck
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Sun, Moon, Globe, User, Menu, X, Sparkles } from "lucide-react";

type Lang = "vi" | "en";
type Theme = "light" | "dark";

export function PublicHeader() {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [theme, setTheme]         = useState<Theme>("light");
  const [lang, setLang]           = useState<Lang>("vi");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("sgs-theme") as Theme | null;
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
      else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
      const savedLang = localStorage.getItem("sgs-lang") as Lang | null;
      if (savedLang === "vi" || savedLang === "en") setLang(savedLang);
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
    setLang(next);
    try { localStorage.setItem("sgs-lang", next); } catch {}
    window.dispatchEvent(new CustomEvent("sgs-lang-change", { detail: next }));
  };

  const navLinks = [
    { href: "/du-an",                vi: "Dự Án",        en: "Projects"     },
    { href: "/ai-valuation",         vi: "Định Giá AI",  en: "AI Valuation" },
    { href: "/marketplace?type=ban", vi: "Mua",          en: "Buy"          },
    { href: "/marketplace?type=thue",vi: "Thuê",         en: "Rent"         },
    { href: "/news",                 vi: "Tin Tức",      en: "News"         },
    { href: "/contact",              vi: "Liên Hệ",      en: "Contact"      },
  ];

  const isHero = !scrolled;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background:      isHero
          ? "linear-gradient(to bottom, rgba(10,30,51,0.72) 0%, rgba(10,30,51,0.0) 100%)"
          : "rgba(255,255,255,0.93)",
        backdropFilter:  isHero ? "none"   : "blur(14px)",
        WebkitBackdropFilter: isHero ? "none" : "blur(14px)",
        borderBottom:    isHero ? "none"   : "1px solid rgba(27,58,92,0.12)",
        boxShadow:       isHero ? "none"   : "0 1px 20px rgba(15,39,64,0.08)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between" style={{ height: "64px" }}>

          {/* ── Logo ─────────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ background: "#C8963E" }}
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5" style={{ color: "#0F2740" }}>
                <path
                  d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"
                  stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"
                  fill="currentColor" fillOpacity="0.18"
                />
                <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div
                className="font-bold text-lg leading-tight"
                style={{
                  color: isHero ? "#FFFFFF" : "#1B3A5C",
                  fontFamily: "var(--font-noto-serif, var(--font-inter), Georgia, serif)",
                  letterSpacing: "-0.02em",
                }}
              >
                SGS <span style={{ color: "#C8963E" }}>LAND</span>
              </div>
              <div
                className="text-[9px] font-semibold uppercase hidden sm:block"
                style={{
                  color: isHero ? "rgba(200,150,62,0.85)" : "#8C6420",
                  letterSpacing: "0.2em",
                }}
              >
                Proptech
              </div>
            </div>
          </Link>

          {/* ── Desktop Nav ───────────────────────────────── */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: isHero ? "rgba(255,255,255,0.85)" : "#1B3A5C",
                  fontFamily: "var(--font-be-vietnam, var(--font-inter), sans-serif)",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = isHero ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.06)";
                  el.style.color = isHero ? "#FFFFFF" : "#0F2740";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "transparent";
                  el.style.color = isHero ? "rgba(255,255,255,0.85)" : "#1B3A5C";
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: isHero ? "rgba(255,255,255,0.12)" : "rgba(27,58,92,0.07)",
                border: `1px solid ${isHero ? "rgba(255,255,255,0.3)" : "rgba(27,58,92,0.18)"}`,
                color: isHero ? "#FFFFFF" : "#1B3A5C",
              }}
              aria-label="Chuyển ngôn ngữ VI / EN"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang.toUpperCase()}
            </button>

            {/* Light / Dark Toggle */}
            <button
              onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: isHero ? "rgba(255,255,255,0.12)" : "rgba(27,58,92,0.07)",
                border: `1px solid ${isHero ? "rgba(255,255,255,0.3)" : "rgba(27,58,92,0.18)"}`,
                color: isHero ? "#FFFFFF" : "#1B3A5C",
              }}
              aria-label="Chuyển chế độ sáng / tối"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Login — ghost outline */}
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                border: `1.5px solid ${isHero ? "rgba(255,255,255,0.45)" : "#1B3A5C"}`,
                color: isHero ? "rgba(255,255,255,0.92)" : "#1B3A5C",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = isHero ? "rgba(255,255,255,0.1)" : "rgba(27,58,92,0.06)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <User className="w-4 h-4" />
              {lang === "vi" ? "Đăng nhập" : "Sign in"}
            </Link>

            {/* CTA — Gold */}
            <Link
              href="/ai-valuation"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "#C8963E",
                color: "#0F2740",
                boxShadow: "0 2px 8px rgba(200,150,62,0.35)",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#D9A94E"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#C8963E"}
            >
              <Sparkles className="w-4 h-4" />
              {lang === "vi" ? "Định giá miễn phí" : "Free Valuation"}
            </Link>
          </div>

          {/* ── Mobile Hamburger ──────────────────────────── */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: isHero ? "#FFFFFF" : "#1B3A5C" }}
            aria-label="Mở menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Menu Drawer ─────────────────────────────── */}
      {menuOpen && (
        <div
          className="lg:hidden"
          style={{
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(27,58,92,0.1)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-slate-50"
                style={{ color: "#1B3A5C" }}
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
                style={{ background: "rgba(27,58,92,0.07)", color: "#1B3A5C" }}
                aria-label="Chuyển ngôn ngữ"
              >
                <Globe className="w-3.5 h-3.5" /> {lang.toUpperCase()}
              </button>
              <button
                onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-lg"
                style={{ background: "rgba(27,58,92,0.07)", color: "#1B3A5C" }}
                aria-label="Chuyển chế độ sáng tối"
              >
                {theme === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                {theme === "light" ? "Tối" : "Sáng"}
              </button>
            </div>
            <div className="flex gap-2">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm font-medium py-2.5 rounded-lg transition-colors"
                style={{ border: "1.5px solid #1B3A5C", color: "#1B3A5C" }}
              >
                {lang === "vi" ? "Đăng nhập" : "Sign in"}
              </Link>
              <Link
                href="/ai-valuation"
                onClick={() => setMenuOpen(false)}
                className="flex-1 text-center text-sm font-semibold py-2.5 rounded-lg"
                style={{ background: "#C8963E", color: "#0F2740" }}
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
