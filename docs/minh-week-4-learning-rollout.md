# Minh Week 4 baseline — Controlled rollout + decision learning

## Scope

Week 4 adds operational learning around the Week 3 Decision Queue without enabling
autonomous provider actions. Proactive suggestions now pass through a tenant-scoped
capability rollout, and approval/human-review outcomes are recorded as bounded
categorical telemetry.

## Controlled rollout

- Capability key: `MINH_PROACTIVE_DECISION_QUEUE`.
- New tenants start at `CANARY_25`.
- `CANARY_25`, `CANARY_50`, and `LIVE` use a deterministic hash of the source
  signal ID, so the same signal is always selected or skipped across restarts.
- `SHADOW` or inactive capability fails closed: detectors may still persist their
  read-only signal, but no approval request is created automatically.
- Explicit staff `Suggest` remains available as a deliberate operator action and
  still goes through the normal approval request path.
- Existing proactive daily budget and source-signal dedupe remain in force.

## Decision learning ledger

The tenant-scoped `minh_decision_feedback` ledger records only:

- `APPROVED`, `REJECTED`, `EXECUTED`, `EXECUTION_FAILED`, or `ANSWERED`;
- action type, source signal, approval/question IDs;
- allowlisted categories such as operator approval, operator rejection,
  human-reviewed, memory-approved, and no-provider-side-effect;
- bounded boolean/categorical metadata.

Raw customer feedback, raw staff answers, provider responses, and prompt payloads
are not copied into the learning ledger. The API exposes a 30-day aggregate and
recent categorical events for the Command Center.

## Safety boundary

- Approval remains required for every Week 3 action.
- Week 4 still creates only internal drafts/review questions after approval.
- No Zalo, Facebook, email, listing mutation, lead-stage mutation, proposal, or
  payment action is added.
- Learning write failures are non-blocking and visible as a degraded log event.
- Cross-tenant reads and writes use the existing tenant context and RLS policy.

## Verification target

- Migration registry includes the ledger and capability seed.
- Unit tests cover deterministic rollout and the Command Center learning/rollout
  presentation.
- Full regression, typecheck, migration startup, shadow tick, `/health`, and
  unauthenticated Minh overview checks are required.