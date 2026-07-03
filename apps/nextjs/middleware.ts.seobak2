import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Routes that require authentication ───────────────────
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/leads",
  "/contracts",
  "/inventory",
  "/projects",
  "/favorites",
  "/inbox",
  "/reports",
  "/approvals",
  "/routing-rules",
  "/sequences",
  "/campaigns",
  "/knowledge",
  "/scoring-rules",
  "/marketplace-apps",
  "/data-platform",
  "/security",
  "/ai-governance",
  "/seo-manager",
  "/error-monitor",
  "/profile",
  "/admin-users",
  "/enterprise-settings",
  "/admin-ai-cost",
  "/billing",
  "/checkout",
  "/vendor-management",
  "/task-dashboard",
  "/task-kanban",
  "/tasks",
  "/employees",
  "/task-reports",
  "/scraper",
];

// ─── Routes accessible only when NOT logged in ────────────
const AUTH_ONLY_ROUTES = ["/login", "/reset-password", "/verify-email"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Detect auth via JWT cookie (set by Express backend)
  const token = request.cookies.get("auth_token")?.value
    || request.cookies.get("sgs_token")?.value;
  const isAuthenticated = Boolean(token);

  // ── Redirect logged-in users away from auth pages ───────
  if (isAuthenticated && AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── Guard private routes ─────────────────────────────────
  const isPrivate = PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPrivate && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Security headers for all responses ──────────────────
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, manifest.json, robots.txt, sitemap*
     * - public folder assets (images, icons, etc.)
     */
    "/((?!_next/static|_next/image|favicon|manifest|robots|sitemap|icon-|apple-touch|og-image|images/|fonts/).*)",
  ],
};
