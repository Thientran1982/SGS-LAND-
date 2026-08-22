---
name: Dashboard profile resilience
description: Optional current-user profile loading must not prevent the authenticated analytics overview from rendering.
---

The overview treats business analytics as required and the current-user profile as optional. A profile lookup failure may remove personalized greeting data, but must not turn an otherwise valid analytics response into a generic system error.

**Why:** Combining independent dashboard requests into one all-or-nothing promise makes a transient auth/profile issue look like a complete business-data outage.

**How to apply:** Keep analytics failures visible and retryable, while isolating optional personalization requests with their own failure handling.