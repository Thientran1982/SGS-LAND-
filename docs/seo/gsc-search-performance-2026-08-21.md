# Google Search Console — Search Performance Baseline

**Source:** `attached_assets/https___sgsland.vn_-Performance-on-Search-2026-08-21_1787256885028.zip`  
**Property:** `https://sgsland.vn/`  
**Search type:** Web  
**Period:** 2026-05-19 through 2026-08-18  

## Executive summary

This export contains the query dimension, so it can be used for real content prioritization. It contains **191 query rows**, **191 clicks** and **1,781 impressions** in the exported query table. The aggregate CTR from those rows is approximately **10.7%**; use the row-level CTR for decisions because GSC exports can have dimension totals that do not exactly match the daily report.

The largest brand terms are already strong:

- `sgsland` — 135 clicks, 255 impressions, 52.94% CTR, average position 1.03
- `sgs land` — 43 clicks, 99 impressions, 43.43% CTR, average position 1.22

The most actionable non-brand opportunities are queries with meaningful impressions and positions roughly 4–20, where a focused page refresh or internal-link improvement can plausibly improve CTR.

## Priority query opportunities

| Priority | Query | Clicks | Impressions | CTR | Avg. position | Recommended action |
|---|---|---:|---:|---:|---:|---|
| P1 | `chung cư đại nhật` | 2 | 27 | 7.41% | 7.70 | Create/refresh a dedicated project-intent section; strengthen title, answer-first intro and internal links |
| P1 | `bất động sản đồng nai 2026` | 2 | 24 | 8.33% | 7.62 | Refresh `/bat-dong-san-dong-nai` with dated market context and links to relevant projects |
| P1 | `66 legacy` | 0 | 21 | 0% | 7.71 | Resolve legacy landing intent/canonical and make the current destination answer the query directly |
| P1 | `bat dong san long thanh` | 0 | 18 | 0% | 16.39 | Improve Long Thành page title/intro and add a clear location + project comparison block |
| P1 | `bất động sản long thành` | 0 | 16 | 0% | 15.06 | Consolidate spelling variants into the same location landing page; add Vietnamese wording naturally |
| P2 | `căn hộ aqua city` | 0 | 28 | 0% | 20.64 | Improve `/du-an/aqua-city` for apartment search intent; do not invent inventory or prices |
| P2 | `grand manhattan novaland` | 0 | 34 | 0% | 23.79 | Refresh project/developer entity clarity and add factual comparison links |
| P2 | `vinhome central park bình thạnh` | 0 | 51 | 0% | 29.59 | Correct entity spelling coverage while keeping canonical URL and visible terminology factual |
| P2 | `dự án izumi city` | 0 | 45 | 0% | 30.36 | Expand project overview, location and buyer-intent answers |
| P2 | `masteri cosmo central` | 0 | 43 | 0% | 39.79 | Review current landing/project routing before creating more content |

## Page and device signals

Top page signals in the same export:

| Page | Clicks | Impressions | CTR | Avg. position |
|---|---:|---:|---:|---:|
| `/` | 173 | 990 | 17.47% | 6.26 |
| `/huong-dan-su-dung` | 8 | 93 | 8.60% | 1.81 |
| `/contact` | 7 | 447 | 1.57% | 3.34 |
| `/bat-dong-san-dong-nai` | 7 | 230 | 3.04% | 7.19 |
| `/landing/legacy-66/` | 6 | 629 | 0.95% | 22.12 |

Device split:

- Mobile: 1,755 impressions, 190 clicks, 10.83% CTR, average position 13.15
- Desktop: 2,635 impressions, 40 clicks, 1.52% CTR, average position 15.01
- Tablet: 62 impressions, 0 clicks

The unusually low desktop CTR compared with mobile should be validated against the selected Search Console period and page/query mix before making a broad UX conclusion.

## Scoring and next update

For future exports, rank opportunities using:

```text
opportunity =
  impressions
  × (1 - CTR)
  × position_factor
  × intent_weight
```

Use:

- `position_factor` highest for positions 4–15, lower for positions above 30.
- `intent_weight` highest for project, location, legal and financing intent.
- Exclude brand terms from non-brand opportunity rankings.
- Join query rows to page rows when the export includes both dimensions.

This report is a dated snapshot, not a live API connection. Re-export the same tables periodically and compare query/page changes before promoting a content change.
