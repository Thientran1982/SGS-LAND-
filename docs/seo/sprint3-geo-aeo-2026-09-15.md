# Sprint 3 — GEO/AEO provenance and answer contract

**Review date:** 2026-09-15  
**Scope:** server-rendered project and project landing pages, JSON-LD, noscript fallback and LLM discovery files.

## Implemented

- Added a shared GEO provenance contract with:
  - fixed editorial review date;
  - named editorial owner;
  - evidence caveat;
  - 40–60-word direct-answer template;
  - internal entity/editorial reference links.
- Added visible server-rendered answer blocks to project detail pages and flagship landing pages.
- Added review date and evidence state attributes for rendered-HTML regression checks.
- Replaced runtime `dateModified` values with the reviewed date.
- Gated landing `AggregateOffer`, `floorSize` and `amenityFeature` JSON-LD behind explicit source fields. Existing static seed numbers are not emitted as verified schema facts.
- Removed the unsupported “authorised distribution agent” claim from the landing noscript layer and replaced it with a verification caveat.
- Added canonical `/llms-full.txt` and `/llms-en.txt` route handlers and refreshed `/llms.txt` policy language.
- Extended `project-geo-audit.mjs` to audit project and landing routes, visible answer length, review date, evidence state, visible FAQ, canonical and JSON-LD.

## Verification

- `npm run lint` — pass.
- Next production build — pass; 118 routes generated.
- SEO regression — 228 pages, 0 failures.
- `/llms.txt`, `/llms-full.txt`, `/llms-en.txt` — HTTP 200.
- Landing and project screenshots reviewed after restart.
- Project GEO audit — 26 routes discovered, 25 clean, average 99/100.

## Known limitation

`/du-an/vinhhomes-hoc-mon` occasionally returns an older dynamic-route handler when fetched in the audit batch. A direct request after the batch returns the dedicated page with the review date and evidence attributes. The audit keeps this as a visible failure rather than masking it. The route conflict/cache behavior should be isolated before treating the project audit as 100% clean.

## Evidence boundary

No live Search Console query, ranking, CTR, search volume or external source verification was added. Numeric project facts remain visible as reference content only unless a dated source is explicitly attached; unavailable measurements are not converted to zero or a ranking.