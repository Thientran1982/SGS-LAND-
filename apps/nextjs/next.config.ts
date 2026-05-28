import type { NextConfig } from "next";
import path from "path";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

// Absolute paths to THIS workspace's node_modules
// — prevents dual-React-instance errors when root workspace has React 18
const LOCAL_NM    = path.resolve(__dirname, "node_modules");
const REACT_PATH  = path.resolve(LOCAL_NM, "react");
const RDOM_PATH   = path.resolve(LOCAL_NM, "react-dom");
const RJSX_PATH   = path.resolve(LOCAL_NM, "react/jsx-runtime");

const nextConfig: NextConfig = {
  // ─── Output & Build ────────────────────────────────────
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Prevents hoisted root-workspace lockfile warning in monorepo
  outputFileTracingRoot: path.resolve(__dirname, "../../"),

  // ─── Server-only externals ─────────────────────────────────
  // Keep only packages that are truly incompatible with server-side bundling
  // (no React hooks, window/document-only APIs, or native binaries).
  // DO NOT list packages that use React hooks here — they must be webpack-bundled
  // so they share the same React instance as the rest of the server bundle.
  serverExternalPackages: [
    "socket.io-client",
    "leaflet",
    "dompurify",
    "html2canvas",
    "jspdf",
    "sharp",
  ],

  // ─── Image Optimization ────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "sgsland.vn" },
      { protocol: "https", hostname: "*.sgsland.vn" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "http",  hostname: "localhost" },
      { protocol: "https", hostname: "*.replit.dev" },
      { protocol: "https", hostname: "*.replit.app" },
      { protocol: "https", hostname: "*.worf.replit.dev" },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    minimumCacheTTL: 86400,
  },

  // ─── API Proxy Rewrites → Express backend ──────────────
  async rewrites() {
    return [
      { source: "/api/:path*",        destination: `${BACKEND_URL}/api/:path*` },
      { source: "/socket.io/:path*",  destination: `${BACKEND_URL}/socket.io/:path*` },
      { source: "/yjs/:path*",        destination: `${BACKEND_URL}/yjs/:path*` },
      { source: "/uploads/:path*",    destination: `${BACKEND_URL}/uploads/:path*` },
      // Proxy static media from Express public folder
      { source: "/images/:path*",     destination: `${BACKEND_URL}/images/:path*` },
      // Proxy only landing *sub-paths* (hero.jpg, etc.) to Express.
      // The root /landing/:slug path is handled by the Next.js SSG page — do NOT
      // rewrite it, or Express would serve the old static HTML instead.
      { source: "/landing/:slug/:path+", destination: `${BACKEND_URL}/landing/:slug/:path+` },
      // GEO: /.well-known/ served by Express for ai-plugin.json, openapi.json
      // Next.js Route Handler at app/.well-known/ai-plugin.json/route.ts takes
      // precedence for ai-plugin.json; this proxy is fallback for other files.
      { source: "/.well-known/:path*", destination: `${BACKEND_URL}/.well-known/:path*` },
    ];
  },

  // ─── Security Headers ──────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",       value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },

  // ─── Redirects ─────────────────────────────────────────
  async redirects() {
    return [
      { source: "/search",                  destination: "/marketplace",             permanent: true },
      { source: "/bat-dong-san",            destination: "/marketplace",             permanent: true },
      { source: "/lai-suat-vay-ngan-hang",  destination: "/lai-suat-ngan-hang",      permanent: true },
      { source: "/lai-suat-vay-mua-nha",    destination: "/lai-suat-ngan-hang",      permanent: true },
      { source: "/nha-pho-trung-tam",       destination: "/du-an/nha-pho-trung-tam", permanent: true },
      { source: "/developers",              destination: "/help-center",              permanent: false },
      { source: "/status",                  destination: "/help-center",              permanent: false },
    ];
  },

  // ─── Dev server — allow Replit proxied origins ────────
  allowedDevOrigins: [
    "*.replit.dev",
    "*.worf.replit.dev",
    "*.replit.app",
    "localhost:3000",
    "0.0.0.0:3000",
  ],

  // ─── Experimental ─────────────────────────────────────
  experimental: {
    // Only include safe, pure ESM-tree-shakeable packages here
    optimizePackageImports: ["lucide-react"],
  },

  // ─── Webpack customisations ────────────────────────────
  webpack(config) {
    // 1. Force ALL bundles (client + server + edge) to resolve React from
    //    this package's node_modules — critical in monorepos with React 18 root
    config.resolve.alias = {
      ...config.resolve.alias,
      react:               REACT_PATH,
      "react-dom":         RDOM_PATH,
      "react/jsx-runtime": RJSX_PATH,
      // Leaflet SSR fix — window is not defined in Node.js
      leaflet: false,
    };

    // 2. Prefer local node_modules over root workspace node_modules
    config.resolve.modules = [LOCAL_NM, "node_modules"];

    return config;
  },
};

export default nextConfig;
