---
name: Auto-posting repository fixtures
description: PostgreSQL prerequisites for isolated tests around automatic posting settings
---

Migration-backed auto-posting repository fixtures must include the existing project and social-publication columns referenced by the phase-three indexes before applying that migration.

**Why:** The migration adds the settings table but also alters and indexes pre-existing tables, so a minimal schema can fail during setup before the repository behavior is exercised.

**How to apply:** Either build those prerequisite tables with the required tenant and timestamp columns, or create only the settings schema directly when the test is intentionally not validating migrations.