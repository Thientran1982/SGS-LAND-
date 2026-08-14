# SGSLand Market-Listings Pipeline

Backend module that ingests real-estate listings (with images) for **6 regions**
— TP.HCM, Đồng Nai, Bình Dương, Bà Rịa - Vũng Tàu, Long An, Tây Ninh — into
Aiven PostgreSQL + PostGIS for **internal reference-price / market analytics**.

## Data-source policy (read first)

This pipeline ingests **first-party listings** (submitted on SGSLand) and data
from **licensed partner APIs / feeds** only. It does **not** scrape third-party
classified sites, and it does not bypass any site's bot protection. Stored
content is for internal analytics; do **not** republish third-party original
listings/images publicly without reviewing the relevant ToS and IP / competition
law first.

To connect a new authorized source, implement a `FeedProvider` in
`ingest/feedProvider.ts` — that is the only place data sources are wired in.

## Architecture

```
server/market/
  config/regions.ts            6-region config (bbox, center, staggered cron)
  db/migrations/001_*.sql       market_listings + market_listing_images schema
  db/migrate.ts                 idempotent migration runner
  db/marketListingsRepo.ts      upsert + dedup + change-detection + mark-inactive
  services/geocode.ts           Mapbox geocoding (bbox-biased)
  storage/imageStore.ts         fetch -> sharp(<=1200px) -> SHA-256 dedup -> Cloudinary
  queue/rateLimiter.ts          Upstash Redis token-bucket limiter + distributed lock
  scheduler/qstash.ts           per-region QStash schedules + signature verification
  ingest/types.ts               RawListingInput / NormalizedListing contracts
  ingest/feedProvider.ts        pluggable authorized data sources
  ingest/ingestService.ts       normalize -> geocode -> images -> upsert
  routes.ts                     Express router (createMarketRoutes)
```

## Wiring into the app

In `server.ts`, next to the other route registrations:

```ts
import { createMarketRoutes } from './server/market/routes';
app.use('/api/market', apiRateLimit, createMarketRoutes(authenticateToken));
```

## Setup

1. Ensure secrets exist (see `.env.example`). Already present in this project:
   Aiven, Upstash Redis, QStash. **Add**: Cloudinary + Mapbox keys.
2. Run the migration (creates PostGIS table + image-dedup table):
   ```bash
   tsx server/market/db/migrate.ts
   ```
   or `POST /api/market/migrate` as an admin.

## Test one region end-to-end (quick-win)

The pipeline is source-agnostic, so you can test without a live feed by POSTing
listings directly:

```bash
curl -X POST https://<host>/api/market/ingest \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"items":[{
        "source":"user","region":"hcm","externalListingId":"demo-1",
        "title":"Căn hộ 2PN Quận 7","price":3.2,"priceUnit":"ty",
        "areaM2":68,"addressRaw":"Phú Mỹ Hưng, Quận 7, TP.HCM",
        "imageUrls":["https://example.com/a.jpg"]
      }]}'
```

Then verify:

```sql
SELECT external_listing_id, price, price_unit, lat, lng, is_active
FROM market_listings WHERE region = 'hcm';
```

## Trigger a region job through QStash (test the scheduled path)

```bash
# Publish a one-off job now for TP.HCM:
curl -X POST https://<host>/api/market/trigger/hcm \
  -H "Authorization: Bearer <admin_jwt>"

# Create the staggered daily schedules for all 6 regions:
curl -X POST https://<host>/api/market/schedule \
  -H "Authorization: Bearer <admin_jwt>"
```

QStash then calls `POST /api/market/webhook/:region`, whose signature is
verified with `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` before any
work is done.

## Rate limiting & scheduling

- Per-domain throttle: `throttleDomain()` enforces ~1 request / 2.5s / domain
  via Upstash Redis, coordinated across parallel jobs. It **waits** rather than
  dropping requests.
- Distributed lock: `withLock()` serializes critical sections across instances.
- Regions are staggered (see `regions.ts` cron: 02:00, 02:30, 03:00, ... VN) so
  jobs never all run at once.

## Dedup & de-listing

- Listings are keyed by `(source, external_listing_id)`; a content hash detects
  changes and updates `last_seen_at`.
- Images are deduped by SHA-256 of the optimized bytes.
- Listings not seen for N consecutive syncs are marked `is_active = false`.
