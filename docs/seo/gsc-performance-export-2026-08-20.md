# Google Search Console Performance Export

**Source:** `attached_assets/https___sgsland.vn_-Performance-on-Search-Generative-AI-Featur_1787256775723.zip`  
**Export context:** Performance on Search Generative AI Features  
**Date range:** 2026-05-19 through 2026-08-18  
**Property:** `https://sgsland.vn/`

## What this export contains

The archive contains the following dimensions:

- Daily impressions
- Top pages by impressions
- Country
- Device
- Search type/date filters

It does **not** contain the `Queries` dimension, clicks, CTR or average position. Therefore, this file is a valid baseline for AI-feature/page visibility, but it is not sufficient to rank query opportunities.

## Baseline

- Daily impressions total: **452**
- Page dimension total: **480** (GSC dimension totals can differ from the daily aggregate)
- Vietnam impressions: **444 / 452 (98.2%)**
- Device split: desktop **230**, mobile **220**, tablet **2**
- Highest daily impression: **14 on 2026-06-15**

## Pages with the strongest visibility

| Page | Impressions |
|---|---:|
| `/` | 139 |
| `/du-an/diamond-sky-van-phuc-city` | 55 |
| `/du-an/vinhomes-grand-park` | 30 |
| `/du-an/son-kim-land` | 28 |
| `/landing/legacy-66/` | 28 |
| `/du-an/izumi-city` | 23 |
| `/bat-dong-san-dong-nai` | 20 |
| `/landing/masteri-cosmo-central/` | 17 |
| `/about-us` | 16 |
| `/du-an/vinhomes-central-park` | 15 |
| `/du-an/aqua-city` | 13 |

## Content priorities from the available data

1. **Protect and improve the home page**, which is the largest visibility entry point.
2. **Refresh the high-visibility project pages** first: Diamond Sky, Vinhomes Grand Park, Son Kim Land, Izumi City and Vinhomes Central Park.
3. **Review legacy landing URLs** (`/landing/legacy-66/`, `/landing/masteri-cosmo-central/`) for canonical consistency and whether they should consolidate into current `/du-an/` URLs.
4. **Strengthen internal links from high-visibility pages** to current project, legal and financing guides.
5. **Keep mobile SSR/content quality as a priority** because mobile contributed 220 impressions, nearly half of the export.

## Missing data required for query prioritization

Export the Search Console **Queries** table for the same property and period with:

- Query
- Clicks
- Impressions
- CTR
- Average position

The recommended next scoring model is:

```text
opportunity_score =
  impressions
  × (1 - CTR)
  × position_decay(average_position)
  × business_intent_weight
```

This should be joined with the page export by URL and classified into brand, project, location, legal, financing and valuation intent. No query-level recommendations should be claimed from the current archive alone.
