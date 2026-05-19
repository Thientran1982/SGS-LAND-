"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, Phone, Search } from "lucide-react";

// ─── Nav Items ────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Bất động sản", href: "/marketplace" },
  {
    label: "Dự án",
    href: "/du-an",
    children: [
      { label: "Aqua City Novaland", href: "/du-an/aqua-city" },
      { label: "The Global City", href: "/du-an/the-global-city" },
      { label: "Izumi City Nam Long", href: "/du-an/izumi-city" },
      { label: "Vinhomes Grand Park", href: "/du-an/vinhomes-grand-park" },
      { label: "Vinhomes Cần Giờ", href: "/du-an/vinhomes-can-gio" },
      { label: "Masteri Cosmo Central", href: "/p/mcc" },
    ],
  },
  {
    label: "Giải pháp",
    href: "/crm-platform",
    children: [
      { label: "CRM Bất Động Sản", href: "/crm-platform" },
      { label: "Định giá AI", href: "/ai-valuation" },
      { label: "Ký gửi BĐS", href: "/ky-gui-bat-dong-san" },
      { label: "Lãi suất ngân hàng", href: "/lai-suat-ngan-hang" },
    ],
  },
  { label: "Tin tức", href: "/news" },
  { label: "Về chúng tôi", href: "/about-us" },
  { label: "Liên hệ", href: "/contact" },
];

// ─── Logo SVG ─────────────────────────────────────────────
function SgsLogo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary-600)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="SGS LAND Logo"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 12l10 5 10-5" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  );
}

export function PublicHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Scroll detection for shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile on route change
  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? "glass-card shadow-token-md"
          : "bg-[var(--bg-surface)]/95 backdrop-blur-sm border-b border-[var(--border-default)]"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <SgsLogo />
            <span className="font-bold text-lg tracking-tight" style={{ color: "var(--text-primary)" }}>
              SGS <span style={{ color: "var(--primary-600)" }}>LAND</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) =>
              item.children ? (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(item.href)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname?.startsWith(item.href)
                        ? "text-[var(--primary-600)] bg-[var(--primary-subtle)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                    }`}
                  >
                    {item.label}
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </button>

                  {/* Dropdown */}
                  {openDropdown === item.href && (
                    <div className="absolute top-full left-0 pt-1 z-50">
                      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-token-lg py-1.5 min-w-52">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="flex items-center px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "text-[var(--primary-600)] bg-[var(--primary-subtle)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <a
              href="tel:+84971132378"
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--primary-600)] transition-colors"
            >
              <Phone className="w-4 h-4" />
              0971 132 378
            </a>
            <Link
              href="/marketplace"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: "var(--primary-600)" }}
            >
              <Search className="w-4 h-4" />
              Tìm BĐS
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              Đăng nhập
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-lg transition-colors hover:bg-[var(--bg-elevated)]"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Mở menu"
          >
            {mobileOpen ? (
              <X className="w-6 h-6" style={{ color: "var(--text-primary)" }} />
            ) : (
              <Menu className="w-6 h-6" style={{ color: "var(--text-primary)" }} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4 pb-6 pt-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`block px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                  pathname?.startsWith(item.href)
                    ? "text-[var(--primary-600)] bg-[var(--primary-subtle)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                {item.label}
              </Link>
              {item.children && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="pt-4 border-t border-[var(--border-default)] flex flex-col gap-3">
            <a
              href="tel:+84971132378"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-[var(--bg-elevated)]"
              style={{ color: "var(--text-primary)" }}
            >
              <Phone className="w-4 h-4" />
              Gọi ngay: 0971 132 378
            </a>
            <Link
              href="/marketplace"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--primary-600)" }}
            >
              <Search className="w-4 h-4" />
              Tìm kiếm BĐS
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-center py-3 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            >
              Đăng nhập hệ thống
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
