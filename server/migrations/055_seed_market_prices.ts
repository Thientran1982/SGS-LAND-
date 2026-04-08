import type { Migration } from './runner';
import type { PoolClient } from 'pg';

/**
 * Seed comprehensive Vietnamese real estate market prices — Q1 2025
 *
 * Prices (VNĐ/m²) sourced from aggregated public market data:
 * batdongsan.com.vn, cafeland.vn, cen.vn, onehousing.vn, CBRE/Savills Vietnam.
 * Represents residential townhouse/house reference prices.
 * Type multipliers are applied at query time for apartments, villas, land, etc.
 *
 * Normalization: same as normalizeLocation() in marketDataService.ts
 *   - lowercase → NFD diacritic strip → replace /[^a-z0-9\s]/ with space
 *   - Note: Vietnamese 'đ'/'Đ' is NOT decomposable via NFD → becomes space
 */
function normalizeKey(location: string): string {
  return location
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

interface PriceSeed {
  location: string;
  pricePerM2: number; // VNĐ/m² townhouse reference
  priceMin?: number;
  priceMax?: number;
  trend?: string;
  confidence?: number;
}

const SEEDS: PriceSeed[] = [
  // ══ TP. Hồ Chí Minh — Quận nội thành ════════════════════════════════════
  { location: 'Quận 1, TP. Hồ Chí Minh',              pricePerM2: 400_000_000, priceMin: 280_000_000, priceMax: 600_000_000, trend: 'Tăng trưởng ổn định', confidence: 85 },
  { location: 'Quận 3, TP. Hồ Chí Minh',              pricePerM2: 280_000_000, priceMin: 200_000_000, priceMax: 400_000_000, trend: 'Tăng nhẹ', confidence: 80 },
  { location: 'Quận 4, TP. Hồ Chí Minh',              pricePerM2: 175_000_000, priceMin: 120_000_000, priceMax: 250_000_000, trend: 'Ổn định', confidence: 78 },
  { location: 'Quận 5 Chợ Lớn, TP. Hồ Chí Minh',     pricePerM2: 200_000_000, priceMin: 140_000_000, priceMax: 280_000_000, trend: 'Ổn định', confidence: 78 },
  { location: 'Quận 6, TP. Hồ Chí Minh',              pricePerM2: 130_000_000, priceMin: 90_000_000,  priceMax: 180_000_000, trend: 'Ổn định', confidence: 76 },
  { location: 'Quận 7 Phú Mỹ Hưng, TP. Hồ Chí Minh', pricePerM2: 220_000_000, priceMin: 160_000_000, priceMax: 320_000_000, trend: 'Tăng trưởng tốt', confidence: 82 },
  { location: 'Quận 8, TP. Hồ Chí Minh',              pricePerM2: 100_000_000, priceMin: 70_000_000,  priceMax: 140_000_000, trend: 'Ổn định', confidence: 76 },
  { location: 'Quận 10, TP. Hồ Chí Minh',             pricePerM2: 178_000_000, priceMin: 130_000_000, priceMax: 250_000_000, trend: 'Tăng nhẹ', confidence: 78 },
  { location: 'Quận 11, TP. Hồ Chí Minh',             pricePerM2: 150_000_000, priceMin: 110_000_000, priceMax: 210_000_000, trend: 'Ổn định', confidence: 77 },
  { location: 'Quận 12, TP. Hồ Chí Minh',             pricePerM2: 70_000_000,  priceMin: 50_000_000,  priceMax: 100_000_000, trend: 'Tăng nhẹ', confidence: 76 },
  { location: 'Quận Bình Thạnh, TP. Hồ Chí Minh',    pricePerM2: 160_000_000, priceMin: 110_000_000, priceMax: 230_000_000, trend: 'Tăng nhẹ', confidence: 80 },
  { location: 'Quận Phú Nhuận, TP. Hồ Chí Minh',     pricePerM2: 190_000_000, priceMin: 140_000_000, priceMax: 280_000_000, trend: 'Tăng nhẹ', confidence: 80 },
  { location: 'Quận Tân Bình, TP. Hồ Chí Minh',      pricePerM2: 140_000_000, priceMin: 100_000_000, priceMax: 200_000_000, trend: 'Ổn định', confidence: 78 },
  { location: 'Quận Tân Phú, TP. Hồ Chí Minh',       pricePerM2: 100_000_000, priceMin: 70_000_000,  priceMax: 140_000_000, trend: 'Ổn định', confidence: 77 },
  { location: 'Quận Gò Vấp, TP. Hồ Chí Minh',        pricePerM2: 90_000_000,  priceMin: 60_000_000,  priceMax: 130_000_000, trend: 'Tăng nhẹ', confidence: 77 },
  { location: 'Quận Bình Tân, TP. Hồ Chí Minh',      pricePerM2: 80_000_000,  priceMin: 55_000_000,  priceMax: 115_000_000, trend: 'Ổn định', confidence: 76 },
  // TP.HCM — Thành phố Thủ Đức (Q2 + Q9 cũ)
  { location: 'Thảo Điền, Thủ Đức, TP. Hồ Chí Minh', pricePerM2: 200_000_000, priceMin: 140_000_000, priceMax: 300_000_000, trend: 'Tăng trưởng tốt', confidence: 80 },
  { location: 'Thủ Thiêm, Thủ Đức, TP. Hồ Chí Minh', pricePerM2: 280_000_000, priceMin: 180_000_000, priceMax: 420_000_000, trend: 'Tăng mạnh', confidence: 78 },
  { location: 'Quận Thủ Đức, TP. Hồ Chí Minh',       pricePerM2: 100_000_000, priceMin: 65_000_000,  priceMax: 150_000_000, trend: 'Tăng trưởng tốt', confidence: 78 },
  { location: 'Vinhomes Grand Park, Thủ Đức, TP. Hồ Chí Minh', pricePerM2: 95_000_000, priceMin: 65_000_000, priceMax: 140_000_000, trend: 'Ổn định', confidence: 75 },
  // TP.HCM — Huyện ngoại thành
  { location: 'Huyện Bình Chánh, TP. Hồ Chí Minh',   pricePerM2: 35_000_000,  priceMin: 20_000_000,  priceMax: 55_000_000,  trend: 'Tăng nhẹ', confidence: 72 },
  { location: 'Huyện Nhà Bè, TP. Hồ Chí Minh',       pricePerM2: 40_000_000,  priceMin: 25_000_000,  priceMax: 65_000_000,  trend: 'Tăng nhẹ', confidence: 72 },
  { location: 'Huyện Hóc Môn, TP. Hồ Chí Minh',      pricePerM2: 30_000_000,  priceMin: 18_000_000,  priceMax: 48_000_000,  trend: 'Ổn định', confidence: 70 },
  { location: 'Huyện Củ Chi, TP. Hồ Chí Minh',       pricePerM2: 17_000_000,  priceMin: 10_000_000,  priceMax: 28_000_000,  trend: 'Tăng nhẹ', confidence: 68 },
  { location: 'Huyện Cần Giờ, TP. Hồ Chí Minh',      pricePerM2: 12_000_000,  priceMin: 7_000_000,   priceMax: 20_000_000,  trend: 'Ổn định', confidence: 65 },

  // ══ Hà Nội — Quận nội thành ══════════════════════════════════════════════
  { location: 'Quận Hoàn Kiếm, Hà Nội',               pricePerM2: 500_000_000, priceMin: 350_000_000, priceMax: 800_000_000, trend: 'Tăng mạnh', confidence: 85 },
  { location: 'Quận Ba Đình, Hà Nội',                 pricePerM2: 300_000_000, priceMin: 200_000_000, priceMax: 450_000_000, trend: 'Tăng trưởng tốt', confidence: 82 },
  { location: 'Quận Đống Đa, Hà Nội',                 pricePerM2: 250_000_000, priceMin: 170_000_000, priceMax: 370_000_000, trend: 'Tăng nhẹ', confidence: 82 },
  { location: 'Quận Hai Bà Trưng, Hà Nội',            pricePerM2: 220_000_000, priceMin: 150_000_000, priceMax: 330_000_000, trend: 'Tăng nhẹ', confidence: 80 },
  { location: 'Quận Tây Hồ, Hà Nội',                  pricePerM2: 280_000_000, priceMin: 190_000_000, priceMax: 430_000_000, trend: 'Tăng trưởng tốt', confidence: 82 },
  { location: 'Quận Cầu Giấy, Hà Nội',                pricePerM2: 220_000_000, priceMin: 150_000_000, priceMax: 330_000_000, trend: 'Tăng nhẹ', confidence: 80 },
  { location: 'Quận Thanh Xuân, Hà Nội',              pricePerM2: 180_000_000, priceMin: 120_000_000, priceMax: 260_000_000, trend: 'Tăng nhẹ', confidence: 80 },
  { location: 'Quận Hoàng Mai, Hà Nội',               pricePerM2: 110_000_000, priceMin: 75_000_000,  priceMax: 160_000_000, trend: 'Tăng nhẹ', confidence: 78 },
  { location: 'Quận Nam Từ Liêm, Hà Nội',             pricePerM2: 140_000_000, priceMin: 95_000_000,  priceMax: 210_000_000, trend: 'Tăng trưởng tốt', confidence: 78 },
  { location: 'Quận Bắc Từ Liêm, Hà Nội',             pricePerM2: 100_000_000, priceMin: 68_000_000,  priceMax: 150_000_000, trend: 'Tăng nhẹ', confidence: 78 },
  { location: 'Quận Long Biên, Hà Nội',               pricePerM2: 100_000_000, priceMin: 68_000_000,  priceMax: 150_000_000, trend: 'Tăng nhẹ', confidence: 77 },
  { location: 'Quận Hà Đông, Hà Nội',                 pricePerM2: 85_000_000,  priceMin: 58_000_000,  priceMax: 125_000_000, trend: 'Tăng nhẹ', confidence: 77 },
  // Hà Nội — Huyện ngoại thành
  { location: 'Huyện Gia Lâm, Hà Nội',                pricePerM2: 65_000_000,  priceMin: 42_000_000,  priceMax: 100_000_000, trend: 'Tăng nhẹ', confidence: 74 },
  { location: 'Huyện Đông Anh, Hà Nội',               pricePerM2: 55_000_000,  priceMin: 35_000_000,  priceMax: 85_000_000,  trend: 'Tăng nhẹ', confidence: 73 },
  { location: 'Huyện Thanh Trì, Hà Nội',              pricePerM2: 65_000_000,  priceMin: 42_000_000,  priceMax: 100_000_000, trend: 'Ổn định', confidence: 73 },
  { location: 'Huyện Hoài Đức, Hà Nội',               pricePerM2: 100_000_000, priceMin: 65_000_000,  priceMax: 150_000_000, trend: 'Tăng nhẹ', confidence: 74 },
  { location: 'Huyện Mê Linh, Hà Nội',                pricePerM2: 55_000_000,  priceMin: 35_000_000,  priceMax: 85_000_000,  trend: 'Ổn định', confidence: 72 },
  { location: 'Huyện Đan Phượng, Hà Nội',             pricePerM2: 60_000_000,  priceMin: 38_000_000,  priceMax: 92_000_000,  trend: 'Tăng nhẹ', confidence: 72 },
  { location: 'Huyện Thạch Thất - Hòa Lạc, Hà Nội',  pricePerM2: 32_000_000,  priceMin: 20_000_000,  priceMax: 50_000_000,  trend: 'Tăng nhẹ', confidence: 70 },
  { location: 'Huyện Sóc Sơn, Hà Nội',               pricePerM2: 25_000_000,  priceMin: 15_000_000,  priceMax: 40_000_000,  trend: 'Ổn định', confidence: 68 },

  // ══ Đà Nẵng ══════════════════════════════════════════════════════════════
  { location: 'Quận Hải Châu, Đà Nẵng',               pricePerM2: 130_000_000, priceMin: 90_000_000,  priceMax: 200_000_000, trend: 'Tăng nhẹ', confidence: 78 },
  { location: 'Quận Sơn Trà, Đà Nẵng',                pricePerM2: 100_000_000, priceMin: 68_000_000,  priceMax: 155_000_000, trend: 'Tăng nhẹ', confidence: 76 },
  { location: 'Quận Ngũ Hành Sơn, Đà Nẵng',           pricePerM2: 90_000_000,  priceMin: 60_000_000,  priceMax: 140_000_000, trend: 'Tăng nhẹ', confidence: 76 },
  { location: 'Quận Liên Chiểu, Đà Nẵng',             pricePerM2: 70_000_000,  priceMin: 47_000_000,  priceMax: 108_000_000, trend: 'Ổn định', confidence: 75 },
  { location: 'Quận Thanh Khê, Đà Nẵng',              pricePerM2: 80_000_000,  priceMin: 54_000_000,  priceMax: 125_000_000, trend: 'Ổn định', confidence: 76 },
  { location: 'Quận Cẩm Lệ, Đà Nẵng',                pricePerM2: 70_000_000,  priceMin: 47_000_000,  priceMax: 108_000_000, trend: 'Ổn định', confidence: 74 },
  { location: 'Huyện Hòa Vang, Đà Nẵng',              pricePerM2: 25_000_000,  priceMin: 14_000_000,  priceMax: 40_000_000,  trend: 'Tăng nhẹ', confidence: 68 },
  { location: 'Đường Võ Nguyên Giáp - Biển Mỹ Khê, Đà Nẵng', pricePerM2: 120_000_000, priceMin: 80_000_000, priceMax: 190_000_000, trend: 'Tăng trưởng tốt', confidence: 76 },

  // ══ Hải Phòng ═════════════════════════════════════════════════════════════
  { location: 'Quận Hồng Bàng, Hải Phòng',            pricePerM2: 65_000_000,  priceMin: 43_000_000,  priceMax: 100_000_000, trend: 'Ổn định', confidence: 74 },
  { location: 'Quận Ngô Quyền, Hải Phòng',            pricePerM2: 60_000_000,  priceMin: 40_000_000,  priceMax: 92_000_000,  trend: 'Ổn định', confidence: 74 },
  { location: 'Quận Lê Chân, Hải Phòng',              pricePerM2: 55_000_000,  priceMin: 36_000_000,  priceMax: 85_000_000,  trend: 'Ổn định', confidence: 73 },
  { location: 'Quận Hải An, Hải Phòng',               pricePerM2: 45_000_000,  priceMin: 30_000_000,  priceMax: 70_000_000,  trend: 'Tăng nhẹ', confidence: 72 },
  { location: 'Quận Dương Kinh, Hải Phòng',           pricePerM2: 35_000_000,  priceMin: 22_000_000,  priceMax: 55_000_000,  trend: 'Ổn định', confidence: 70 },
  { location: 'Huyện An Dương, Hải Phòng',             pricePerM2: 30_000_000,  priceMin: 18_000_000,  priceMax: 48_000_000,  trend: 'Ổn định', confidence: 70 },
  { location: 'Thành phố Đồ Sơn, Hải Phòng',          pricePerM2: 50_000_000,  priceMin: 30_000_000,  priceMax: 80_000_000,  trend: 'Tăng nhẹ', confidence: 70 },
  { location: 'Huyện Thuỷ Nguyên, Hải Phòng',         pricePerM2: 25_000_000,  priceMin: 14_000_000,  priceMax: 40_000_000,  trend: 'Ổn định', confidence: 68 },

  // ══ Cần Thơ ═══════════════════════════════════════════════════════════════
  { location: 'Quận Ninh Kiều, Cần Thơ',              pricePerM2: 65_000_000,  priceMin: 42_000_000,  priceMax: 100_000_000, trend: 'Tăng nhẹ', confidence: 73 },
  { location: 'Quận Bình Thuỷ, Cần Thơ',              pricePerM2: 40_000_000,  priceMin: 25_000_000,  priceMax: 63_000_000,  trend: 'Ổn định', confidence: 70 },
  { location: 'Quận Cái Răng, Cần Thơ',               pricePerM2: 35_000_000,  priceMin: 22_000_000,  priceMax: 55_000_000,  trend: 'Ổn định', confidence: 70 },
  { location: 'Quận Ô Môn, Cần Thơ',                  pricePerM2: 25_000_000,  priceMin: 14_000_000,  priceMax: 40_000_000,  trend: 'Ổn định', confidence: 68 },
  { location: 'Quận Thốt Nốt, Cần Thơ',               pricePerM2: 20_000_000,  priceMin: 11_000_000,  priceMax: 32_000_000,  trend: 'Ổn định', confidence: 65 },

  // ══ Tỉnh thành lân cận TP.HCM ════════════════════════════════════════════
  { location: 'Thành phố Biên Hòa, Đồng Nai',         pricePerM2: 35_000_000,  priceMin: 22_000_000,  priceMax: 55_000_000,  trend: 'Tăng nhẹ', confidence: 72 },
  { location: 'Nhơn Trạch, Đồng Nai',                 pricePerM2: 25_000_000,  priceMin: 15_000_000,  priceMax: 40_000_000,  trend: 'Tăng nhẹ', confidence: 70 },
  { location: 'Thành phố Thủ Dầu Một, Bình Dương',   pricePerM2: 50_000_000,  priceMin: 33_000_000,  priceMax: 78_000_000,  trend: 'Tăng nhẹ', confidence: 73 },
  { location: 'Thành phố Dĩ An, Bình Dương',          pricePerM2: 55_000_000,  priceMin: 36_000_000,  priceMax: 85_000_000,  trend: 'Tăng nhẹ', confidence: 73 },
  { location: 'Thành phố Thuận An, Bình Dương',       pricePerM2: 50_000_000,  priceMin: 33_000_000,  priceMax: 78_000_000,  trend: 'Tăng nhẹ', confidence: 72 },
  { location: 'Thành phố Vũng Tàu, Bà Rịa - Vũng Tàu', pricePerM2: 60_000_000, priceMin: 38_000_000, priceMax: 95_000_000, trend: 'Tăng trưởng tốt', confidence: 73 },
  { location: 'Thành phố Long An',                    pricePerM2: 22_000_000,  priceMin: 13_000_000,  priceMax: 35_000_000,  trend: 'Ổn định', confidence: 68 },
  { location: 'Thành phố Mỹ Tho, Tiền Giang',        pricePerM2: 22_000_000,  priceMin: 13_000_000,  priceMax: 35_000_000,  trend: 'Ổn định', confidence: 66 },

  // ══ Miền Trung — Nghỉ dưỡng & Đô thị ════════════════════════════════════
  { location: 'Thành phố Nha Trang, Khánh Hòa',       pricePerM2: 80_000_000,  priceMin: 50_000_000,  priceMax: 130_000_000, trend: 'Tăng trưởng tốt', confidence: 73 },
  { location: 'Thành phố Đà Lạt, Lâm Đồng',          pricePerM2: 70_000_000,  priceMin: 45_000_000,  priceMax: 115_000_000, trend: 'Tăng mạnh', confidence: 73 },
  { location: 'Thành phố Quy Nhơn, Bình Định',        pricePerM2: 50_000_000,  priceMin: 32_000_000,  priceMax: 80_000_000,  trend: 'Tăng nhẹ', confidence: 70 },
  { location: 'Thành phố Huế, Thừa Thiên Huế',        pricePerM2: 45_000_000,  priceMin: 28_000_000,  priceMax: 72_000_000,  trend: 'Tăng nhẹ', confidence: 70 },
  { location: 'Thị xã Hội An, Quảng Nam',             pricePerM2: 90_000_000,  priceMin: 55_000_000,  priceMax: 145_000_000, trend: 'Tăng mạnh', confidence: 72 },
  { location: 'Thành phố Phan Thiết, Bình Thuận',     pricePerM2: 35_000_000,  priceMin: 20_000_000,  priceMax: 58_000_000,  trend: 'Tăng nhẹ', confidence: 68 },
  { location: 'Thành phố Vinh, Nghệ An',              pricePerM2: 35_000_000,  priceMin: 22_000_000,  priceMax: 55_000_000,  trend: 'Ổn định', confidence: 68 },

  // ══ Miền Bắc — Tỉnh thành phát triển ════════════════════════════════════
  { location: 'Thành phố Hạ Long, Quảng Ninh',        pricePerM2: 50_000_000,  priceMin: 30_000_000,  priceMax: 80_000_000,  trend: 'Tăng trưởng tốt', confidence: 70 },
  { location: 'Thành phố Bắc Ninh',                   pricePerM2: 40_000_000,  priceMin: 25_000_000,  priceMax: 63_000_000,  trend: 'Tăng nhẹ', confidence: 70 },
  { location: 'Thành phố Thái Nguyên',                pricePerM2: 25_000_000,  priceMin: 15_000_000,  priceMax: 40_000_000,  trend: 'Ổn định', confidence: 68 },
  { location: 'Thành phố Hải Dương',                  pricePerM2: 30_000_000,  priceMin: 18_000_000,  priceMax: 48_000_000,  trend: 'Ổn định', confidence: 68 },
  { location: 'Thành phố Nam Định',                   pricePerM2: 30_000_000,  priceMin: 18_000_000,  priceMax: 48_000_000,  trend: 'Ổn định', confidence: 67 },

  // ══ Tây Nguyên & Miền Nam ════════════════════════════════════════════════
  { location: 'Thành phố Buôn Ma Thuột, Đắk Lắk',    pricePerM2: 35_000_000,  priceMin: 20_000_000,  priceMax: 56_000_000,  trend: 'Ổn định', confidence: 68 },
  { location: 'Thành phố Pleiku, Gia Lai',             pricePerM2: 28_000_000,  priceMin: 16_000_000,  priceMax: 45_000_000,  trend: 'Ổn định', confidence: 67 },
  { location: 'Thành phố Cà Mau',                     pricePerM2: 15_000_000,  priceMin: 9_000_000,   priceMax: 24_000_000,  trend: 'Ổn định', confidence: 64 },
  { location: 'Thành phố Rạch Giá, Kiên Giang',       pricePerM2: 20_000_000,  priceMin: 11_000_000,  priceMax: 32_000_000,  trend: 'Ổn định', confidence: 65 },
  { location: 'Thành phố Long Xuyên, An Giang',       pricePerM2: 25_000_000,  priceMin: 14_000_000,  priceMax: 40_000_000,  trend: 'Ổn định', confidence: 66 },
  { location: 'Thành phố Bến Tre',                    pricePerM2: 18_000_000,  priceMin: 10_000_000,  priceMax: 29_000_000,  trend: 'Ổn định', confidence: 64 },
];

const migration: Migration = {
  description: 'Seed comprehensive Vietnamese real estate market prices Q1/2025 into market_price_history',

  async up(client: PoolClient): Promise<void> {
    // Delete old research_seed entries so we can refresh with updated prices
    await client.query(`DELETE FROM market_price_history WHERE source = 'regional_table'`);

    for (const seed of SEEDS) {
      const key = normalizeKey(seed.location);
      const mid = seed.pricePerM2;
      const pMin = seed.priceMin ?? Math.round(mid * 0.80);
      const pMax = seed.priceMax ?? Math.round(mid * 1.25);
      const conf = seed.confidence ?? 70;
      const trend = seed.trend ?? 'Ổn định';

      await client.query(
        `INSERT INTO market_price_history
           (location_key, location_display, price_per_m2, price_min, price_max,
            property_type, source, confidence, trend_text, source_count, data_recency, recorded_at)
         VALUES ($1,$2,$3,$4,$5,'townhouse_center','regional_table',$6,$7,1,'q1_2025',NOW())`,
        [key, seed.location, mid, pMin, pMax, conf, trend]
      );
    }
  },

  async down(client: PoolClient): Promise<void> {
    await client.query(`DELETE FROM market_price_history WHERE source = 'regional_table'`);
  },
};

export default migration;
