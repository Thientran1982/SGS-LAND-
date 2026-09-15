# Sprint 2 SEO/GEO — CTR và query có dữ liệu thật

**Ngày triển khai:** 15/09/2026  
**Nguồn baseline:** Google Search Console export của property `https://sgsland.vn/`, Search type Web, kỳ 19/05/2026–18/08/2026. Đây là export đã lưu, không phải dữ liệu API live.

## Baseline dùng để ưu tiên

| Nhóm | Query/page evidence | Impression | Click | CTR | Vị trí TB | Ưu tiên |
|---|---|---:|---:|---:|---:|---|
| Location | `bất động sản Đồng Nai 2026` → `/bat-dong-san-dong-nai` | 24 | 2 | 8,33% | 7,62 | P1 |
| Location | `bat dong san long thanh` → `/bat-dong-san-long-thanh` | 18 | 0 | 0% | 16,39 | P1 |
| Location | `bất động sản long thành` → `/bat-dong-san-long-thanh` | 16 | 0 | 0% | 15,06 | P1 |
| Project | `căn hộ aqua city` → `/du-an/aqua-city` | 28 | 0 | 0% | 20,64 | P2 |
| Project | `dự án izumi city` → `/du-an/izumi-city` | 45 | 0 | 0% | 30,36 | P2 |
| Project | `grand manhattan novaland` → `/du-an/manhattan` | 34 | 0 | 0% | 23,79 | P2 |
| Project | `chung cư Đại Nhật` → page evidence chưa có trong export query | 27 | 2 | 7,41% | 7,70 | P1 |
| Legacy | `66 legacy` → page evidence chưa có trong export query | 21 | 0 | 0% | 7,71 | P1 |
| Legacy | `masteri cosmo central` → page evidence chưa có trong export query | 43 | 0 | 0% | 39,79 | P2 |

Page-level baseline trong cùng export: `/bat-dong-san-dong-nai` có 230 impressions, 7 clicks, CTR 3,04%, vị trí 7,19; `/landing/legacy-66/` có 629 impressions, 6 clicks, CTR 0,95%, vị trí 22,12.

## Đã triển khai

1. **Đồng Nai**
   - Rút gọn title để tập trung entity, năm và intent `dự án & giá`.
   - Viết lại meta description theo query thật, không khẳng định giá hoặc tư cách phân phối khi chưa có hồ sơ.
   - Mở đầu bằng câu trả lời độc lập cho “Bất động sản Đồng Nai 2026 là gì?”.
   - Giữ liên kết tới Long Thành, Nhơn Trạch, Aqua City và Izumi City.
   - Hiển thị ngày rà soát nội dung và ghi rõ giới hạn bằng chứng.

2. **Long Thành**
   - Rút gọn title/meta cho hai biến thể query có vị trí 15–16.
   - Loại claim kho hàng `3.200+` và mức giá tĩnh chưa có nguồn sản phẩm.
   - Bổ sung answer-first block, tiêu chí đánh giá và liên kết về các trang liên quan.

3. **Project/entity pages**
   - Bổ sung metadata phù hợp cho Diamond Sky với entity “hồ Đại Nhật”.
   - Thêm metadata riêng cho Masteri Cosmo Central.
   - Làm rõ metadata Izumi City và Grand Manhattan theo hướng tham khảo, yêu cầu xác minh.
   - Sửa entity/location mâu thuẫn của Grand Manhattan trong `PROJECT_META`.
   - Rút gọn title landing Legacy 66 và Masteri Cosmo Central để tránh title quá dài.

4. **GEO/schema/internal links**
   - Breadcrumb và FAQ schema của local landing giờ dùng đúng canonical path, kể cả các route có `areaSlug` ngắn.
   - Link khu vực và link district được thêm locale prefix khi đang ở `/en`.
   - Loại claim mặc định “đại lý uỷ quyền” và “pháp lý sổ hồng rõ ràng” khỏi template local khi không có bằng chứng route-specific.
   - Không phát hành `AggregateOffer` với giá `0` cho Grand Manhattan.

5. **Query-to-page map**
   - Sửa regex whitespace bị escape sai.
   - Phân loại đúng nhóm query Legacy 66, Masteri Cosmo, Diamond Sky/Đại Nhật, Central Park, Aqua City, Izumi City và Grand Manhattan.
   - Chuẩn hóa destination path không trailing slash.

## Giới hạn và cách đo tiếp

- Chưa có live Search Console API trong repo; chưa được phép gọi hoặc submit dữ liệu bên ngoài.
- Export hiện tại có một số query không có cột page evidence, vì vậy không được suy luận rằng query chắc chắn thuộc `/marketplace`.
- Cần export cùng loại dữ liệu sau ít nhất một chu kỳ Search Console để so sánh CTR/vị trí trước–sau theo query và URL.
- Không dùng thay đổi lần này để khẳng định tăng hạng hoặc citation AI.