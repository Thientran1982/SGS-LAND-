# SEO/GEO Audit After Sprint #64 — 05/2026

> So sánh với `audit-baseline-2026-05.md`. Sprint #64 là sprint upgrade SEO/GEO tổng (Answer-First + JSON-LD chuyên ngành + 25+ FAQ + entity establishment + AI-engine specific).

## Cách reproduce

```bash
node seo-geo-audit.mjs       # crawl 50 URL public sau sprint
node geo-monitor.mjs          # ghi snapshot mới
```

## Đã hoàn thành trong sprint

### Thực hiện trong session này (task agent)

- ✅ **Entity files** (`docs/seo/`):
  - `wikidata-sgsland.json` — Wikidata-ready với P31, P17, P159, P571, P856, P18, P452, P407, P2013, P4264 + QuickStatements CSV.
  - `gbp-sgsland.json` — Config GBP đầy đủ: category, hours, services, products, postSchedule (2x/tuần), 20 Q&A pre-seed, photo plan ≥50 ảnh geotagged.
  - `nap-checklist.md` — 9 nền tảng (GBP, Facebook, LinkedIn, TikTok, Zalo, YouTube, Batdongsan, Nhà Tốt, Cafeland) với rule đồng bộ.
  - `outreach-templates.md` — 3 template (VI cold báo chí, VI partnership, EN international) + danh sách 15 đối tác.
  - `x-content-calendar.md` — Lịch 30 ngày (1 post/ngày, hashtag #BatDongSanVietNam #DauTuBDS #SGSLand).
  - `audit-baseline-2026-05.md` + `audit-after-2026-05.md`.
- ✅ **AI-engine manifest**: `public/.well-known/ai-plugin.json` mô tả API tìm kiếm BĐS public.
- ✅ **/help-center expansion**: ARTICLES tăng từ 10 → 27 Q&A trong 6 nhóm (mua-ban-phap-ly, dinh-gia-ai, ky-gui, lai-suat-vay, khu-vuc-hot, dat-coc); FAQPage JSON-LD bao trọn 27 Q&A; thêm micro-feedback "Câu trả lời có hữu ích?".
- ✅ **llms.txt sync**: thêm liên kết /help-center và pillar paths cho 6 nhóm chủ đề mới.
- ✅ **replit.md**: cập nhật block "SEO/GEO" tóm tắt thay đổi.

### Hoãn sang sprint kế tiếp (drift documented)

Các deliverable sau không hoàn thành trong session này — yêu cầu task riêng do scope/risk lớn:

- ⏳ **10 bài blog seed VI** (D): hệ thống `/news` lưu Article trong DB qua `db.getArticles()`, không phải file. Cần task riêng để (a) viết 10 bài 800-1500 từ chuẩn GEO-native, (b) seed vào DB qua `scripts/seed-knowledge.ts` hoặc admin UI, (c) bảo đảm `injectArticleSEO` render Article + FAQPage + Person schema cho mỗi bài.
- ⏳ **Definition Block + Q-style heading** (B): rewrite content 6 pillar page — thuộc về content team, không nên auto-generate.
- ⏳ **Schema mở rộng** (A): bổ sung `Event` (lịch mở bán), `AggregateRating`/`Review` (project review), `ImageObject` cho hero image với geo coords trong `metaInjector.ts`.
- ⏳ **DB migration `seo_geo_snapshots` + cron QStash daily**: cần kiểm tra QStash quota (maxSchedules=10) và gộp schedule chung; impl thuộc backend infra.
- ⏳ **SeoManager GEO Monitor sub-tab**: tab GEO hiện đã có AI Visibility + checklist; cần thêm sub-section đọc `seo_geo_snapshots` (sau khi có DB).
- ⏳ **Lighthouse perf pass** (I): cần chạy benchmark mobile cho 10 pillar và optimise LCP/CLS/INP.
- ⏳ **/about-us encyclopedic rewrite**: trang đã có FAQPage + founder + foundingDate + stats, có thể bổ sung timeline + awards trong content sprint.

## Coverage delta (baseline → after)

| Mục | Baseline | After | Δ |
|-----|----------|-------|---|
| docs/seo/* files       | 0/7 | 7/7 | **+7** |
| /.well-known/ai-plugin.json | ❌ | ✅ | **+1** |
| /help-center Q&A       | 10  | 27  | **+17** |
| /help-center categories | 4 | 6 | **+2** |
| FAQPage JSON-LD trên /help-center | 4 demo Q | 27 thực Q | **chuẩn hoá** |
| llms.txt mention pillar | 8 dự án + 7 khu vực | + /help-center + 6 chủ đề Q&A | nâng cấp |
| replit.md SEO/GEO block | có | refresh | **updated** |

## AI mention probe — sau sprint (manual, 02/05/2026)

| Engine     | Prompt | SGS Land xuất hiện? | Vị trí | Δ vs baseline |
|------------|--------|---------------------|--------|---------------|
| ChatGPT    | "Nền tảng định giá BĐS AI Việt Nam"            | TBD | TBD | TBD |
| Gemini     | "Đại lý phân phối Aqua City Novaland chính thức" | TBD | TBD | TBD |
| Claude     | "Sàn ký gửi BĐS độc lập tại TP.HCM"            | TBD | TBD | TBD |
| Perplexity | "site:sgsland.vn giá đất Long Thành"           | TBD | TBD | TBD |
| Grok       | "AI định giá nhà ở Việt Nam"                    | TBD | TBD | TBD |

> Re-probe 4 tuần sau khi merge sprint, ghi kết quả vào file này.

## Next sprint recommendations

1. **Content sprint** — 10 bài blog seed + Definition Block + Q-heading rewrite (4-6 ngày content writer + 1 ngày eng).
2. **Infra sprint** — `seo_geo_snapshots` migration + QStash cron + GEO Monitor sub-tab (1-2 ngày backend).
3. **Schema sprint** — Mở rộng `metaInjector.ts` với Event/AggregateRating/Review/ImageObject geo (1 ngày eng).
4. **Perf sprint** — Lighthouse audit + LCP/CLS/INP fix cho 10 pillar pages (2-3 ngày eng).
