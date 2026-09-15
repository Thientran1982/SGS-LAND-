# Minh — Week 0 baseline and exit record

**Baseline date:** 2026-09-15 (Asia/Ho_Chi_Minh)  
**Scope:** lifecycle/error contract, traceability, replay safety, tenant boundaries,
approval gates, and deterministic evaluation before starting Week 1.

## Exit criteria

| Area | Result | Evidence |
|---|---|---|
| Lifecycle states and transitions | **PASS** | `server/ai/agentOperatingContracts.ts`; `minhWeek0Baseline.test.ts` |
| Machine-readable error contract | **PASS** | Stable `MinhErrorCode`, retry flag, and regression test |
| Request/run tracing | **PARTIAL** | Durable result exposes `runId`/`traceId`; lifecycle events carry `inboundInteractionId`; the Week 0 context contract now requires request, inbound, run, trace, specialist checkpoint, provider attempt, and delivered outbound IDs. Existing runtime paths still need an end-to-end assertion that all links are present. |
| Replay/idempotency | **PASS for covered paths** | `agentInboundExactlyOnce.test.ts`, `liveChatJourneyIdempotency.test.ts`, durable idempotency claim/checkpoint logic |
| Tenant isolation | **PASS for covered paths** | `agentMemoryIsolation.test.ts` and PostgreSQL integration coverage; event fingerprints include tenant scope |
| Approval/high-impact actions | **PASS for covered paths** | `agentGuardrails.test.ts`, `evaluateMarketingApproval`, durable approval request creation, Week 0 regression test |
| Compound planner | **NOT IMPLEMENTED** | `minhOrchestrator.ts` still selects one primary specialist; this is a Week 1/2 item, not silently treated as baseline success |

## Scenario matrix

| Required scenario | Baseline result | Notes |
|---|---|---|
| Provider timeout | **COVERED** | Durable subagent policy and live-chat fallback tests cover bounded timeout behavior |
| Duplicate inbound | **COVERED** | Lease and idempotency regression tests pass |
| Provider unavailable | **COVERED** | Provider fallback suite covers neutral pending/fallback behavior |
| DB commit then process restart | **COVERED** | Durable claim/checkpoint replay path is covered; a production browser/e2e restart proof remains a follow-up |
| Tenant A/B isolation | **COVERED** | Existing isolation tests plus tenant-scoped fingerprint regression |
| Provider outcome unknown | **POLICY LOCKED** | Delivery safety policy forbids blind resend; provider-specific reconciliation coverage remains required |
| Compound question | **PARTIAL** | Additional-intent gold cases exist, but runtime orchestration is still single-primary |

## Evaluation baseline

The router-only evaluation was run with the existing 124-case gold set. The first
full run could not be classified because Gemini returned `503 UNAVAILABLE`; this
is recorded as provider unavailability, not application accuracy.

A 24-case reproducible smoke run completed with the alternate evaluation adapter:

- intent accuracy: **21/24 (87.5%)**
- agent routing: **22/24 (91.7%)**
- full pass: **19/24 (79.2%)**
- failures: `router-003`, `router-005`, `router-006`, `router-008`, `router-010`
- output: `.local/eval-runs/eval-router-2026-09-15T16-10-00-515Z.json`

The failures are routed to the Week 1 classifier/manifest work. They are not
being hidden by lowering the threshold.

## Verification run

Passing checks:

- Week 0 contract/telemetry subset: **13 tests passed**
- full related server subset: **35 tests passed**
- `npm run lint`: **passed**
- migration registry: **passed**

One pre-existing test-fixture issue was corrected during the baseline: the
telemetry hydration test asserted a threshold of `2` without configuring that
threshold, so it depended on the process environment. The fixture now declares
the threshold explicitly.

Runtime verification after restart:

- `/health`: **200 / ok**
- Next.js production build and start: **passed**
- `/api/health`: **503 / critical** because the Aiven database probe exceeded
  the 800 ms readiness budget at the time of the check. AI, Redis, WebSocket,
  and queue checks were healthy. This is an environment/database latency
  blocker, not a failure introduced by the Week 0 contract changes; it must be
  resolved before using the live environment for latency or restart baselines.

## Week 0 decision

**Exit with conditions.** Safety, replay, tenant, and approval gates are
baseline-locked. Do not begin autonomous proactive scheduling or model
promotion yet. Week 1 may start with:

1. classifier/manifest corrections for the five smoke failures;
2. runtime trace assertion from inbound through outbound persistence;
3. explicit reconciliation tests for unknown provider outcomes;
4. compound planner behind a feature flag, capped at three workstreams.