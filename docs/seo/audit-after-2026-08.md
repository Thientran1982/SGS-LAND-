# SGS LAND — SEO/GEO/AEO Audit After

**Audit date:** 2026-08-20  
**Local crawl target:** `http://localhost:5000`  
**Production reference:** `https://sgsland.vn`

## Executive summary

The existing production audit baseline scored 93/100 across 50 crawled pages. The score is useful as a directional signal, but the old crawler over-counted repeated sitewide JSON-LD nodes and did not resolve sitemap indexes recursively. This pass adds a deterministic regression crawl against the running Next.js surface.

### Verified after changes

- Sitemap index recursively resolved: **54 page URLs**
- HTTP/status and HTML checks: **54/54 passed**
- Missing title/description/canonical: **0**
- Invalid JSON-LD blocks: **0**
- Canonical host violations: **0**
- H1 checks: **0 failures**
- robots sitemap declaration: **pass**
- Typecheck: **pass**
- Automated tests: **20 files / 148 tests passed**

## P0/P1 fixes shipped

1. Removed stale sitemap entries that returned 404:
   - `/lai-suat-ngan-hang-moi-nhat`
   - `/mua-nha-lan-dau`
   - `/can-ho-duoi-2-ty-tphcm`
   - `/mua-hay-thue-nha-tphcm`
   - `/vinhomes-hoc-mon`
2. Removed `/livechat` from the sitemap because it is intentionally disallowed and is not a search landing page.
3. Added a safe article-description fallback in `server/seo/metaInjector.ts` so legacy articles without excerpt/content do not emit an empty meta description.
4. Removed duplicate project H1 markup between the server-rendered crawler fallback and the interactive project component.
5. Added a server-rendered H1 to Marketplace, whose primary UI is a client component.
6. Added `scripts/seo-regression.mjs` and `npm run audit:seo-regression` to recursively crawl every sitemap URL and validate indexability fundamentals.

## Remaining P1/P2 work

- Review factual claims and numeric SEO copy against source documents before publishing; the audit tool cannot prove whether a business statistic is true.
- Add authoritative outbound citations only to pages that make legal, market or rate claims, and include source date/URL in visible content.
- Run Lighthouse/CrUX from a production-like browser environment; the existing audit could not run Lighthouse because Chrome/Lighthouse is not installed in this workspace.
- Resolve the remaining title/description length and heading hierarchy warnings page-by-page where they reflect real user-facing content, not hidden crawler fallbacks.
- Establish Google Search Console/Bing performance baselines (impressions, CTR, query position, indexed pages) before prioritizing content refreshes.

## Re-run

```bash
SEO_BASE_URL=http://localhost:5000 npm run audit:seo-regression
```

The command writes:

- `docs/seo/seo-regression-latest.json`
- `docs/seo/seo-regression-latest.md`
