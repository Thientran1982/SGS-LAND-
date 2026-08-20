import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { getLang } from "@/lib/lang";
import { LangProvider } from "@/components/shared/LangProvider";
import { SchemaScript } from "@/components/SchemaScript";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import ConsentBanner from "@/components/ConsentBanner";
import { getOrganizationSchema, getWebsiteSchema, getEntityDisambiguationSchema, getMetricsSchema, getLocalBusinessSchema, getAggregateRatingSchema } from "@/lib/schema";
// ─── Fonts (self-hosted by next/font — no Google Fonts request at runtime) ──
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  variable: "--font-be-vietnam",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["500", "600", "700"],
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
    "sàn quản lý bất động sản",
    "CRM bất động sản",
    "phần mềm môi giới bất động sản",
    "định giá bất động sản AI",
    "quản lý kho hàng bất động sản",
    "SGS LAND",
    "AI bất động sản",
    "hệ thống quản lý khách hàng bất động sản",
    "sàn top 1 bất động sản Việt Nam",
  ],
  authors: [{ name: "SGS Land Corp", url: "https://sgsland.vn" }],
  creator: "SGS Land Co.ltd",
  publisher: "SGS Land Co.ltd",
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
    types: {
      "application/rss+xml": [
        { url: "https://sgsland.vn/feed.xml", title: "SGS LAND - Tin tuc bat dong san" },
      ],
    },
    languages: {
      vi: "https://sgsland.vn/",
      // The EN site lives at /en (see middleware + sitemap-en.xml); ?lang=en is
      // not a real URL, so this default hreflang pointed crawlers at a 200 that
      // renders the Vietnamese homepage.
      en: "https://sgsland.vn/en",
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
    { media: "(prefers-color-scheme: light)", color: "var(--sgs-primary)" },
    { media: "(prefers-color-scheme: dark)",  color: "#312E81" },
  ],
};
// Force SSR on every page — prevents the /_not-found static-prerender crash
// where Next.js 15's ContextOnlyDispatcher returns null for OuterLayoutRouter.
// All user-facing pages are already under force-dynamic group layouts so this
// only affects the not-found route; it has no impact on performance.
export const dynamic = "force-dynamic";
// ─── Root Layout ───────────────────────────────────────────
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang === "en" ? "en" : "vi"} suppressHydrationWarning>
      <head>
        {/* Preconnect to key third-party origins for LCP improvement */}
        <link rel="preconnect" href="https://c.clarity.ms" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://c.clarity.ms" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-3LBRB691S4" />
      </head>
      <body
        className={`${beVietnamPro.variable} ${ibmPlexMono.variable} ${fraunces.variable} font-sans antialiased`}
        style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
      >
        {/* Inline <script> tags live at the top of <body>, not in <head>:
            the Replit dev proxy injects its own <script> into <head>, which
            shifts positions and breaks React hydration in the preview. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-3LBRB691S4');`,
          }}
        />

        {/* Sitewide JSON-LD: WebSite (SearchAction) + Organization (E-E-A-T) */}
        <SchemaScript schemas={[
            getWebsiteSchema(),
            getOrganizationSchema(),
            getLocalBusinessSchema(),
            getEntityDisambiguationSchema(),
            getMetricsSchema(),
            getAggregateRatingSchema(),
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
        <LangProvider lang={lang}>
          {children}
          <ConsentBanner />
        </LangProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}