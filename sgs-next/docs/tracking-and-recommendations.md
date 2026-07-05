# Visitor Tracking & Similar-Property Recommendations

Implements the "Theo dõi hành vi khách truy cập & Gợi ý BĐS tương tự" feature
spec. This document is the map from that spec to the actual code.

## What was built (Phase 1 of the roadmap)

| Spec section | Code |
| --- | --- |
| Identity layer (anonymous -> identified) | `VisitorProfile` model + `TrackingService.identifyVisitor` |
| Tracking layer (event schema) | `TrackingEvent` model + `TrackingEventType` enum + `POST /tracking/events` |
| Consent (2-layer banner, NĐ 13/2023) | `ConsentRecord` model (append-only ledger) + `POST /tracking/consent` + `GET /tracking/consent/:visitorKey` |
| 72h erasure requests | `DataErasureRequest` model + `POST /tracking/erasure-requests` |
| Recommendation engine (content-based) | `RecommendationsService.getSimilarProperties` — cosine similarity over the same feature dimensions as the AI Valuation module, plus same-project/developer/district boosts |
| Activation — on-site widget | `GET /properties/:id/recommendations` (consumed by a future "Có thể bạn quan tâm" widget) |
| Activation — tracking SDK | `packages/tracking-sdk` (vanilla JS beacon, consent-gated) |
| Hot-lead signal | `TrackingService.trackEvent` flags `isHotLead` when a visitor views the same property ≥3 times in 48h |

## What is intentionally NOT built yet (do not assume otherwise)

- **CRM webhook push for hot leads** — the code computes `isHotLead` but does
  not push anywhere; needs a real CRM webhook URL/credentials from the client.
- **Zalo OA / email nurture automation** — needs real Zalo OA API credentials.
- **Retargeting ads sync (Facebook/Zalo Ads)** — needs real ad-account API
  credentials and, per the spec, must only fire for visitors who granted
  ADVERTISING consent.
- **Collaborative filtering (Phase 4)** — needs 2-3 months of real
  `TrackingEvent` history before it can produce meaningful signal; the
  service has a TODO marking exactly where this plugs in.
- **DPIA document** — a legal/compliance deliverable, not code; must be
  prepared by the client within 60 days of processing behavioral data at
  this scale, per NĐ 13/2023.
- **Rate limiting / bot filtering** in front of the public `/tracking/*`
  endpoints — needed before production traffic, out of scope for this
  scaffold.

## Legal design decisions worth knowing about

- `ConsentRecord` is **append-only** (one row per grant/withdrawal) rather
  than a single mutable row, so there is always a provable history of what
  was consented to and when.
- `ESSENTIAL` consent can never be set to `false` (the service throws) —
  it is required for the site to function and is not a "choice" category
  under NĐ 13/2023, unlike BEHAVIORAL/ADVERTISING which default to `false`.
- `TrackingService.trackEvent` checks for a granted BEHAVIORAL consent
  record before writing anything — enforced server-side so a modified or
  bypassed frontend cannot silently start tracking.
- `DataErasureRequest.dueAt` is stamped at creation time
  (`requestedAt + 72h`), matching the 72-hour handling requirement.

## Identity resolution flow

1. First visit: SDK creates an anonymous `visitorKey` (localStorage) and the
   API creates a matching `VisitorProfile` row on first event/consent call.
2. Anonymous behavior (page/property views, filters, AI valuation usage) is
   recorded against that `VisitorProfile` — but only once BEHAVIORAL consent
   is granted.
3. The moment the visitor calls the hotline, opens Zalo OA, submits a
   contact form, or requests an AI valuation with their phone number,
   `POST /tracking/identify` finds-or-creates a CRM `Lead` (by phone, within
   the tenant) and links `VisitorProfile.leadId` — the visitor's prior
   anonymous history becomes attached to a real Lead without ever having
   forced a signup ("progressive profiling").

## Recommendation engine (Phase 1 detail)

`RecommendationsService.getSimilarProperties`:

1. Fetches the source property and a candidate pool (same tenant, same
   `PropertyType`, `PUBLISHED`, same province where possible).
2. Builds a numeric feature vector per property (price, area, bedrooms,
   bathrooms — all normalized against the pool's max) and computes cosine
   similarity against the source.
3. Adds ranking boosts for same project (+0.20), same developer (+0.15),
   same district (+0.10), and tags a "Cùng phân khúc giá" match reason when
   prices are within ±20% of each other.
4. Returns the top-N candidates sorted by final score, each with a list of
   human-readable `matchReasons` for the on-site widget copy.

This reuses the AI Valuation module's feature set instead of building a
second similarity model from scratch, per the original brief's premise that
SGS Land's existing AVM coefficients are a ready-made feature vector.
