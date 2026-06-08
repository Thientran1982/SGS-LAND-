import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SchemaScript } from "@/components/SchemaScript";
import { getOrganizationSchema, getWebsiteSchema, getEntityDisambiguationSchema, getMetricsSchema, getLocalBusinessSchema } from "@/lib/schema";

// ─── Fonts (self-hosted by next/font — no Google Fonts request at runtime) ──
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500"],
});

// ─── Global Metadata ───────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL("https://sgsland.vn"),
  title: {
    default: "SGS LAND | Nền Tảng Quản Lý Bất Động Sản AI Số 1 Việt Nam",
    template: "%s | SGS LAND",
  },
  description:
    "SGS LAND - Nền tảng BĐS AI: định giá tự động, CRM đa kênh, quản lý kho hàng toàn diện. Giải pháp #1 cho sàn giao dịch và doanh nghiệp bất động sản Việt Nam.",
  keywords: [
    "phần mềm quản lý bất động sản",
    "CRM bất động sản",
    "phần mềm môi giới bất động sản",
    "định giá bất động sản AI",
    "quản lý kho hàng bất động sản",
    "SGS LAND",
    "AI bất động sản",
    "hệ thống quản lý khách hàng bất động sản",
    "phần mềm bất động sản Việt Nam",
  ],
  authors: [{ name: "SGS Land Corp", url: "https://sgsland.vn" }],
  creator: "SGS Land Corp",
  publisher: "SGS Land Corp",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://sgsland.vn",
    languages: {
      vi: "https://sgsland.vn/",
      en: "https://sgsland.vn/?lang=en",
      "x-default": "https://sgsland.vn/",
    },
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    alternateLocale: ["en_US"],
    siteName: "SGS LAND",
    title: "SGS LAND | Nền Tảng Quản Lý Bất Động Sản AI Số 1 Việt Nam",
    description:
      "Nền tảng quản lý bất động sản thế hệ mới với AI định giá tự động, CRM đa kênh và quản lý kho hàng toàn diện. Tin dùng bởi Vinhomes, Masterise, Keppel, Gamuda.",
    url: "https://sgsland.vn",
    images: [
      {
        url: "https://sgsland.vn/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "SGS LAND - Nền tảng quản lý bất động sản AI tại Việt Nam",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@SGSLand",
    creator: "@SGSLand",
    title: "SGS LAND | Nền Tảng Quản Lý Bất Động Sản AI Số 1 Việt Nam",
    description:
      "Nền tảng quản lý bất động sản thế hệ mới với AI định giá tự động, CRM đa kênh và quản lý kho hàng toàn diện.",
    images: {
      url: "https://sgsland.vn/og-image.jpg",
      alt: "SGS LAND - Nền tảng quản lý bất động sản AI tại Việt Nam",
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  other: {
    "geo.region": "VN",
    "geo.placename": "Vietnam",
    "geo.position": "10.776920;106.700981",
    ICBM: "10.776920, 106.700981",
    "DC.language": "vi",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4F46E5" },
    { media: "(prefers-color-scheme: dark)",  color: "#312E81" },
  ],
};

// Force SSR on every page — prevents the /_not-found static-prerender crash
// where Next.js 15's ContextOnlyDispatcher returns null for OuterLayoutRouter.
// All user-facing pages are already under force-dynamic group layouts so this
// only affects the not-found route; it has no impact on performance.
export const dynamic = "force-dynamic";

// ─── Root Layout ───────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Preconnect to key third-party origins for LCP improvement */}
        <link rel="preconnect" href="https://c.clarity.ms" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://c.clarity.ms" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

        {/* Sitewide JSON-LD: WebSite (SearchAction) + Organization (E-E-A-T) */}
        <SchemaScript schemas={[
            getWebsiteSchema(),
            getOrganizationSchema(),
            getLocalBusinessSchema(),
            getEntityDisambiguationSchema(),
            getMetricsSchema(),
          ]} />

        {/* FOUC prevention: apply saved theme class to <html> before first paint.
            Replaces next-themes ThemeProvider for pages outside route groups
            (landing pages, login) that must render as pure Server Components. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('sgs-theme')||'light';document.documentElement.classList.add(t)}catch(e){document.documentElement.classList.add('light')}`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
      >
        {children}
      </body>
    </html>
  );
}
