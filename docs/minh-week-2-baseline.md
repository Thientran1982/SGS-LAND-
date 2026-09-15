# Minh Week 2 baseline — read-only proactive opportunities

## Scope

Week 2 adds the first three proactive detectors to Minh's existing shadow overlay. The
overlay remains read-only: it records `agent_signals` with
`signal_type='proactive_opportunity'`, but it does not send messages, call providers,
create approvals, change listings, or promote learning candidates.

## Detectors

1. **Cold lead**
   - Requires a lead score of at least 70, no interaction for at least three days, and
     a non-terminal CRM stage.
   - Uses the oldest updated leads first and caps the observed batch per tenant.
2. **Market price drift**
   - Compares `listings.price / listings.area` with recent
     `market_price_history` and `avm_calibration` references.
   - Requires an exact normalized location key or a full-key containment match and a
     deviation of at least 20%.
   - Stores the reference source, confidence, observed timestamp, location similarity,
     and both price-per-square-metre values as evidence.
3. **CSAT drop**
   - Reads only `support_csat` signals.
   - Compares the latest seven days with the preceding 30-day baseline.
   - Requires at least three samples in both windows and a drop of at least 0.7 points.
   - Does not copy raw feedback text or customer identifiers into the opportunity.

## Persistence and deduplication

Each signal payload is versioned, contains `permission='READ'` and
`actionCreated=false`, and includes evidence plus a scheduler trace ID. The dedupe key
is tenant-scoped and includes detector, subject, and observation date. The append-only
learning audit records the same trace and safe summary metrics.

The scheduler overview aggregates status independently for `cold_lead`,
`market_price_drift`, and `csat_drop`, so one degraded detector does not hide the
healthy status of the other two.

All detector reads and writes run inside `withTenantContext`. The Command Center loads
the internal overview and renders opportunities as read-only cards with priority,
confidence, rationale, and evidence. The endpoint remains restricted to
`SUPER_ADMIN`, `ADMIN`, and `TEAM_LEAD`.

## Operational guardrails

The market detector builds an exact-key reference index and only performs partial-key
matching when an exact match is unavailable. Shadow scans are bounded to 150 listings
and 300 market references per tenant per tick. These bounds keep the overlay from
turning a location cross-product into an event-loop stall while preserving the
fail-closed behavior for missing or ambiguous references.

## Verification

- Week 2 detector and scheduler tests cover cold-lead filtering, market-reference
  absence, CSAT sample/baseline gates, scheduler aggregation, and read-only UI output.
- Full Vitest suite: 42 files, 268 tests passed.
- TypeScript check: passed.
- Migration registry: 202 numbered migrations registered.
- Runtime after restart: `/health` returned 200; overview without authentication
  returned 401; the first shadow tick completed for 14 tenants.

Database connection timeout messages observed in unrelated engagement and analytics
cron logs remain an environment-level Aiven health issue and are not treated as
opportunity detector findings.