# FIXES TODO — SGS Land SEO + GEO Audit
_Generated: 2026-04-18T10:07:12.909Z_

## Quick stats
- 🔴 P0 (fix ngay): **1**
- 🟠 P1 (fix trong 2 tuần): **6**
- 🟡 P2 (cải thiện): **3**

## [P0] Thiếu thẻ <h1>
- **Impact:** High
- **Affected:** 8 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/
  - https://sgsland.vn/du-an/aqua-city
  - https://sgsland.vn/du-an/the-global-city
- **Fix:** Thêm đúng 1 thẻ `<h1>` chứa keyword chính của trang.

## [P1] Trang thiếu số liệu cụ thể (giá, m², ha, căn, năm bàn giao) — AI khó cite
- **Impact:** Medium
- **Affected:** 8 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/
  - https://sgsland.vn/du-an/aqua-city
  - https://sgsland.vn/du-an/the-global-city
- **Fix:** Bổ sung số liệu cụ thể (giá từ ... tỷ, diện tích ... m²/ha, số căn, năm bàn giao) — AI cần dữ liệu để cite.

## [P1] Trang dự án mỏng: 140 từ (nên >=300)
- **Impact:** Medium
- **Affected:** 5 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/du-an/aqua-city
  - https://sgsland.vn/du-an/the-global-city
  - https://sgsland.vn/du-an/izumi-city
- **Fix:** Mở rộng nội dung trang dự án ≥300 từ: thông tin pháp lý, bảng giá, tiện ích, mặt bằng, FAQ.

## [P1] Title quá dài (75 ký tự, nên 50-60)
- **Impact:** Medium
- **Affected:** 2 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/du-an/vinhomes-can-gio
  - https://sgsland.vn/du-an/masterise-homes
- **Fix:** Rút gọn title về 50-60 ký tự — Google sẽ truncate phần thừa.

## [P1] Homepage thiếu LocalBusiness/RealEstateAgent schema
- **Impact:** Medium
- **Affected:** 1 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/
- **Fix:** Thêm JSON-LD `RealEstateAgent` hoặc `LocalBusiness` ở homepage với address, geo, telephone, openingHours.

## [P1] Trang blog mỏng: 144 từ (nên >=1500)
- **Impact:** Medium
- **Affected:** 1 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/news
- **Fix:** Bài blog cần ≥1500 từ: cover topic đầy đủ, có dữ liệu/case study, có FAQ cuối bài.

## [P1] (robots.txt) robots.txt không khai báo Sitemap:
- **Impact:** Medium
- **Affected:** 1 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/robots.txt
- **Fix:** Thêm dòng `Sitemap: https://sgsland.vn/sitemap.xml` vào cuối robots.txt.

## [P2] Không có outbound link tới site authoritative (.gov.vn, báo lớn) — giảm trust signal
- **Impact:** Low
- **Affected:** 8 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/
  - https://sgsland.vn/du-an/aqua-city
  - https://sgsland.vn/du-an/the-global-city
- **Fix:** Thêm 1-2 outbound link tới site authority (.gov.vn, baochinhphu.vn, cafef.vn) trong các bài về quy định/pháp lý.

## [P2] Không có author byline — giảm E-E-A-T
- **Impact:** Low
- **Affected:** 8 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/
  - https://sgsland.vn/du-an/aqua-city
  - https://sgsland.vn/du-an/the-global-city
- **Fix:** Thêm author byline cuối bài: tên + chức danh + ảnh + link LinkedIn.

## [P2] Không có publication / last-modified date hiển thị
- **Impact:** Low
- **Affected:** 8 trang/asset
- **Sample URLs:**
  - https://sgsland.vn/
  - https://sgsland.vn/du-an/aqua-city
  - https://sgsland.vn/du-an/the-global-city
- **Fix:** Hiển thị ngày đăng + ngày cập nhật (`<time datetime="2026-01-15">`).
