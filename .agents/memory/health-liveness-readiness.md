---
name: Health liveness and readiness
description: Keep process liveness independent from external database readiness so supervisors do not restart healthy servers during DB outages.
---

The supervisor's liveness endpoint must answer only whether the process can accept HTTP requests. Database and queue availability belong in a separate readiness/diagnostic endpoint.

**Why:** Coupling liveness to PostgreSQL caused the supervisor to kill a live backend during credential outages, dropping chat and WebSocket connections and creating an avoidable restart loop.

**How to apply:** Keep `/health` fast and dependency-free; use `/api/health` for DB/Redis/migration status and return readiness failures there. Process-level tests should wait for the dependency-backed route (or poll the operation) after `/health` responds, because worker startup can temporarily exhaust the database pool.