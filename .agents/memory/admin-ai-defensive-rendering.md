---
name: Admin AI defensive rendering
description: Durable guidance for keeping the AI governance admin surface stable when older tenant data or partially failed APIs return unexpected shapes.
---

Admin AI screens must treat configuration, model groups, prompt templates, and safety logs as untrusted response shapes. Normalize arrays and numeric defaults before passing them to render code, and treat nullable safety fields as empty values.

**Why:** The page is assembled from several independent APIs and older tenants may have incomplete rows. A single null field or non-array envelope can crash the React boundary and present only a generic system error, making the original failure hard to diagnose.

**How to apply:** Keep normalization at the page data boundary, preserve server-side error logging for real API failures, and add regression coverage whenever a response contract changes.