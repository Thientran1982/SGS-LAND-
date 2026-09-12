# Graph engine consolidation — retirement plan for stateGraph.ts (P2-1)

Verified 2026-09-12 by direct code inspection on this workspace.

## Current state

- Engine A (LEGACY): `server/ai/stateGraph.ts` — in-house StateGraph with node
  retry, GRAPH_INTERRUPT markers and loop diagnostics. Sole production
  consumer: `server/ai.ts` (import at ai.ts:1153). `server/ai.ts` backs three
  mounted route groups: `/api/admin/agent-skills` (server.ts:4609),
  `/api/agents` via createAgentRoutes (server.ts:4623), chat-follow-up cron
  (server.ts:5381).
- Engine B (TARGET): LangGraph StateGraph via `server/ai/minhGraphAdapter.ts`
  with a PostgresSaver checkpointer (dedicated pool via `buildCheckpointerPool`
  in `server/db.ts`). Gated by `server/services/orchestrationMode.ts`: default
  `typescript`; `langgraph` requires ORCHESTRATION_MODE=langgraph + explicit
  approval + adapter-ready flag. Keeping the gate on TypeScript for now is
  deliberate and correct.
- Boundary enforcement: `server/test/architectureBoundaries.test.ts` fails the
  suite if any file outside `server/ai.ts` (and stateGraph's own tests)
  imports `./ai/stateGraph`.

## Why not delete the legacy engine today

The three route groups above still resolve intents and tools through
`server/ai.ts`. Deleting the engine today breaks live endpoints. The engine is
frozen (deprecation header in stateGraph.ts): bug-fix only, no new features.

## Retirement steps (each independently shippable)

1. Migrate route-by-route onto the TypeScript brain (`liveChatEngine` /
   `minhBrain`), starting with the chat-follow-up cron (lowest traffic), then
   the `/api/agents` tool routes, then the agent-skills admin routes.
2. After each migration: delete the migrated handlers from `server/ai.ts`,
   run `npx tsc --noEmit` + the full vitest suite, and canary the migrated
   route for 24h in dev.
3. When `server/ai.ts` no longer references StateGraph: delete
   `server/ai/stateGraph.ts` + `server/test/stateGraph.test.ts`, and tighten
   the architecture test to forbid the module entirely.
4. Flip `ORCHESTRATION_MODE=langgraph` only after step 3 plus one week of
   shadow traffic (delegate smoke via
   `node server/cli/agents.ts minh-delegate <tenant> "<task>"`).

## Rollback

Every step is an isolated commit; `git revert` restores the previous route
wiring. The orchestration gate keeps LangGraph opt-in until step 4, so a
revert never changes runtime behaviour for the gated path.
