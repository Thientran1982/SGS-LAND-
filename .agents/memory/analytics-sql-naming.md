---
name: Analytics SQL naming
description: PostgreSQL reserved-word collisions in runtime analytics queries
---

Analytics CTE names must avoid PostgreSQL reserved words and should be verified against the real database, not only mocked repository tests.

**Why:** A visitor funnel query used `returning` as a CTE name; PostgreSQL rejected it at runtime even though the application test suite passed.

**How to apply:** Prefer descriptive names such as `returning_visitors` for CTEs and smoke-test authenticated analytics endpoints after query changes.