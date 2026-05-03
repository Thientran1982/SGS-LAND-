# NAP Consistency Checklist — SGS Land

> **NAP** = Name, Address, Phone. Để được Google/Bing/AI engine tin tưởng (E-E-A-T) và xếp hạng Local Pack, ba thông tin này PHẢI giống nhau byte-by-byte trên mọi nền tảng. Sai lệch chính tả/khoảng trắng cũng làm giảm điểm Trust.

## Nguồn chuẩn (Source of Truth)

```
Name:    SGS Land
Legal:   Công ty Cổ phần SGS Land
Address: <số nhà + tên đường>, <phường>, <quận>, TP. Hồ Chí Minh, Việt Nam
Phone:   +84 971 132 378
Display: 0971 132 378  (chỉ dùng trong UI tiếng Việt)
Email:   info@sgsland.vn
Website: https://sgsland.vn
```

> ⚠️ Address chính xác phải được điền vào file này trước khi onboard sang các nền tảng dưới đây.

## Checklist 9 nền tảng

| # | Nền tảng | URL profile | NAP đồng bộ | Logo | Mô tả VI | Liên kết Website | Người phụ trách | Ngày kiểm |
|---|----------|-------------|-------------|------|----------|------------------|-----------------|-----------|
| 1 | Google Business Profile | https://business.google.com | ☐ | ☐ | ☐ | ☐ | Marketing | __/__/2026 |
| 2 | Facebook Page          | https://facebook.com/sgsland | ☐ | ☐ | ☐ | ☐ | Marketing | __/__/2026 |
| 3 | LinkedIn Company       | https://linkedin.com/company/sgsland | ☐ | ☐ | ☐ | ☐ | Marketing | __/__/2026 |
| 4 | TikTok Business        | https://tiktok.com/@sgsland | ☐ | ☐ | ☐ | ☐ | Marketing | __/__/2026 |
| 5 | Zalo Official Account  | https://zalo.me/sgsland | ☐ | ☐ | ☐ | ☐ | CSKH | __/__/2026 |
| 6 | YouTube Channel        | https://youtube.com/@sgsland | ☐ | ☐ | ☐ | ☐ | Marketing | __/__/2026 |
| 7 | Batdongsan.com.vn      | https://batdongsan.com.vn/m/sgsland | ☐ | ☐ | ☐ | ☐ | Sales Ops | __/__/2026 |
| 8 | Nhà Tốt (Chợ Tốt)      | https://nhatot.com/u/sgsland | ☐ | ☐ | ☐ | ☐ | Sales Ops | __/__/2026 |
| 9 | Cafeland Pro           | https://cafeland.vn/pro/sgsland | ☐ | ☐ | ☐ | ☐ | Marketing | __/__/2026 |

## Quy tắc đồng bộ

1. **Tên thương hiệu**: dùng đúng "SGS Land" (1 dấu cách, S/G/S viết hoa), không dùng "SGSLand", "SGS-Land", "Sgs Land".
2. **Số điện thoại**: lưu dạng E.164 `+84971132378` trong DB, hiển thị `0971 132 378` trong UI tiếng Việt.
3. **Địa chỉ**: viết đầy đủ "TP. Hồ Chí Minh" thay vì "TPHCM"/"HCM"/"Sai Gon".
4. **Logo**: dùng đúng `logo.svg` (đường dẫn `https://sgsland.vn/logo.svg`), không dùng logo cũ.
5. **Mô tả VI**: bắt đầu bằng "SGS Land là nền tảng công nghệ bất động sản AI tại Việt Nam…" để AI engine trích Definition Block.
6. **URL website**: luôn dùng `https://sgsland.vn` (không có `www.`, không có trailing slash).
7. **Tài khoản mạng xã hội**: liên kết chéo (LinkedIn ↔ Facebook ↔ YouTube) đầy đủ trong field `sameAs` của JSON-LD.
8. **Giờ làm việc**: 08:00-22:00 T2-T7, 09:00-18:00 CN — KHÔNG để trống.
9. **Ảnh đại diện**: ≥50 ảnh trên GBP, ≥20 ảnh trên Facebook, ≥10 ảnh trên LinkedIn (xem `gbp-sgsland.json`).

## Thay đổi NAP — quy trình bắt buộc

Khi đổi địa chỉ/phone/tên: cập nhật ĐỒNG THỜI trong cùng 24h trên cả 9 nền tảng + cập nhật `metaInjector.ts` field `Organization` + `RealEstateAgent` + `replit.md`. Trễ > 48h → Google flag là "duplicate listing" hoặc giảm điểm trust.
