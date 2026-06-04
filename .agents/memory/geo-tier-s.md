---
name: GEO Tier S file locations
description: Where the GEO Tier S signal files live in the Next.js app and how they are structured
---

## Static GEO files (apps/nextjs/public/)
- `/llms.txt` — Vietnamese LLM discovery (freshness date, AI citation triggers, checklist)
- `/llms-full.txt` — Extended Vietnamese context for RAG/AI grounding (AVM methodology, full project list, FAQ)
- `/llms-en.txt` — English LLM discovery file for English-language AI engines
- `/data/area-price-index.json` — Schema.org Dataset, area price table, dateModified field

## Route handlers (apps/nextjs/app/)
- `sitemap-answers.xml/route.ts` — answers/guide pages sitemap (returns XML)
- `sitemap-areas.xml/route.ts` — area landing pages + projects sitemap (returns XML)

## robots.ts
- Lists all 3 sitemaps: sitemap.xml, sitemap-answers.xml, sitemap-areas.xml
- Explicit rules for: GPTBot, ClaudeBot, PerplexityBot, DeepSeek-Bot, Qwen-Bot (all Allow: / + /llms.txt)

## about-us Person schemas
- Generated from `AUTHORS.slice(0, 3)` (CEO, CTO, COO) in `app/(public)/about-us/page.tsx`
- Schema: `@type: Person`, jobTitle, url, sameAs (LinkedIn + author.sameAs), worksFor (Organization)

## news page OG
- `type: "article"` (not "website") to unlock publishedTime + modifiedTime fields
- publishedTime: "2024-03-01T00:00:00.000Z", modifiedTime: new Date().toISOString()
