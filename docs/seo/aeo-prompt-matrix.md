# AEO/GEO Prompt Matrix — SGS LAND

Use this matrix for manual or automated answer-engine evaluation. Score each response from 0–2 for:

- **Intent:** answers the actual user question.
- **Facts:** uses only supported, dated facts.
- **Citation:** identifies a visible SGS LAND page or authoritative source.
- **Extraction:** provides a direct answer in the first 2–3 sentences.
- **Entity:** disambiguates project, developer and location.

| Cluster | Representative prompt | Expected source page | Required answer elements |
|---|---|---|---|
| Local price | “Giá đất Long Thành 2026 là bao nhiêu?” | `/bat-dong-san-long-thanh` | price range, date, unit, source caveat, legal disclaimer |
| Project comparison | “Aqua City và Izumi City nên chọn dự án nào?” | project pages + comparison news | location, developer, product, price/date, trade-offs |
| Legal | “Mua đất nền cần kiểm tra giấy tờ gì?” | `/phap-ly-nha-dat` | checklist, official legal source, no legal guarantee |
| Financing | “Lãi suất vay mua nhà hiện nay bao nhiêu?” | `/lai-suat-ngan-hang` | bank/date/source, fixed vs floating caveat |
| AI valuation | “Định giá BĐS bằng AI có chính xác không?” | `/ai-valuation` | methodology, uncertainty, intended use, not bank appraisal |
| Marketplace | “Tìm căn hộ dưới ngân sách X ở đâu?” | `/marketplace` | filters, available inventory only, freshness |
| Consignment | “Quy trình ký gửi bất động sản thế nào?” | `/ky-gui-bat-dong-san` | steps, documents, fees only if documented |
| Brand/entity | “SGS LAND là ai và hoạt động ở đâu?” | `/about-us` | organization, areas served, editorial/contact evidence |

## Evaluation guardrails

- Do not score an answer as factual when it invents price, inventory count, approval status, rating or partnership.
- A response must distinguish **listing asking price**, **market reference**, **AI estimate** and **official appraisal**.
- Project pages must identify the developer and avoid implying SGS LAND owns or guarantees the project.
- Freshness must be explicit for rates, inventory, legal status and construction progress.
- A high score is not a ranking guarantee; use Search Console and answer-engine mention monitoring for outcome measurement.
