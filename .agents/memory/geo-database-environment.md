---
name: GEO database environment
description: The app currently connects to AIVEN_DATABASE_URL while generic database inspection defaults to a different Replit database.
---

The runtime database must be distinguished from the generic database-tool default when validating GEO tables. Application startup logs identify the authoritative connection, and successful migrations on that connection are the reliable runtime evidence.

**Why:** A direct inspection of the default database can show empty GEO tables even though the app database has applied the migrations and contains the seeded data.

**How to apply:** When checking GEO keywords, snapshots, or agent runs, confirm which database the running server uses before interpreting counts or deciding to reseed.