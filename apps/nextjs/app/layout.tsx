import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shared/Providers";

// ─── Font ─────────────────────────────────────────────────
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
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

// ─── JSON-LD: WebSite + Organization ──────────────────────
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://sgsland.vn/#website",
      name: "SGS LAND",
      alternateName: ["SGSID", "SGS Land Corp", "SGS Land Enterprise"],
      url: "https://sgsland.vn",
      inLanguage: ["vi", "en"],
      description:
        "Nền tảng quản lý bất động sản thế hệ mới với AI định giá, CRM đa kênh và quản lý kho hàng toàn diện.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://sgsland.vn/marketplace?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
      publisher: { "@id": "https://sgsland.vn/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://sgsland.vn/#organization",
      name: "SGS LAND",
      alternateName: "SGS Land Corp",
      legalName: "Công ty Cổ phần SGS Land",
      url: "https://sgsland.vn",
      logo: {
        "@type": "ImageObject",
        "@id": "https://sgsland.vn/#logo",
        url: "https://sgsland.vn/icon-512.png",
        width: 512,
        height: 512,
        caption: "SGS LAND Logo",
      },
      image: { "@type": "ImageObject", url: "https://sgsland.vn/og-image.jpg" },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+84-971-132-378",
        contactType: "customer service",
        areaServed: "VN",
        availableLanguage: ["Vietnamese", "English"],
      },
      address: {
        "@type": "PostalAddress",
        addressCountry: "VN",
        addressLocality: "Hồ Chí Minh",
      },
      sameAs: ["https://www.linkedin.com/company/sgsland"],
    },
  ],
};

// ─── Root Layout ───────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://sgsland.vn" />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
