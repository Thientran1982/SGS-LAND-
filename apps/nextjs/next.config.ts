import type { NextConfig } from "next";
import path from "path";
import { PRIVATE_PREFIXES } from "./config/routes";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

// Absolute paths to THIS workspace's node_modules
// — prevents dual-React-instance errors when root workspace has React 18
const LOCAL_NM    = path.resolve(__dirname, "node_modules");
const REACT_PATH  = path.resolve(LOCAL_NM, "react");
const RDOM_PATH   = path.resolve(LOCAL_NM, "react-dom");
const RJSX_PATH   = path.resolve(LOCAL_NM, "react/jsx-runtime");

const nextConfig: NextConfig = {
  // ---- Transpile root workspace packages (pages, components, services) ----
  transpilePackages: [
    // Root-level packages that Next.js needs to compile
  ],
  
  // ─── Output & Build ────────────────────────────────────
  // Optional temp output dir so a prod build can be tested without
  // clobbering the running dev server .next directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
      { source: "/home", destination: "/" },
      // Private CRM app (Vite) proxied on same domain via BACKEND_URL
// Private CRM app (Vite SPA served by Express) proxied on the same domain.
      // The prefix list is imported from config/routes.ts, the same source the
      // middleware guard uses, so the two can never drift apart again: before
      // this, only /dashboard was proxied, so a deep link such as /inventory
      // reached Next.js, matched no page and returned 404.
      ...PRIVATE_PREFIXES.flatMap((prefix) => [
        { source: prefix, destination: `${BACKEND_URL}${prefix}` },
        { source: `${prefix}/:path*`, destination: `${BACKEND_URL}${prefix}/:path*` },
      ]),
      { source: "/@vite/:path*", destination: BACKEND_URL + "/@vite/:path*" },
      { source: "/@react-refresh", destination: BACKEND_URL + "/@react-refresh" },
      { source: "/@fs/:path*", destination: BACKEND_URL + "/@fs/:path*" },
      { source: "/@id/:path*", destination: BACKEND_URL + "/@id/:path*" },
      { source: "/@vite-plugin-checker-runtime", destination: BACKEND_URL + "/@vite-plugin-checker-runtime" },
      { source: "/src/:path*", destination: BACKEND_URL + "/src/:path*" },
      { source: "/assets/:path*", destination: BACKEND_URL + "/assets/:path*" },
      { source: "/node_modules/.vite/:path*", destination: BACKEND_URL + "/node_modules/.vite/:path*" },
      // Vite dev entry + root init scripts (dev only; prod uses built /assets)
      { source: "/index.tsx", destination: BACKEND_URL + "/index.tsx" },
      { source: "/theme-init.js", destination: BACKEND_URL + "/theme-init.js" },
      { source: "/clarity-init.js", destination: BACKEND_URL + "/clarity-init.js" },
      { source: "/critical.css", destination: BACKEND_URL + "/critical.css" },
      { source: "/node_modules/:path*", destination: BACKEND_URL + "/node_modules/:path*" },
      // Vite dev source tree (repo root served at /) — dev only; prod uses built /assets
      { source: "/components/:path*", destination: BACKEND_URL + "/components/:path*" },
      { source: "/config/:path*", destination: BACKEND_URL + "/config/:path*" },
      { source: "/pages/:path*", destination: BACKEND_URL + "/pages/:path*" },
      { source: "/schemas/:path*", destination: BACKEND_URL + "/schemas/:path*" },
      { source: "/shared/:path*", destination: BACKEND_URL + "/shared/:path*" },
      { source: "/services/:path*", destination: BACKEND_URL + "/services/:path*" },
      { source: "/styles/:path*", destination: BACKEND_URL + "/styles/:path*" },
      { source: "/types/:path*", destination: BACKEND_URL + "/types/:path*" },
      { source: "/utils/:path*", destination: BACKEND_URL + "/utils/:path*" },
      { source: "/attached_assets/:path*", destination: BACKEND_URL + "/attached_assets/:path*" },
      { source: "/hooks/:path*", destination: BACKEND_URL + "/hooks/:path*" },
      { source: "/contexts/:path*", destination: BACKEND_URL + "/contexts/:path*" },
      { source: "/lib/:path*", destination: BACKEND_URL + "/lib/:path*" },
      { source: "/assets/:path*", destination: BACKEND_URL + "/assets/:path*" },
      { source: "/App.tsx", destination: BACKEND_URL + "/App.tsx" },
      { source: "/types.ts", destination: BACKEND_URL + "/types.ts" },
      // Reliability fix: /health la liveness probe cua Express (server.ts:3985).
      // Truoc day Next tra 404 HTML cho /health tren port public 5000.
      { source: "/health", destination: `${BACKEND_URL}/health` },
      { source: "/api/:path*",        destination: `${BACKEND_URL}/api/:path*` },
      { source: "/socket.io/:path*",  destination: `${BACKEND_URL}/socket.io/:path*` },
      { source: "/yjs/:path*",        destination: `${BACKEND_URL}/yjs/:path*` },
      { source: "/uploads/:path*",    destination: `${BACKEND_URL}/uploads/:path*` },
      // NOTE: the /images/:path* proxy to Express was removed. Express serves no
      // static image folder, so missing files fell through to the SPA catch-all and
      // returned index.html (200 text/html); next/image then answered 400.
      // Without the proxy a missing file returns a clean 404 instead.
      { source: "/og/:path*",         destination: `${BACKEND_URL}/og/:path*` },
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
        headers: [{ key: "Cache-Control", value: (process.env.NODE_ENV === "production" ? "public, max-age=31536000, immutable" : "no-store") }],
      },
    ];
  },

  // ─── Redirects ─────────────────────────────────────────
  async redirects() {
    return [
      { source: "/search",                  destination: "/marketplace",             permanent: true },
      { source: "/bat-dong-san",            destination: "/marketplace",             permanent: true },
      { source: "/mua",                    destination: "/marketplace?transaction=SALE", permanent: false },
      { source: "/thue",                   destination: "/marketplace?transaction=RENT", permanent: false },
      { source: "/en/mua",                 destination: "/en/marketplace?transaction=SALE", permanent: false },
      { source: "/en/thue",                destination: "/en/marketplace?transaction=RENT", permanent: false },
      { source: "/lai-suat-vay-ngan-hang",  destination: "/lai-suat-ngan-hang",      permanent: true },
      { source: "/lai-suat-vay-mua-nha",    destination: "/lai-suat-ngan-hang",      permanent: true },
      { source: "/nha-pho-trung-tam",       destination: "/khu-vuc/nha-pho-trung-tam", permanent: true },
      { source: "/landing/aqua-city", destination: "/du-an/aqua-city", permanent: true },
    ];
  },

  // ─── Dev server — allow Replit proxied origins ────────
  allowedDevOrigins: [
    "*.replit.dev",
    "*.worf.replit.dev",
    "*.replit.app",
    "localhost",
    "localhost:3000",
    "localhost:3001",
    "localhost:5000",
    "0.0.0.0",
    "0.0.0.0:3000",
    "0.0.0.0:3001",
    "0.0.0.0:5000",
    "127.0.0.1",
    "127.0.0.1:5000",
    "127.0.0.1:3000",
    "127.0.0.1:3001",
  ],

  // ─── Next.js dev tools & indicators — disable both to prevent
  //     dual-React-instance useContext null crash in monorepo setup
  devIndicators: false,

  // ─── Experimental ─────────────────────────────────────
    experimental: {
    // Allow importing shared modules from outside apps/nextjs (monorepo root)
    externalDir: true,
    // Only include safe, pure ESM-tree-shakeable packages here
    optimizePackageImports: ["lucide-react"],
  },

  // ─── Webpack customisations ────────────────────────────
  webpack(config, { isServer }) {
    // 1. Force ALL bundles (client + server + edge) to resolve React from
    //    this package's node_modules — critical in monorepos with React 18 root
    config.resolve.alias = {
      ...config.resolve.alias,
      // DO NOT alias react / react-dom / react-jsx-runtime here.
      // Next.js already maps them to its own vendored copies, separately for the
      // react-server layer and the client/SSR layer. Overriding that mixes two
      // React copies: during SSR the dispatcher becomes null and Next's internal
      // layout-router throws "Cannot read properties of null (reading
      // 'useContext')", which made EVERY production route answer HTTP 500
      // (page still rendered, but status 500 - very bad for SEO).
      // resolve.modules below is enough to prefer this package's node_modules.
      // react:               REACT_PATH,
      // "react-dom":         RDOM_PATH,
      // "react/jsx-runtime": RJSX_PATH,
      // Leaflet SSR fix — window is not defined in Node.js
      // Client MUST bundle Leaflet, otherwise L.map is not a function.
      // Only the server bundle needs it stubbed (window is not defined).
      ...(isServer ? { leaflet: false } : {}),
      // Replace crashing Next.js 15.5 dev segment explorer (uses useContext in SSR
      // before React dispatcher is ready — monorepo React 18 root / React 19 app
      // version mismatch triggers null dispatcher).  No-op prevents the 500 crash.
      [path.resolve(LOCAL_NM, "next/dist/next-devtools/userspace/app/segment-explorer-node")]:
        path.resolve(__dirname, "segment-explorer-noop.js"),
    };

    // 2. Prefer local node_modules over root workspace node_modules
    config.resolve.modules = [LOCAL_NM, "node_modules"];

    return config;
  },
};

export default nextConfig;
