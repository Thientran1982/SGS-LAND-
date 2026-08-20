---
name: Project page GEO audit
description: The durable validation rule for project-page search and answer-engine readiness
---

Every project URL in the sitemap should be audited from rendered HTML, not only source files. The minimum checks are one canonical title/description/H1, a concise server-rendered direct answer, visible FAQ content when FAQ schema is present, and explicit caveats for indicative or unverified price, legal, progress, and authorization claims.

**Why:** Project data changes frequently and a source-level check can miss route-specific overrides or special pages that emit stronger claims than the shared project template.

**How to apply:** Run the project GEO audit after changes to project metadata, special landing pages, JSON-LD, or sitemap generation; treat missing provenance as a content issue rather than converting uncertain facts into authoritative marketing claims.