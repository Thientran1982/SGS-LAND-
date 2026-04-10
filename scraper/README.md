# SGSLand Scraper v2.0

Web scraper thu thập dữ liệu BĐS từ API công khai của [sgsland.vn](https://sgsland.vn).

## Cài đặt

```bash
cd scraper
npm install
```

## Sử dụng

### Scrape một lần (mặc định → JSON)
```bash
npm run scrape
```

### Xuất CSV
```bash
npm run scrape:csv
```

### Xuất cả JSON + CSV
```bash
npm run scrape:both
```

### Chạy định kỳ (mỗi 30 phút)
```bash
npm run schedule
# hoặc tuỳ chỉnh interval
npx tsx src/main.ts --mode=schedule --interval=60
```

### Filter theo loại BĐS
```bash
npm run villa          # chỉ Villa
npm run townhouse      # chỉ Townhouse
npm run land           # chỉ đất nền
npx tsx src/main.ts --type=Apartment
```

### Filter theo khu vực
```bash
npm run dongnai        # Đồng Nai
npm run binhduong      # Bình Dương
npm run hcmc           # TP.HCM
npx tsx src/main.ts --location="Long Thành"
```

### Filter nâng cao
```bash
# Chỉ lấy BĐS đã xác minh
npm run verified

# Kèm định giá AI (chậm hơn — gọi thêm API valuation)
npm run with-val

# Kết hợp nhiều filter
npx tsx src/main.ts --type=Villa --transaction=SALE --minPrice=5000000000 --verified

# Tìm kiếm full-text
npx tsx src/main.ts --search="Aqua City"

# Custom pageSize và delay
npx tsx src/main.ts --pageSize=50 --delay=1000
```

## Output

File được lưu tại `./output/`:
- `listings-2026-04-10T10-30-00.json` — đầy đủ dữ liệu + stats
- `listings-2026-04-10T10-30-00.csv`  — bảng tính

### Cấu trúc JSON output

```json
{
  "scrapedAt": "2026-04-10T10:30:00.000Z",
  "durationMs": 12400,
  "stats": {
    "totalListings": 53,
    "verifiedCount": 48,
    "byType": { "Villa": 20, "Townhouse": 18, "Land": 10, "Apartment": 5 },
    "byTransaction": { "SALE": 50, "RENT": 3 },
    "price": { "min": 1500000000, "max": 80000000000, "avg": 14200000000, "median": 12000000000, "p25": 8000000000, "p75": 18000000000 },
    "area": { "min": 60, "max": 1000, "avg": 215 },
    "topLocations": [...]
  },
  "listings": [
    {
      "id": "dd9a0dfb-87c8-4f8b-a5b1-f43285b3d43e",
      "code": "LST870787",
      "title": "Bán biệt thự song lập NA.SV1-1 diện tích 10x20m",
      "type": "Villa",
      "status": "AVAILABLE",
      "transaction": "SALE",
      "price": 13200000000,
      "pricePerM2": 66000000,
      "currency": "VND",
      "area": 200,
      "location": "đường Ngô Quyền, Long Hưng, Đồng Nai",
      "lat": 10.882098,
      "lng": 106.858173,
      "isVerified": true,
      "direction": "NorthEast",
      "legalStatus": "Contract",
      "url": "https://sgsland.vn/listing/dd9a0dfb-...",
      "valuation": {
        "pricePerM2": 72000000,
        "totalMid": 14400000000,
        "confidence": 57,
        "trendText": "Tăng nhẹ"
      }
    }
  ]
}
```

### Các cột CSV

`id, code, title, type, status, transaction, price, pricePerM2, currency, area, location, lat, lng, bedrooms, bathrooms, direction, frontage, legalStatus, furniture, isVerified, viewCount, contactPhone, projectCode, url, valuation_pricePerM2, valuation_confidence, valuation_trendText, createdAt, updatedAt`

## Endpoints API

| Endpoint | Mô tả |
|----------|-------|
| `GET /api/public/listings` | Danh sách BĐS phân trang |
| `GET /api/valuation/teaser` | Định giá AI theo khu vực + diện tích |

### Query params `/api/public/listings`

| Param | Type | Ví dụ |
|-------|------|-------|
| `page` | number | `1` |
| `pageSize` | number | `20` |
| `type` | string | `Villa`, `Apartment`, `Townhouse`, `Land` |
| `transaction` | string | `SALE`, `RENT` |
| `location` | string | `Đồng Nai` |
| `minPrice` | number | `5000000000` |
| `maxPrice` | number | `20000000000` |
| `minArea` | number | `100` |
| `maxArea` | number | `500` |
| `isVerified` | boolean | `true` |
| `search` | string | `Aqua City` |

## Lưu ý

- **Delay mặc định**: 800ms giữa mỗi request — tôn trọng server
- **Không cần auth**: API public không yêu cầu đăng nhập
- **ID listing**: dùng UUID (`id`) cho detail endpoint, không dùng `code`
- **Images**: đường dẫn relative → scraper tự ghép với baseUrl
