# PROMPT THIẾT KẾ — SGS LAND Dashboard Overview (Redesign)

## VAI TRÒ
Bạn là hội đồng thiết kế sản phẩm gồm: UX Lead, UI Designer, Design System Owner, Data Visualization Specialist, và Frontend Engineer. Nhiệm vụ: redesign trang Tổng quan (Overview) của hệ thống quản trị bất động sản SGS LAND, đảm bảo pixel-perfect, không lỗi layout, và sẵn sàng bàn giao code.

## RÀNG BUỘC CỨNG (KHÔNG ĐƯỢC THAY ĐỔI)
- Giữ nguyên 100% dữ liệu, số liệu, nội dung text hiện có.
- Giữ nguyên thứ tự và nhóm nội dung của 14 khối bố cục gốc (liệt kê ở Mục 1).
- Không tự tạo màu sắc/font/spacing ngoài Design System hiện có của SGS LAND — nếu thiếu token, dùng token gần nhất trong hệ thống và ghi chú lại, không tự sáng tác.
- Không đổi sidebar (không đưa sidebar vào phạm vi thiết kế lần này).

---

## 1. CẤU TRÚC BỐ CỤC (grid 12 cột, container max-width theo desktop chuẩn, gutter 24px)

| Khối | Nội dung | Loại hiển thị | Cột (desktop) |
|---|---|---|---|
| 1 | Welcome banner (greeting + filter thời gian + export) | Text + dropdown + button | 12/12 |
| 2 | Attention banner | Text, viền cảnh báo (warning border-left) | 12/12 |
| 3 | Quick actions (3 nút) | Button row | 4/4/4 |
| 4 | Tasks & approvals (3 thẻ) | Card số liệu | 4/4/4 |
| 5 | Getting started guide | Banner text | 12/12 |
| 6 | 4 KPI cards | Card + progress bar | 3/3/3/3 |
| 7 | Lead pipeline (bar chart) + Market pulse (heatmap) | Chart | 7/5 |
| 8 | Recent activity (list) + Project breakdown (list) | List | 6/6 |
| 9 | Team performance (bảng) + AI Advisor (list) + Property inventory | List/table | 4/4/4 |
| 10 | Omnichannel inbox (số liệu) + Demand by area (bar chart) | Card + Chart | 6/6 |
| 11 | On-site search behavior (3 cột list) | List | 4/4/4 |
| 12 | Viewer behavior funnel (funnel chart) | Chart + card phụ | 8/4 |
| 13 | Visitor geography (list) + Realtime traffic (mini chart) | List + Chart | 6/6 |
| 14 | Footer trạng thái | Text | 12/12 |

**Quy tắc căn chỉnh:** khi 2 card cùng hàng có nội dung dài ngắn khác nhau, card cao hơn quyết định chiều cao hàng (align-items: stretch), card thấp hơn giãn đều padding dưới để đáy bằng nhau — không để hở đáy lệch.

---

## 2. HỆ THỐNG THIẾT KẾ (Design System — bắt buộc tuân thủ)

**Màu sắc:** dùng đúng color tokens hiện có:
- Primary (xanh navy) → số liệu chính, chart chính, nút primary
- Success (xanh lá) → tăng trưởng dương, trạng thái "Live", đạt mục tiêu
- Warning (cam/vàng) → cảnh báo, gần đạt mục tiêu, cần chú ý
- Danger (đỏ) → giảm, quá hạn, lỗi
- Neutral/muted (xám) → label phụ, timestamp, mô tả

**Font:** đúng type scale hệ thống — Heading (welcome title), Subheading (tên card), Body (mô tả), Caption (label uppercase, timestamp), Number-large (KPI number, dùng font tabular-nums để số không nhảy độ rộng khi thay đổi).

**Spacing:** base unit 8px. Padding trong card: 24px. Khoảng cách giữa các khối lớn: 32px. Khoảng cách giữa card cùng hàng: 24px.

**Bo góc:** đồng nhất 1 giá trị border-radius cho toàn bộ card theo token hệ thống, không mix nhiều mức bo góc.

**Icon:** dùng 1 bộ icon duy nhất theo hệ thống hiện có, size 16/20/24px tùy ngữ cảnh, stroke-width nhất quán.

---

## 3. QUY TẮC BIỂU ĐỒ (6 khối có chart — dùng chung 1 thư viện chart duy nhất theo stack hiện có của hệ thống, để đảm bảo đồng bộ style)

| Chart | Loại | Style bắt buộc | Tương tác |
|---|---|---|---|
| KPI progress bar | Linear progress | Cao 6-8px, bo tròn 2 đầu, màu semantic theo % đạt | Hover hiện tooltip "X% mục tiêu" |
| Lead pipeline | Bar chart dọc | 2 series (primary đậm/nhạt), bo góc đỉnh cột nhẹ, ẩn gridline dọc, giữ 1 đường base ngang | Hover cột → tooltip giá trị + ngày; click legend để ẩn/hiện series |
| Market pulse | Heatmap/radar theo khu vực | 1 màu primary, opacity thể hiện mật độ, điểm tâm rõ | Hover khu vực → tooltip tên + số liệu |
| Demand by area | Horizontal bar | Sắp giảm dần theo giá trị, 1 màu accent, số căn phải | Hover → tooltip chi tiết |
| Viewer behavior funnel | Funnel bar ngang | Độ dài tỉ lệ đúng số liệu, mỗi bước 1 sắc độ giảm dần | Hover → % rơi rụng giữa 2 bước |
| Realtime traffic | Mini bar chart | Cột nhỏ màu success, không trục/label rườm rà | Auto-update mỗi X giây (polling), animation mượt khi số liệu đổi, kèm chấm "● Live now" nhấp nháy nhẹ (pulse animation) |

**Quy tắc chung cho mọi chart:**
- Không 3D, không gradient cầu kỳ, không đổ bóng nặng.
- Luôn có tiêu đề + subtitle mô tả phía trên, đúng như bố cục gốc.
- Không dùng màu làm phương tiện phân biệt duy nhất — kèm label/icon cho người khiếm thị màu.
- Trục và số liệu dùng font Caption/Number theo type scale hệ thống, không tự chọn font khác.

---

## 4. QUY TẮC CHO LIST / BẢNG / SỐ LIỆU THẺ

- Số liệu lớn (big number) là điểm nhấn chính; label mô tả dùng màu muted, cỡ chữ nhỏ hơn bên dưới.
- List (Recent activity, Top viewed, Top keywords...): giới hạn tối đa 4-5 dòng hiển thị mặc định, nếu nhiều hơn → hiện nút "View all", không để list tự tràn vô hạn phá layout.
- Bảng (Team performance): header cột căn trái cho text, căn phải cho số; hàng có hover state nhẹ (nền đổi màu) để dễ theo dõi khi rê chuột.
- Badge trạng thái dùng đúng token success/warning/danger, không tự phối màu.
- Format số liệu: tiền tệ theo chuẩn `đX.XB` (viết tắt tỷ), phần trăm 1 chữ số thập phân, thời gian dạng `Xm Ys` hoặc `X ngày`, timestamp dạng tương đối ("8 min ago") — áp dụng nhất quán toàn trang.

---

## 5. TRẠNG THÁI GIAO DIỆN (bắt buộc thiết kế đầy đủ)

- **Loading:** skeleton riêng cho từng loại (KPI card, chart, list) — hình dạng skeleton khớp hình dạng nội dung thật, có shimmer animation nhẹ.
- **Empty state:** khi không có dữ liệu → icon + text ngắn gọn, không để card trống trơn hoặc vỡ layout.
- **Error state:** khi API lỗi/mất kết nối → thông báo lỗi nhỏ trong card kèm nút "Thử lại", không làm sập cả trang.
- **Hover / Active / Focus / Disabled:** định nghĩa rõ cho button, card có thể click, dropdown, tab (Overview/By source, Individual/Team).
- **Dark mode:** toàn bộ màu sắc, chart, border phải có biến thể dark mode tương ứng theo token hệ thống, đảm bảo contrast đạt chuẩn ở cả 2 chế độ.

---

## 6. XỬ LÝ SONG NGỮ (EN/VI)

- Container/label phải chịu được text tiếng Việt dài hơn tiếng Anh 15-20%: dùng `text-overflow: ellipsis` cho label 1 dòng, hoặc cho phép wrap tối đa 2 dòng với line-height phù hợp.
- Không dùng width cố định cứng cho các nhãn text — dùng min/max-width co giãn.
- Số liệu (KPI number) giữ nguyên định dạng, không dịch số.

---

## 7. PHẦN TỬ NỔI & LỚP HIỂN THỊ (LAYERING)

- **Chatbot widget** (icon tròn góc dưới phải): fixed position, z-index cao nhất, khoảng đệm an toàn (safe margin ≥ 80px) với nội dung cuối trang để không che thông tin khi scroll tới cuối.
- **Dropdown/filter** (Last 30 days, All listings, All sources): z-index cao hơn card nhưng thấp hơn chatbot widget và toast/notification.
- **Header:** không bắt buộc sticky trừ khi hệ thống hiện tại đã sticky — nếu có, đảm bảo không đè lên Attention banner khi scroll.

---

## 8. RESPONSIVE (breakpoint cụ thể theo chuẩn hệ thống)

- **Desktop (≥1280px):** giữ nguyên grid 12 cột như Mục 1.
- **Tablet (768–1279px):** các nhóm 3-4 cột thu về 2 cột; chart co chiều rộng nhưng giữ tỷ lệ khung hình, không méo.
- **Mobile (<768px):** toàn bộ card stack dọc 1 cột; KPI cards chuyển scroll ngang hoặc stack 2x2 tùy quyết định UX cuối; bảng Team performance chuyển sang dạng card thay vì bảng ngang để tránh scroll ngang khó dùng.

---

## 9. ACCESSIBILITY (WCAG AA)

- Tương phản chữ/nền tối thiểu 4.5:1 cho text thường, 3:1 cho text lớn.
- Mọi icon-only button phải có `aria-label`.
- Chart phải có mô tả text thay thế (aria-description) tóm tắt xu hướng chính cho screen reader.
- Có thể điều hướng toàn bộ trang bằng bàn phím (tab order hợp lý theo thứ tự đọc: banner → actions → tasks → KPI → charts...).
- Focus state rõ ràng (outline 2px theo màu primary) cho mọi phần tử tương tác.

---

## 10. ĐẦU RA MONG MUỐN

- Bản thiết kế high-fidelity (Figma/code preview) đầy đủ 3 trạng thái: light mode, dark mode, mobile responsive.
- Kèm annotation kỹ thuật cho dev: spacing, breakpoint, token màu/font sử dụng ở từng khối.
- Kèm checklist QA trước khi bàn giao: không lệch hàng card, không tràn text, contrast đạt chuẩn, chart hover hoạt động, chatbot widget không che nội dung, dark mode không lỗi màu.
