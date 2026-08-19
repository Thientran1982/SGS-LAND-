# Decision: LangGraph migration remains gated

Date: 2026-08-20
Status: **Not approved for production**

## Decision

Keep the existing TypeScript durable orchestration as the only production
orchestration mode. Do not add a LangGraph dependency or route production
traffic through a new graph runtime yet.

The runtime flag is fail-closed:

- `AI_ORCHESTRATION_MODE=typescript` (default) selects the current pipeline.
- A `langgraph` request is rejected unless both
  `LANGGRAPH_ORCHESTRATION_APPROVED=true` and
  `LANGGRAPH_ORCHESTRATION_ADAPTER_READY=true` are present.
- Since no adapter is currently shipped, those readiness flags must remain
  false/absent.
- Rollback is `AI_ORCHESTRATION_MODE=typescript` followed by a workflow restart;
  webhook, repository, approval, channel and outbox contracts do not change.

## Evidence reviewed

The current pipeline already provides idempotency, tenant-scoped execution,
leases, heartbeat, fencing tokens, guardrails, durable checkpoints, outbox
delivery recovery and an approval broker. The latest checkpoint/resume tests
show that a synthesis failure can resume from a committed specialist result,
and the evaluation fixture now provides 150 reproducible Vietnamese
Zalo/Messenger cases for measuring correctness, safety, latency and cost.
There is still no production trace demonstrating a need for arbitrary graph
replay, durable fan-out/fan-in joins, or approval suspended between graph
nodes. Therefore the exit criteria remain unmet.

The existing approval flow is intentionally outside the response orchestration:
high-impact suggestions become approval requests and are handled by the
existing approval repository/routes. Moving that boundary into a new runtime
would increase failure and rollback surface without a demonstrated benefit.

## Exit criteria for reconsideration

Re-evaluate only when a real, reproducible workload demonstrates at least one
of the following cannot be solved safely in the current pipeline:

1. Node-level graph replay is required after a partial failure.
2. Multiple specialists must fan out and fan in with durable joins.
3. Human approval must suspend and resume between specialist nodes.
4. Current checkpoint/recovery logic cannot meet a measured latency or
   correctness requirement.

Before approval, a spike must provide state-schema compatibility, fencing and
replay semantics, observability parity, contract tests, feature-flag routing
and a rollback drill. The LangGraph package and adapter are intentionally not
part of the production dependency graph while this gate is closed.

## Invariants

Webhook adapters, repositories, approval requests, channel adapters, guardrails
and outbound outbox remain stable. A future adapter may replace only the
orchestration boundary behind the durable execution service.