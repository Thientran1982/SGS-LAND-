# SGS LAND — `./fixes/` Reference Files

_Generated: 2026-04-18 by `seo-auto-fix.mjs`_

## ⚠️ Đọc trước khi dùng

Đa số "fix" được generate ở đây **đã LIVE trong production code** — file `./fixes/*` chỉ là **reference templates** cho:
- Review / so sánh với code đang chạy
- Onboard team mới
- Port sang dự án khác trong tương lai
- Backup khi cần redeploy

## File status

| File | Mục đích | Trạng thái production |
|---|---|---|
| `fixes/schema-blocks.html` | JSON-LD reference (Org/LocalBiz/FAQ/Listing/Breadcrumb/Video) | ✅ Already injected per-route by metaInjector.ts |
| `fixes/meta-tags-optimized.html` | Optimized <head> per key route | ✅ Already injected per-route by metaInjector.ts |
| `fixes/robots.txt` | Optimal robots.txt with all AI bots allowed | ⚠️ Source-of-truth at public/robots.txt — Cloudflare overrides on prod |
| `fixes/sitemap-template.xml` | Sitemap-index + child sitemaps structure | ✅ public/sitemap.xml + sitemap-static.xml + sitemap-images.xml live |
| `fixes/geo-content-templates.md` | AI-citable content templates per project | 🟡 Partial — noscript covers basics; enrich UI per template |
| `fixes/heading-structure.md` | H1/H2/H3 outline reference for project pages | 🟡 H1 correct via metaInjector; H2/H3 need component audit |

## Các fix CẦN tay can thiệp (không tự sinh được)

1. **🔴 Cloudflare "Block AI Crawlers" toggle** — vào dashboard Cloudflare → Bots → AI Audit → tắt. Đây là root cause khiến GPTBot/ClaudeBot/Google-Extended bị chặn ở tầng CDN, override mọi config robots.txt trong code.
2. **🟠 Blog content** — `/news` mỏng 144 từ. Cần seed bài viết ≥1500 từ (template trong `geo-content-templates.md` có thể adapt).
3. **🟡 Author byline UI** — render component `AuthorByline` ở cuối project pages thay vì chỉ trong noscript.
4. **🟡 OG image per project** — hiện dùng `og-image.jpg` chung; cân nhắc generate `og-{slug}.jpg` 1200×630 riêng cho mỗi dự án để tăng CTR khi share Facebook/Zalo.

## Workflow

```bash
npm run audit       # SEO + GEO crawler → reports/
npm run monitor     # GEO LLM citation check → reports/
npm run autofix     # Generate ./fixes/ reference files (this tool)
npm run full        # audit + monitor
```
