# Sprint 4 — SEO/GEO measurement and regression control

**Review date:** 2026-09-15  
**Baseline export:** Google Search Console Web export, property `https://sgsland.vn/`, 2026-05-19 through 2026-08-18, exported 2026-08-20.

## Scope completed

- Resolved the duplicate Hóc Môn route:
  - canonical `/du-an/vinhomes-hoc-mon` now has one dedicated page;
  - typo `/du-an/vinhhomes-hoc-mon` redirects to the canonical route;
  - unsupported price, area, launch, legal and distribution claims were removed from the canonical page’s metadata, JSON-LD and visible content;
  - the canonical page now exposes the shared GEO review date, evidence state, direct answer, editorial owner and verification checklist.
- Added `scripts/gsc-snapshot.mjs` to attach explicit property, search type, period, export date, source file, byte size and SHA-256 provenance to a normalized opportunity report.
- Added `scripts/gsc-snapshot-compare.mjs` to join exact `query + page` keys and report new, removed and changed rows without converting missing measurements to zero.
- Extended `scripts/gsc-opportunity-report.mjs` with `P0/P1/P2` priority and a reason, explicit `pageResolution` (`exported` or `inferred`), and report-level provenance fields. Generic brand matches no longer infer a specific project when a more specific query such as Hóc Môn is present.
- Added package commands:
  - `npm run report:gsc-snapshot`
  - `npm run compare:gsc-snapshots`
- Extended SEO regression output with Open Graph, Twitter, hreflang and internal-link signals as warnings, while keeping hard failures limited to indexability-critical checks.
- Extended project GEO audit with source-link counts, entity/route consistency and unsupported schema-fact detection.

## Baseline evidence

The preserved Web export contains **191 query rows**, **1,781 impressions** and **191 clicks**. The generated provenance snapshot is `docs/seo/gsc-snapshot-2026-08-21.json`.

No post-change GSC export is available in this workspace. Therefore this sprint does **not** claim CTR, ranking, traffic or AI citation improvement. A future export can be compared with:

```bash
npm run compare:gsc-snapshots -- docs/seo/gsc-snapshot-2026-08-21.json docs/seo/gsc-snapshot-<after-date>.json --out docs/seo/gsc-before-after-<after-date>.json
```

## Regression contract

- Sitemap URLs are crawled as rendered HTML.
- Missing title, description, canonical, H1, invalid JSON-LD, broken sitemap status and canonical mismatch remain failures.
- Missing social metadata or hreflang is reported as a warning, not silently treated as a pass.
- GEO evidence stays `unavailable` unless the rendered page carries an available evidence state and source link.
- Numeric schema facts are not accepted when the page has no dated evidence boundary.
- Before/after comparisons use exact query + page keys; missing rows remain `new` or `removed`.

## Verification

- Production Next build — pass; static generation completed.
- Typecheck — pass.
- Dashboard test — 8/8 pass.
- SEO regression — 228 pages, 0 failures, 26 hreflang warnings.
- Project GEO audit — 26/26 clean, average 100/100.
- Canonical Hóc Môn — HTTP 200 with provenance contract.
- Typo Hóc Môn route — HTTP 308 to `/du-an/vinhomes-hoc-mon`.
- GSC snapshot — 191 rows, 1,781 impressions, 191 clicks, source hash recorded.
- Snapshot comparison smoke test — exact query+page join verified in `/tmp`; no synthetic data was committed.
- Opportunity scoring smoke test — priority, reason and Hóc Môn recommended-page resolution verified in `/tmp`; no synthetic data was committed.

## Remaining measurement gate

Run the same Search Console Web and Search Generative AI exports after at least one complete reporting period. Add a Lighthouse/mobile run when the browser runner is available, then review CTR, position, indexability, TTFB, LCP, CLS and INP before making another content change.