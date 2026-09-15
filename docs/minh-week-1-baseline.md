# Minh — Week 1 implementation and verification

**Scope:** specialist manifests and Brain Scheduler shadow overlay.  
**Safety mode:** the overlay observes only; legacy schedulers remain the owners
of all business jobs.

## Delivered

### Specialist manifests

Every capability in `AGENT_ORCHESTRATION_REGISTRY` now declares:

- `inputSchema`
- `outputSchema`
- `readScopes`
- `writeScopes`
- `maxLatencyMs`
- `requiresApproval`
- `evidenceRequirements`
- `fallbackPolicy`

The registry validator rejects missing manifests, invalid latency, duplicate
skill keys, and duplicate intent owners. Booking and contract drafting remain
approval-gated; inventory search remains read-only.

### Brain Scheduler overlay

`server/services/minhBrainScheduler.ts` adds a central shadow observer for the
five existing scheduler owners:

1. agent operator worker;
2. self-repair loop;
3. free follow-up scheduler;
4. daily report scheduler;
5. learning cycle scheduler.

The overlay:

- generates one `traceId` per observation tick;
- records tenant count and scheduler status;
- marks every legacy job `observedOnly: true`;
- never invokes a business job;
- reports `DEGRADED` with `tenantCount: null` when the tenant read fails;
- keeps legacy timers running unchanged.

`MINH_BRAIN_SCHEDULER_OVERLAY=shadow` enables the overlay. Any other value
disables it. The default is `shadow` because the current behavior is
read-only; set it to `off` for an immediate kill-switch.

### Admin overview

`GET /api/internal/minh-brain/overview` is available to management roles and
returns tenant-scoped Minh health, scheduler status, compound-routing state,
registry count, and manifest validation status. Database failures return an
explicit degraded response instead of false healthy zeroes.

## Verification

- Week 0 + Week 1 focused server tests: **21/21 passed**
- TypeScript lint: **passed**
- Registry manifest validation: **passed**
- Scheduler degraded-read behavior: **passed**
- Compound routing remains disabled unless explicitly enabled by
  `MINH_COMPOUND_ROUTING_ENABLED=true`.

## Week 1 decision

**Pass with a controlled rollout condition.** The manifest contract and
read-only scheduler observation are ready. Do not replace legacy timers or
enable proactive Suggest/Act behavior yet. The next work should measure
shadow parity and false positives for 1–2 weeks, then add detectors behind
their own read-only gates before any approval-producing action is connected.