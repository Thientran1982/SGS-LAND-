---
name: GSC decimal positions
description: Search Console average positions are fractional values and must not be stored in integer columns.
---

Search Console `position` is an average and can contain decimals such as 51.25; persist it with two decimal places and keep numeric precision through the sync query.

**Why:** Treating the value as an integer makes the entire GEO snapshot report a GSC sync failure even though the provider returned valid data.

**How to apply:** Use a numeric database column for current positions, preserve the JavaScript number in update parameters, and cover fractional values in the Search Console regression test.