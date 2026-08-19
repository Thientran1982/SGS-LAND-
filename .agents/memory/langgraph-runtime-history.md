---
name: LangGraph runtime history
description: Audit evidence about the former “LangGraph” naming and the current production orchestration boundary.
---

The repository has no evidence of a shipped LangGraph/LangChain runtime; the former “LANGGRAPH CORE” is a native TypeScript StateGraph and must not be treated as a compatible LangGraph adapter.

**Why:** Enabling the LangGraph feature flag without a real adapter, state migration, replay, fencing and rollback would change the production contract without implementation evidence.

**How to apply:** Keep the durable TypeScript coordinator as the production boundary; only introduce a LangGraph adapter after proving a required graph capability and completing parity/rollback tests.