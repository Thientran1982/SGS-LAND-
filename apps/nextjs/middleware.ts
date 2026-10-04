import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Single source of truth - next.config.ts proxies exactly these prefixes to Express.
import { PRIVATE_PREFIXES } from "./config/routes";

// ─── Routes that require authentication ───────────────────

// ─── Routes accessible only when NOT logged in ────────────
const AUTH_ONLY_ROUTES = ["/login", "/reset-password", "/verify-email"];

export async function middleware(request: NextRequest) {
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

  // Consumer articles use `/tin-tuc`; keep the authenticated publishing
  // workspace under `/news/dang-tin` while canonicalizing old public article
  // links, including deep links shared by search engines and social posts.
  if (pathname === "/news" || pathname.startsWith("/news/")) {
    const segments = pathname.split("/").filter(Boolean);
    const articlePath = segments.slice(1).join("/");
    if (segments[1] !== "dang-tin") {
      const canonical = request.nextUrl.clone();
      canonical.pathname = `${lang === "en" ? "/en" : ""}/tin-tuc${articlePath ? `/${articlePath}` : ""}`;
      return NextResponse.redirect(canonical, 308);
    }
  }

  // Resolve article existence before the route shell can stream. The public
  // API exposes published articles only and returns 404 for missing/draft slugs.
  const articleSegments = pathname.split("/").filter(Boolean);
  if (articleSegments.length === 2 && articleSegments[0] === "tin-tuc") {
    const rewriteToNotFound = () => {
      const notFoundUrl = request.nextUrl.clone();
      notFoundUrl.pathname = "/_not-found";
      const headers = new Headers(request.headers);
      headers.set("x-sgs-lang", lang);
      const response = NextResponse.rewrite(notFoundUrl, {
        request: { headers },
        status: 404,
      });
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    };

    let slug: string;
    try {
      slug = decodeURIComponent(articleSegments[1]);
    } catch {
      return rewriteToNotFound();
    }

    const apiBase = (
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:5001"
    ).replace(/\/+$/, "");

    try {
      const articleResponse = await fetch(
        `${apiBase}/api/public/articles/${encodeURIComponent(slug)}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (articleResponse.status === 404) return rewriteToNotFound();
      if (!articleResponse.ok) {
        return new NextResponse("Article availability is temporarily unknown", {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": "60",
            "X-Robots-Tag": "noindex",
          },
        });
      }

      const article = await articleResponse.json();
      if (article?.slug !== slug) {
        return new NextResponse("Article availability is temporarily unknown", {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": "60",
            "X-Robots-Tag": "noindex",
          },
        });
      }
    } catch {
      return new NextResponse("Article availability is temporarily unknown", {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "60",
          "X-Robots-Tag": "noindex",
        },
      });
    }
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
