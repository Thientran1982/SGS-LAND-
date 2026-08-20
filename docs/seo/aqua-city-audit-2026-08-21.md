# Aqua City — SEO / GEO / AEO audit

**Audit date:** 2026-08-21  
**Audited URLs:**

- `/du-an/aqua-city`
- `/bat-dong-san-dong-nai/aqua-city-co-nen-mua-khong-2026`
- `/bat-dong-san-dong-nai/aqua-city-vs-izumi-city-so-sanh`
- Related SSR fallback: `/du-an/aqua-city` in `server/ssr-renderer.tsx`

This is an evidence-aware audit. It does not claim a guaranteed ranking position or treat unmeasured AI citations as a score of zero. Google Search Console, backlink data, Rich Results Test output and field-level legal documents were not available in this workspace; those items remain **unverified**.

## Verification status

- **Local rendered source:** the internal project-page audit passes its structural checks for 17 sitemap project URLs, including Aqua City.
- **Production rendered page:** `https://sgsland.vn/du-an/aqua-city` was reachable on 2026-08-21, but still returned the older title/H1 content (“Nhà phố Aqua City Novaland Đồng Nai”). The local source changes are therefore **not yet verified in production**.
- **PageSpeed Insights:** the public API returned HTTP 429 during this audit. No LCP, CLS, INP or performance score is recorded.
- **GSC, backlink, Rich Results Test and AI citation checks:** no valid measurement was available in this workspace.

The structural local score must not be presented as “GEO Tier S”. It only means that the tested HTML gates pass locally.

## Findings

| Hạng mục | Chuyên gia | Vấn đề | Ưu tiên | Sửa cụ thể | Trang ảnh hưởng |
|---|---|---|---|---|---|
| Factual trust | SEO/GEO | Nội dung cũ dùng giá, “sổ hồng lâu dài”, tiến độ, tiện ích và thời gian di chuyển như dữ kiện chắc chắn nhưng không gắn hồ sơ hoặc ngày xác minh theo lô. | Critical | Đổi sang “tham khảo”, nêu rõ biến động theo phân khu/sản phẩm và yêu cầu đối chiếu hồ sơ gốc trước giao dịch. | `/du-an/aqua-city`, bài Aqua |
| Factual trust | GEO | Metadata/SSR từng khẳng định SGS LAND là đại lý uỷ quyền và cung cấp kiểm tra pháp lý; đây là claim cần tài liệu chứng minh. | Critical | Loại claim uỷ quyền/kiểm tra hai lớp khỏi metadata, FAQ và SSR; chỉ mô tả dịch vụ hỗ trợ thông tin nếu không có giấy xác nhận công khai. | `/du-an/aqua-city`, SSR |
| Structured data | SEO | SSR legacy có `AggregateOffer` với giá và `offerCount` hardcoded, dễ làm máy tìm kiếm hiểu nhầm là inventory hiện tại. | High | Bỏ giá và số lượng khi không có feed giao dịch có ngày; giữ `PreOrder`/mô tả tham khảo và không tạo giá bằng 0. | SSR Aqua |
| Entity clarity | GEO/AEO | Trang chính có entity nhưng tên cũ mở đầu bằng “Nhà phố”, làm hẹp phạm vi Aqua City. | High | Chuẩn hoá entity thành “Aqua City Novaland Đồng Nai”, mở đầu bằng vị trí, chủ đầu tư được ghi nhận và phạm vi thông tin. | `/du-an/aqua-city` |
| Direct answer | AEO | Các bài phân tích chưa có đoạn trả lời trung tính đủ rõ ở đầu trang. | High | Thêm answer box 2–3 câu: Aqua City là gì, quyết định mua phụ thuộc dữ liệu nào, thông tin nào cần xác minh. | Hai bài Aqua |
| FAQ semantics | AEO | FAQ hiển thị có nhưng trước đây thiếu FAQPage/Breadcrumb schema ở các bài chuyên đề. | High | Thêm FAQ thật sự hiển thị và `FAQPage`/`BreadcrumbList` tương ứng. | Hai bài Aqua |
| Investment language | GEO | Câu “NÊN mua”, “tiềm năng tăng giá rất lớn”, “rủi ro phá sản thấp” là khuyến nghị/đánh giá chưa có phương pháp và nguồn. | High | Đổi thành khung thẩm định, nêu điều kiện và rủi ro; không dự báo lợi nhuận hoặc kết luận thay người mua. | Bài “có nên mua”, bài so sánh |
| Performance | SEO | Chưa có phép đo PageSpeed Insights riêng cho `/du-an/aqua-city`; kết quả GEO hiện có chỉ bao phủ homepage, marketplace và Đồng Nai landing. | High | Chạy PSI Mobile/Desktop cho URL Aqua, lưu `measured/skipped/error`, theo dõi LCP/CLS/INP theo ngày. | `/du-an/aqua-city` |
| Search evidence | SEO/GEO | Chưa có GSC query/page export riêng để xác định cannibalization và CTR của nhóm Aqua City. | High | Xuất GSC Web theo query + page trong 28/90 ngày, đối chiếu canonical và chia intent: giá, pháp lý, vị trí, so sánh. | Nhóm URL Aqua |
| Off-page/local | SEO | Chưa có dữ liệu backlink, Google Business Profile, NAP và brand mention trong workspace. | Medium | Thu thập dữ liệu thật; không tự tạo review, backlink hoặc claim “top”. | Toàn bộ nhóm Aqua |
| Content quality | SEO/AEO | Một số số liệu trong bảng so sánh và bài phân tích không ghi nguồn, ngày cập nhật hoặc phạm vi “giá gốc/thứ cấp”. | Medium | Mỗi bảng cần cột nguồn, ngày, loại giá và ghi “chưa xác minh” khi thiếu dữ liệu. | Hai bài Aqua |

## Điểm hiện tại

| Trụ cột | Điểm tạm tính | Cơ sở |
|---|---:|---|
| SEO | 78/100 (local, provisional) | Canonical, H1, sitemap và SSR tốt locally; production drift, PSI, GSC, backlink và kiểm thử Rich Results độc lập chưa được xác minh. |
| GEO | 72/100 (local, provisional) | Entity/direct answer đã được cải thiện; provenance theo sản phẩm, nguồn pháp lý chính thức và AI citation còn thiếu. |
| AEO | 84/100 (local, provisional) | Có câu hỏi thật, bảng và answer box; FAQ schema vừa được bổ sung cho hai bài chuyên đề, chưa có Rich Results validation production. |

Đây là điểm audit nội bộ có điều kiện, không phải điểm Google hay điểm của công cụ AI. Không thể kết luận 100/100 hoặc Tier S khi production drift và các phép đo bên ngoài chưa được xác minh.

## Khoảng cách tới Tier S

1. **Core Web Vitals Good Mobile/Desktop:** PageSpeed API bị HTTP 429; chưa đạt điều kiện chứng minh.
2. **Title/Meta/H1 unique:** local source đã có cấu trúc riêng, nhưng production đang drift và còn cần crawl production/GSC để loại cannibalization.
3. **Structured Data hợp lệ:** đã bổ sung Breadcrumb/FAQ cho bài chuyên đề; cần chạy Rich Results Test và kiểm tra schema production sau deploy.
4. **Ngôn ngữ:** đã loại một số claim marketing và khuyến nghị quá chắc chắn; vẫn cần biên tập toàn bộ nội dung Aqua theo nguồn chính thức.
5. **AI citation chính xác:** chưa có thử nghiệm có lưu prompt, ngày, công cụ, câu trả lời và URL được trích dẫn; chưa thể đánh dấu đạt.

## Đã sửa trong đợt này

- Chuẩn hoá tên entity và mô tả Aqua City trên route dự án.
- Loại claim uỷ quyền/kiểm tra pháp lý không có bằng chứng khỏi metadata tiếng Anh.
- Hủy giá/offer count hardcoded trong SSR legacy thay vì phát ra giá giả hoặc giá bằng 0.
- Thêm direct answer trung tính cho hai bài chuyên đề.
- Thêm `FAQPage` và `BreadcrumbList` cho hai bài, chỉ dùng FAQ đang hiển thị.
- Đổi kết luận đầu tư thành khung thẩm định, không phải khuyến nghị mua.
- Ghi rõ các giới hạn đo lường trong báo cáo này.

## Kế hoạch ưu tiên

1. **Critical — trước khi publish:** thu thập hồ sơ pháp lý/giá/tiến độ theo phân khu; cập nhật bảng chỉ khi có nguồn và ngày.
2. **Critical — trước khi publish:** publish/promote đúng build đã audit, sau đó crawl lại production để xác nhận title, H1, canonical, direct answer và schema không còn drift.
3. **High — 1 ngày:** chạy PSI Aqua Mobile/Desktop khi API không còn rate-limit, Rich Results Test và crawl internal links; lưu kết quả có provenance.
4. **High — 1–2 ngày:** nhập GSC export cho Aqua và lập query-to-page map, xử lý cannibalization.
5. **Medium — 2–3 ngày:** biên tập ngôn ngữ và bảng dữ liệu, bổ sung `lastVerified`/source cho từng fact.
6. **Low — sau đó:** benchmark backlink, GBP/NAP và AI citation với prompt cố định; không dùng kết quả để khẳng định Top 1.