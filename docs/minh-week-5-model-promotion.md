# Minh Week 5 — Model promotion control plane

## Scope

Week 5 closes the learning loop for the matcher weight draft produced by the
golden-set learning cycle. It does not enable autonomous customer, listing,
payment, email, Zalo, or Facebook actions.

The model-promotion loop is controlled by `MINH_MODEL_PROMOTION_LOOP`:

- unset, `off`, or any unknown value: no candidate lifecycle work is performed;
- `shadow`: candidate registration, runtime sampling, gate evaluation, and
  approval-request creation are enabled;
- there is no value that skips staff approval and makes a candidate live.

## Candidate lifecycle

1. A passed golden-set cycle registers one `matcher_weights` candidate for that
   cycle. `(tenant_id, cycle_id, agent_key)` is idempotent.
2. A candidate moves from `SHADOW` to `CANARY` only after the golden-set gate
   passes.
3. The unified Minh Brain Scheduler samples bounded trailing-24-hour metrics.
4. A canary must be at least 24 hours old and have the minimum sample count
   before a passing runtime gate creates a
   `PROMOTE_LEARNING_CANDIDATE` approval.
5. Staff approval calls the existing `agentMemoryService.promoteWeights`
   safeguard and the candidate transition in one approval transaction.
6. Runtime regression on an active candidate creates a
   `ROLLBACK_LEARNING_CANDIDATE` approval. Rollback never occurs automatically.
7. Rollback restores the last-known-good candidate/weight version, or the
   previous live weight version captured when the first candidate was registered.

## Telemetry and safety

Runtime telemetry stores only numeric quality, safety, groundedness, latency,
cost, error rate, and sample count values. It does not store raw answers,
provider payloads, prompts, or customer content.

All candidate, runtime-metric, audit, and approval queries remain tenant
scoped and use the existing RLS context. Approval payloads carry only bounded
candidate IDs, gate values, thresholds, and categorical failure reasons.

## Unified scheduler

The Week 5 lifecycle is a callback owned by `minhBrainScheduler`; it does not
create another timer. The legacy weekly learning-cycle scheduler only produces
the evaluated draft and registers its candidate when shadow mode is explicitly
enabled.

## Verification target

- migration registry includes the candidate uniqueness/runtime-metric link and
  approval action types;
- unit tests cover the kill switch, golden metric mapping, and unified scheduler
  callback;
- server approval-learning integration, typecheck, build, migration registry,
  and workflow startup must pass before enabling shadow mode.