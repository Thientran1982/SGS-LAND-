---
name: Dashboard greeting localization
description: Dashboard greeting behavior and privacy boundary for localized production UI
---

Dashboard greetings should use the authenticated user's real display name, the current locale, and the local time period. Returning-visit context may be kept in tenant-scoped browser storage only; do not add server-side visit tracking without explicit consent.

**Why:** The dashboard design requires a personal, bilingual workspace without introducing hidden analytics or replacing real user context with a mock name.

**How to apply:** Keep all greeting variants in the shared translation dictionaries and preserve the fallback behavior when browser storage or user data is unavailable.