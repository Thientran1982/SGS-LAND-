# SEO/GEO Audit Baseline — 05/2026

> Snapshot trước khi chạy sprint #64. Dùng làm mốc so sánh với `audit-after-2026-05.md` sau khi hoàn thành sprint.

## Cách reproduce

```bash
node seo-geo-audit.mjs              # crawl 50 URL public, sinh ra reports/
node geo-monitor.mjs --baseline     # chạy bộ test prompt AI engines + lưu snapshot
```

Báo cáo raw được lưu trong `reports/sgsland-audit-<ts>.md` (gitignored). File này tóm tắt high-level findings.

## Nền tảng kỹ thuật (đã có trước sprint)

- ✅ `robots.txt` allow đầy đủ AI crawler (Googlebot, Bingbot, OAI-SearchBot, AnthropicBot, ChatGPT-User, PerplexityBot, GrokBot, GeminiBot, cohere-ai).
- ✅ 5 sub-sitemap: `sitemap.xml` (index), `sitemap-static.xml`, `sitemap-images.xml`, sitemap projects/news được sinh runtime.
- ✅ `llms.txt` + `llms-full.txt` mô tả brand + top dự án + Top-3 ranking.
- ✅ `metaInjector.ts` SSR-inject JSON-LD: Organization, RealEstateAgent, FAQPage (home + project), BreadcrumbList, Residence, Place, Product, AggregateOffer, Article, Person.
- ✅ `SeoHead.tsx` dùng react-helmet-async cho client-side title/desc/canonical/hreflang/OG/Twitter, áp dụng trên hầu hết public route.
- ✅ `pages/SeoManager.tsx` có 5 tab: SERP / META / HEALTH / SCHEMA / GEO; tab GEO đã có AI Visibility status, target keywords tracker, AI citation checklist.
- ✅ Script `seo-geo-audit.mjs`, `geo-monitor.mjs`, `seo-auto-fix.mjs`.

## Coverage gap (xác định bằng audit)

### A. Schema gap
- `BreadcrumbList` đã có ở 1 số trang; cần phủ 100% public route.
- `Event` cho lịch mở bán dự án: chưa inject.
- `AggregateRating` / `Review` cho dự án có review trong DB: chưa inject.
- `ImageObject` cho hero image với geo coords: chưa có.

### B. Answer-First content gap
- Pillar pages (Landing, Marketplace, ProjectDirectory, AiValuation, BankRates, LocalLandingPage) **chưa có** "Definition Block" 40-60 từ ở đầu trang.
- Heading H2/H3 phần lớn dạng noun-phrase ("Bảng giá") thay vì câu hỏi ("Giá đất Long Thành 2026 là bao nhiêu?").
- Mỗi pillar page chưa có FAQ block 5-7 Q&A ở cuối với FAQPage schema (chỉ home + projects + about-us có).

### C. /help-center
- Hiện có 10 Q&A trong 4 nhóm (mua-ban, tai-khoan, phap-ly, bao-mat).
- Mục tiêu sprint: ≥25 Q&A trong 6 nhóm (thêm: định giá AI, ký gửi, lãi suất vay, khu vực hot, đặt cọc & thanh toán).
- FAQPage JSON-LD chỉ chứa 4 Q&A demo (không khớp content thực).
- Thiếu micro-feedback "Câu trả lời có hữu ích?".

### D. Content hub /news
- Hệ thống Article DB-backed, chưa có 10 bài seed VI theo cấu trúc GEO-native (Definition Block → 2-3 stat → H2 question → comparison → FAQ → sources).

### E. Entity establishment
- ❌ Chưa có `docs/seo/wikidata-sgsland.json`, `gbp-sgsland.json`, `nap-checklist.md`.
- /about-us đã có FAQPage schema + founder + foundingDate 2024 + numberOfEmployees, nhưng phong cách chưa "encyclopedic" (thiếu timeline, milestones, awards).

### F. AI-engine specific
- ❌ Chưa có `/.well-known/ai-plugin.json`.
- llms.txt chưa list /help-center và 10 bài blog seed.
- Chưa có `<aside role="note">` quick-answer trong pillar pages.
- Twitter Card: đã có (summary_large_image qua SeoHead) nhưng chưa kiểm validation.
- Lịch X/Twitter 30 ngày: chưa có.

### G. Outreach
- ❌ Chưa có `docs/seo/outreach-templates.md` + danh sách 15 đối tác.

### H. SeoManager GEO Monitor
- Tab GEO hiện có nhưng chưa đọc snapshot từ DB `seo_geo_snapshots` (bảng chưa migrate).
- Chưa có cron daily qua QStash chạy `geo-monitor.mjs`.

### I. Performance (Core Web Vitals)
- Chưa chạy Lighthouse benchmark cho 10 pillar pages trong sprint này.

## Top-20 keywords baseline (placeholder — cần GSC integration thật)

| # | Keyword | Position | Impressions | Clicks | CTR |
|---|---------|----------|-------------|--------|-----|
| 1 | định giá bất động sản AI |  - | - | - | - |
| 2 | giá đất Long Thành 2026 |  - | - | - | - |
| 3 | Aqua City Novaland giá   |  - | - | - | - |
| 4 | Vinhomes Cần Giờ         |  - | - | - | - |
| 5 | The Global City Masterise |  - | - | - | - |
| ... | ... | - | - | - | - |

> ⚠️ Chưa kết nối GSC API, các giá trị này sẽ được fill khi tích hợp GSC trong sprint sau (xem `seo_geo_snapshots.gsc_top20_json`).

## AI mention baseline (manual probe — 02/05/2026)

| Engine     | Prompt | SGS Land xuất hiện? | Vị trí trong câu trả lời |
|------------|--------|---------------------|--------------------------|
| ChatGPT    | "Nền tảng định giá BĐS AI Việt Nam"            | TBD | TBD |
| Gemini     | "Đại lý phân phối Aqua City Novaland chính thức" | TBD | TBD |
| Claude     | "Sàn ký gửi BĐS độc lập tại TP.HCM"            | TBD | TBD |
| Perplexity | "site:sgsland.vn giá đất Long Thành"           | TBD | TBD |
| Grok       | "AI định giá nhà ở Việt Nam"                    | TBD | TBD |

> Chạy thủ công 5 prompt/engine vào ngày khởi động sprint, fill kết quả ở đây trước khi merge.
