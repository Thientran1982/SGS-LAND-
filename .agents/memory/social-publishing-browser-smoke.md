---
name: Authenticated social publishing smoke
description: Environment and fixture constraints for authenticated social publishing browser validation
---

The authenticated CRM smoke test must target the internal Vite/Express listener, not the public Next.js listener. The configured preview exposes Next.js on the canonical port and proxies the CRM app through a separate internal port.

**Why:** Pointing Playwright at the public listener produces a valid public-site page and can look like a missing CRM route rather than an authentication or UI failure.

**How to apply:** Use the workflow's backend/Vite port for `/social-publishing` smoke runs and keep the public Next.js port for public-site checks.

Disposable tenant fixtures also need cleanup that does not cascade through append-only AI learning audit events. Use a dedicated fixture connection with trigger suppression only for the fixture lifecycle, never for application requests.

**Why:** User/listing audit triggers can create append-only audit rows; deleting the fixture tenant normally cascades into a protected audit table and makes teardown fail.

**How to apply:** Scope the database-session setting to the single fixture connection, restore or close that connection after cleanup, and never disable triggers on the application's pool.