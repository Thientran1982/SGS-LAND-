import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Single source of truth - next.config.ts proxies exactly these prefixes to Express.
import { PRIVATE_PREFIXES } from "./config/routes";

// ─── Routes that require authentication ───────────────────

// ─── Routes accessible only when NOT logged in ────────────
const AUTH_ONLY_ROUTES = ["/login", "/reset-password", "/verify-email"];

export function middleware(request: NextRequest) {
  let { pathname } = request.nextUrl;

  // —— Canonical host: 301 redirect www → non-www (SEO consolidation) ——
  const host = request.headers.get("host") || "";
  if (host.startsWith("www.")) {
    return NextResponse.redirect(
      `https://${host.slice(4)}${pathname}${request.nextUrl.search}`,
      301,
    );
  }

  // —— Locale: /en/<route> renders the English variant of the same route ——
  // We rewrite instead of duplicating 59 page files; getLang() reads the header.
  let lang: "vi" | "en" = "vi";
  let localeRewrite = false;
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    lang = "en";
    pathname = pathname.slice(3) || "/";
    localeRewrite = true;
  }

  // —— Hard 404 cho cac route co tap slug dong (tranh soft-404) ——
  // notFound() trong route dong chi tra 200 vi shell da stream, nen chan tu day.
  const DEV_SLUGS = new Set([
    "vinhomes",
    "novaland",
    "masterise-homes",
    "nam-long",
    "van-phuc-group",
    "son-kim-land",
    "dai-quang-minh",
  ]);
  const AUTHOR_SLUGS = new Set([
    "tran-minh-thien",
    "nguyen-hoang-nam",
    "le-thi-hoa",
    "chuyen-gia-phap-ly",
    "ban-bien-tap",
  ]);
  if (pathname.startsWith("/tac-gia/")) {
    const seg = pathname.split("/")[2];
    if (seg && !AUTHOR_SLUGS.has(seg)) {
      const nf = request.nextUrl.clone();
      nf.pathname = "/_not-found";
      return NextResponse.rewrite(nf, { status: 404 });
    }
  }
  // /bds/<slug> chi hop le khi slug ket thuc bang UUID (trang detail tra cuu theo UUID)
  if (pathname.startsWith("/bds/")) {
    const seg = pathname.split("/")[2] || "";
    const TRAILING_UUID =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (seg && !TRAILING_UUID.test(seg)) {
      const nf = request.nextUrl.clone();
      nf.pathname = "/_not-found";
      return NextResponse.rewrite(nf, { status: 404 });
    }
  }
  if (pathname.startsWith("/chu-dau-tu/")) {
    const seg = pathname.split("/")[2];
    if (seg && !DEV_SLUGS.has(seg)) {
      const nf = request.nextUrl.clone();
      nf.pathname = "/_not-found";
      return NextResponse.rewrite(nf, { status: 404 });
    }
  }

  // Detect auth via JWT cookie (set by Express backend)
  const token =
    request.cookies.get("auth_token")?.value ||
    request.cookies.get("sgs_token")?.value ||
    request.cookies.get("token")?.value;
  const isAuthenticated = Boolean(token);

  // ── Redirect logged-in users away from auth pages ───────
  if (isAuthenticated && AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const safeRedirect =
      redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
        ? redirectParam
        : null;
    return NextResponse.redirect(
      new URL(safeRedirect || (lang === "en" ? "/en/dashboard" : "/dashboard"), request.url),
    );
  }

  // ── Guard private routes ─────────────────────────────────
  const isPrivate = PRIVATE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (isPrivate && !isAuthenticated) {
    const loginUrl = new URL(
      lang === "en" ? "/en/login" : "/login",
      request.url,
    );
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Security headers for all responses ──────────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-sgs-lang", lang);
  let response: NextResponse;
  if (localeRewrite) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
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
