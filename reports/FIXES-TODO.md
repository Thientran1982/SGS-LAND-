# FIXES TODO — SGS Land SEO + GEO Audit
_Generated: 2026-08-22T05:14:22.212Z_

## Quick stats
- P0 (fix ngay): **1**
- P1 (fix trong 2 tuần): **18**
- P2 (cải thiện): **3**

## [P0] Thiếu meta description
- **Impact:** High
- **Affected:** 1 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/tin-tuc/test-bai-viet-upload-anh-video
- **Fix:** Thêm `<meta name="description" content="...">` 140-160 ký tự, có CTA và keyword.

## [P1] Schema Organization thiếu trường: logo
- **Impact:** Medium
- **Affected:** 560 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] Schema Organization thiếu một trong: contactPoint / sameAs
- **Impact:** Medium
- **Affected:** 306 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] Schema Organization thiếu trường: url
- **Impact:** Medium
- **Affected:** 164 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] Schema RealEstateListing thiếu trường: offers
- **Impact:** Medium
- **Affected:** 152 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] Schema LocalBusiness thiếu trường: address
- **Impact:** Medium
- **Affected:** 150 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] Schema LocalBusiness thiếu trường: telephone
- **Impact:** Medium
- **Affected:** 150 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] Schema RealEstateListing thiếu trường: description
- **Impact:** Medium
- **Affected:** 150 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] Schema RealEstateListing thiếu trường: image
- **Impact:** Medium
- **Affected:** 150 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] Trang thiếu số liệu cụ thể (giá, m², ha, căn, năm bàn giao) — AI khó cite
- **Impact:** Medium
- **Affected:** 13 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/contact
  - http://127.0.0.1:5000/livechat
  - http://127.0.0.1:5000/huong-dan-su-dung
- **Fix:** Bổ sung số liệu cụ thể (giá từ ... tỷ, diện tích ... m²/ha, số căn, năm bàn giao) — AI cần dữ liệu để cite.

## [P1] Title quá ngắn (29 ký tự, nên 50-60)
- **Impact:** Medium
- **Affected:** 9 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/du-an
  - http://127.0.0.1:5000/contact
  - http://127.0.0.1:5000/livechat
- **Fix:** Mở rộng title 50-60 ký tự — gồm brand + keyword chính + benefit.

## [P1] TTFB 802ms (>600ms)
- **Impact:** Medium
- **Affected:** 9 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/tin-tuc
  - http://127.0.0.1:5000/lai-suat-ngan-hang
  - http://127.0.0.1:5000/livechat
- **Fix:** TTFB > 600ms. Bật cache CDN (Cloudflare Cache Everything cho static), pre-warm SSR cho route public, kiểm tra DB query chậm.

## [P1] Schema RealEstateAgent thiếu trường: address
- **Impact:** Medium
- **Affected:** 9 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/khu-vuc/bat-dong-san-thu-duc
  - http://127.0.0.1:5000/khu-vuc/bat-dong-san-long-thanh
  - http://127.0.0.1:5000/khu-vuc/bat-dong-san-dong-nai
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] Schema RealEstateAgent thiếu trường: areaServed
- **Impact:** Medium
- **Affected:** 9 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/khu-vuc/bat-dong-san-thu-duc
  - http://127.0.0.1:5000/khu-vuc/bat-dong-san-long-thanh
  - http://127.0.0.1:5000/khu-vuc/bat-dong-san-dong-nai
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.

## [P1] OG tags thiếu: image
- **Impact:** Medium
- **Affected:** 8 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/mua
  - http://127.0.0.1:5000/thue
  - http://127.0.0.1:5000/ai-valuation
- **Fix:** Bổ sung `<meta property="og:title">`, `og:description`, `og:image` (tối thiểu 1200×630).

## [P1] Meta description quá dài (237 ký tự, nên 140-160)
- **Impact:** Medium
- **Affected:** 7 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/ai-valuation
  - http://127.0.0.1:5000/du-an/masteri-cosmo-central
  - http://127.0.0.1:5000/tin-tuc/gioi-thieu-sgs-land-phan-mem-quan-ly-bat-dong-san-chuyen-nghiep
- **Fix:** Rút meta description xuống 140-160 ký tự.

## [P1] Title quá dài (79 ký tự, nên 50-60)
- **Impact:** Medium
- **Affected:** 6 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/du-an/masteri-cosmo-central
  - http://127.0.0.1:5000/tin-tuc/gioi-thieu-sgs-land-phan-mem-quan-ly-bat-dong-san-chuyen-nghiep
  - http://127.0.0.1:5000/tin-tuc/phan-tich-gia-mua-gia-cho-thue-va-ty-suat-cho-thue-victoria-village-vista-verde-feliz-en-vista
- **Fix:** Rút gọn title về 50-60 ký tự — Google sẽ truncate phần thừa.

## [P1] Meta description ngắn (84 ký tự, nên 140-160)
- **Impact:** Medium
- **Affected:** 5 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/du-an/masterise-homes
  - http://127.0.0.1:5000/news
  - http://127.0.0.1:5000/tin-tuc
- **Fix:** Mở rộng meta description lên 140-160 ký tự với 1-2 keyword + USP.

## [P1] (robots.txt) robots.txt không khai báo Sitemap:
- **Impact:** Medium
- **Affected:** 1 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/robots.txt
- **Fix:** Thêm dòng `Sitemap: https://sgsland.vn/sitemap.xml` vào cuối robots.txt.

## [P2] Không có outbound link tới site authoritative (.gov.vn, báo lớn) — giảm trust signal
- **Impact:** Low
- **Affected:** 50 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/
  - http://127.0.0.1:5000/du-an/aqua-city
  - http://127.0.0.1:5000/du-an/the-global-city
- **Fix:** Thêm 1-2 outbound link tới site authority (.gov.vn, baochinhphu.vn, cafef.vn) trong các bài về quy định/pháp lý.

## [P2] Không có hreflang (vi/en) — bỏ qua nếu chỉ phục vụ thị trường VN
- **Impact:** Low
- **Affected:** 13 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/ai-valuation
  - http://127.0.0.1:5000/status
  - http://127.0.0.1:5000/developers
- **Fix:** Nếu phục vụ EN, thêm `<link rel="alternate" hreflang="vi" href="...">` và `hreflang="en"`.

## [P2] Heading hierarchy có skip (h2 → h4)
- **Impact:** Low
- **Affected:** 6 trang/asset
- **Sample URLs:**
  - http://127.0.0.1:5000/ai-valuation
  - http://127.0.0.1:5000/contact
  - http://127.0.0.1:5000/livechat
- **Fix:** Xem chi tiết per-page; rà soát theo guidance trong báo cáo MD.
