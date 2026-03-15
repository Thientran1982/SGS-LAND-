/**
 * SGS Land — Vietnamese Real Estate AVM Engine
 * (Automated Valuation Model - Mô hình định giá tự động)
 *
 * Formula:
 *   P_adjusted/m² = P_market × Kd × Kp × Ka
 *   P_total       = P_adjusted/m² × Area
 *
 * Where:
 *   P_market = raw market base price for a STANDARD reference property:
 *              (Sổ Hồng, lộ giới 4m, diện tích 60-100m²) in the target area
 *   Kd       = Road Width coefficient (hệ số lộ giới)
 *   Kp       = Legal Status coefficient (hệ số pháp lý)
 *   Ka       = Area Size coefficient (hệ số diện tích)
 */

export type LegalStatus = 'PINK_BOOK' | 'CONTRACT' | 'WAITING';

export interface AVMInput {
  marketBasePrice: number;   // raw price/m² for standard reference property (VNĐ)
  area: number;              // property area (m²)
  roadWidth: number;         // road/alley width in front of property (m)
  legal: LegalStatus;
  confidence: number;        // AI confidence 0-100
  marketTrend: string;
}

export interface AVMFactor {
  label: string;
  coefficient: number;       // e.g. 1.18 or 0.88
  impact: number;            // percentage change vs standard: e.g. +18 or -12
  isPositive: boolean;
  description: string;
}

export interface AVMOutput {
  marketBasePrice: number;   // raw base price from AI
  pricePerM2: number;        // adjusted price per m² (after AVM)
  totalPrice: number;        // = pricePerM2 × area
  rangeMin: number;
  rangeMax: number;
  confidence: number;
  marketTrend: string;
  factors: AVMFactor[];
  coefficients: { Kd: number; Kp: number; Ka: number };
  formula: string;           // human-readable formula string
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Hệ số lộ giới (Kd — Road Width Coefficient)
//    Standard reference: 4m (hẻm xe hơi)
// ─────────────────────────────────────────────────────────────────────────────
function getKd(roadWidth: number): { value: number; label: string; description: string } {
  if (roadWidth >= 20) return {
    value: 1.30,
    label: `Đại lộ / Phố lớn ≥ 20m`,
    description: 'Mặt tiền đại lộ — giá trị thương mại cao nhất'
  };
  if (roadWidth >= 12) return {
    value: 1.18,
    label: `Đường chính ${roadWidth}m`,
    description: 'Đường trục chính, 2 làn xe, tiện lợi tối đa'
  };
  if (roadWidth >= 8) return {
    value: 1.10,
    label: `Đường nội khu ${roadWidth}m`,
    description: 'Đường rộng, ô tô dễ di chuyển 2 chiều'
  };
  if (roadWidth >= 6) return {
    value: 1.05,
    label: `Đường ${roadWidth}m`,
    description: 'Ô tô 2 chiều, thoáng đãng'
  };
  if (roadWidth >= 4) return {
    value: 1.00,
    label: `Hẻm xe hơi ${roadWidth}m`,
    description: 'Chuẩn tham chiếu — hẻm xe hơi vào được'
  };
  if (roadWidth >= 3) return {
    value: 0.90,
    label: `Hẻm ${roadWidth}m`,
    description: 'Hẻm xe máy, xe hơi khó vào'
  };
  if (roadWidth >= 2) return {
    value: 0.80,
    label: `Hẻm hẹp ${roadWidth}m`,
    description: 'Hẻm hẹp, chỉ xe máy'
  };
  return {
    value: 0.70,
    label: `Hẻm cụt / ngõ < 2m`,
    description: 'Lối đi rất hẹp, thanh khoản thấp'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Hệ số pháp lý (Kp — Legal Status Coefficient)
//    Standard reference: Sổ Hồng/Đỏ đầy đủ
// ─────────────────────────────────────────────────────────────────────────────
function getKp(legal: LegalStatus): { value: number; label: string; description: string } {
  switch (legal) {
    case 'PINK_BOOK':
      return {
        value: 1.00,
        label: 'Sổ Hồng / Sổ Đỏ đầy đủ',
        description: 'Giấy tờ hoàn chỉnh — chuẩn tham chiếu, dễ thế chấp ngân hàng'
      };
    case 'CONTRACT':
      return {
        value: 0.88,
        label: 'Hợp đồng mua bán (HĐMB)',
        description: 'Chờ cấp sổ — rủi ro pháp lý trung bình, giảm 12%'
      };
    case 'WAITING':
    default:
      return {
        value: 0.80,
        label: 'Vi Bằng / Chưa có sổ',
        description: 'Pháp lý chưa rõ ràng — rủi ro cao, giảm 20%'
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Hệ số diện tích (Ka — Area Size Coefficient)
//    Standard reference: 60-100m²
//    Lý do: thị trường VN ưa chuộng nhà < 60m² (nhà phố) → premium nhỏ
//           lô đất lớn > 150m² ở nội đô hiếm → premium cao
// ─────────────────────────────────────────────────────────────────────────────
function getKa(area: number): { value: number; label: string; description: string } {
  if (area < 25) return {
    value: 0.90,
    label: `Siêu nhỏ ${area}m²`,
    description: 'Diện tích < 25m² — thị trường hạn chế, khó bán lại'
  };
  if (area < 40) return {
    value: 0.95,
    label: `Nhỏ ${area}m²`,
    description: 'Diện tích 25-40m² — phù hợp mua đầu tư, ít nhu cầu ở'
  };
  if (area < 60) return {
    value: 0.98,
    label: `Trung bình nhỏ ${area}m²`,
    description: 'Diện tích 40-60m² — phổ biến, thanh khoản tốt'
  };
  if (area < 100) return {
    value: 1.00,
    label: `Chuẩn ${area}m²`,
    description: 'Diện tích 60-100m² — chuẩn tham chiếu thị trường'
  };
  if (area < 150) return {
    value: 1.03,
    label: `Lớn ${area}m²`,
    description: 'Diện tích 100-150m² — nhu cầu ở thực cao'
  };
  if (area < 250) return {
    value: 1.06,
    label: `Rộng ${area}m²`,
    description: 'Diện tích 150-250m² — hiếm tại nội đô, giá premium'
  };
  return {
    value: 1.10,
    label: `Đất lớn ${area}m²`,
    description: 'Diện tích ≥ 250m² — quý hiếm, tiềm năng phân lô hoặc xây cao tầng'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Khoảng tin cậy (Confidence Interval)
//    Based on quality of AI market data
// ─────────────────────────────────────────────────────────────────────────────
function getConfidenceMargin(confidence: number): number {
  if (confidence >= 88) return 0.07;  // ±7%  — dữ liệu rất tốt
  if (confidence >= 78) return 0.10;  // ±10% — dữ liệu tốt
  if (confidence >= 68) return 0.14;  // ±14% — dữ liệu trung bình
  if (confidence >= 55) return 0.18;  // ±18% — dữ liệu hạn chế
  return 0.25;                        // ±25% — ước tính thấp
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MAIN AVM CALCULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export function applyAVM(input: AVMInput): AVMOutput {
  const { marketBasePrice, area, roadWidth, legal, confidence, marketTrend } = input;

  const Kd_data = getKd(roadWidth);
  const Kp_data = getKp(legal);
  const Ka_data = getKa(area);

  const Kd = Kd_data.value;
  const Kp = Kp_data.value;
  const Ka = Ka_data.value;

  // Core formula
  const pricePerM2 = Math.round(marketBasePrice * Kd * Kp * Ka);
  const totalPrice = Math.round(pricePerM2 * area);

  // Confidence interval
  const margin = getConfidenceMargin(confidence);
  const rangeMin = Math.round(totalPrice * (1 - margin));
  const rangeMax = Math.round(totalPrice * (1 + margin));

  // Build factor list — only include non-standard coefficients as "adjustments"
  const factors: AVMFactor[] = [];

  // Road width factor
  const kdImpact = Math.round((Kd - 1.00) * 100);
  factors.push({
    label: Kd_data.label,
    coefficient: Kd,
    impact: Math.abs(kdImpact),
    isPositive: Kd >= 1.00,
    description: Kd_data.description
  });

  // Legal factor
  const kpImpact = Math.round((Kp - 1.00) * 100);
  factors.push({
    label: Kp_data.label,
    coefficient: Kp,
    impact: Math.abs(kpImpact),
    isPositive: Kp >= 1.00,
    description: Kp_data.description
  });

  // Area factor
  const kaImpact = Math.round((Ka - 1.00) * 100);
  factors.push({
    label: Ka_data.label,
    coefficient: Ka,
    impact: Math.abs(kaImpact),
    isPositive: Ka >= 1.00,
    description: Ka_data.description
  });

  const formula = `${(marketBasePrice / 1_000_000).toFixed(0)} tr/m² × Kd(${Kd}) × Kp(${Kp}) × Ka(${Ka}) = ${(pricePerM2 / 1_000_000).toFixed(0)} tr/m²`;

  return {
    marketBasePrice,
    pricePerM2,
    totalPrice,
    rangeMin,
    rangeMax,
    confidence,
    marketTrend,
    factors,
    coefficients: { Kd, Kp, Ka },
    formula,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. REGIONAL BASE PRICE TABLE (used for local fallback when AI is unavailable)
//    Unit: VNĐ/m² for standard reference property (Sổ Hồng, 4m road, 60-100m²)
// ─────────────────────────────────────────────────────────────────────────────
export function getRegionalBasePrice(address: string): {
  price: number;
  region: string;
  confidence: number;
} {
  const addr = address.toLowerCase();

  // TP.HCM — Phân loại theo quận
  if (/quận 1\b|q\.?1\b|district 1/i.test(addr)) return { price: 280_000_000, region: 'Quận 1, TP.HCM', confidence: 60 };
  if (/quận 3\b|q\.?3\b/i.test(addr)) return { price: 200_000_000, region: 'Quận 3, TP.HCM', confidence: 60 };
  if (/quận 4\b|q\.?4\b/i.test(addr)) return { price: 130_000_000, region: 'Quận 4, TP.HCM', confidence: 60 };
  if (/quận 5\b|q\.?5\b/i.test(addr)) return { price: 140_000_000, region: 'Quận 5, TP.HCM', confidence: 60 };
  if (/quận 6\b|q\.?6\b/i.test(addr)) return { price: 90_000_000, region: 'Quận 6, TP.HCM', confidence: 60 };
  if (/quận 7\b|q\.?7\b/i.test(addr)) return { price: 150_000_000, region: 'Quận 7, TP.HCM', confidence: 60 };
  if (/quận 8\b|q\.?8\b/i.test(addr)) return { price: 80_000_000, region: 'Quận 8, TP.HCM', confidence: 60 };
  if (/quận 9\b|q\.?9\b/i.test(addr)) return { price: 70_000_000, region: 'Quận 9, TP.HCM', confidence: 60 };
  if (/quận 10\b|q\.?10\b/i.test(addr)) return { price: 160_000_000, region: 'Quận 10, TP.HCM', confidence: 60 };
  if (/quận 11\b|q\.?11\b/i.test(addr)) return { price: 110_000_000, region: 'Quận 11, TP.HCM', confidence: 60 };
  if (/quận 12\b|q\.?12\b/i.test(addr)) return { price: 65_000_000, region: 'Quận 12, TP.HCM', confidence: 60 };
  if (/bình thạnh|binh thanh/i.test(addr)) return { price: 120_000_000, region: 'Bình Thạnh, TP.HCM', confidence: 60 };
  if (/phú nhuận|phu nhuan/i.test(addr)) return { price: 150_000_000, region: 'Phú Nhuận, TP.HCM', confidence: 60 };
  if (/tân bình|tan binh/i.test(addr)) return { price: 100_000_000, region: 'Tân Bình, TP.HCM', confidence: 60 };
  if (/gò vấp|go vap/i.test(addr)) return { price: 75_000_000, region: 'Gò Vấp, TP.HCM', confidence: 60 };
  if (/thủ đức|thu duc/i.test(addr)) return { price: 65_000_000, region: 'Thủ Đức, TP.HCM', confidence: 58 };
  if (/bình dương|binh duong/i.test(addr)) return { price: 45_000_000, region: 'Bình Dương', confidence: 55 };
  if (/hcm|hồ chí minh|ho chi minh|sài gòn|saigon/i.test(addr)) return { price: 100_000_000, region: 'TP.HCM (trung bình)', confidence: 55 };

  // Hà Nội — Phân loại theo quận
  if (/hoàn kiếm|hoan kiem/i.test(addr)) return { price: 300_000_000, region: 'Hoàn Kiếm, Hà Nội', confidence: 60 };
  if (/ba đình|ba dinh/i.test(addr)) return { price: 220_000_000, region: 'Ba Đình, Hà Nội', confidence: 60 };
  if (/đống đa|dong da/i.test(addr)) return { price: 180_000_000, region: 'Đống Đa, Hà Nội', confidence: 60 };
  if (/hai bà trưng|hai ba trung/i.test(addr)) return { price: 170_000_000, region: 'Hai Bà Trưng, Hà Nội', confidence: 60 };
  if (/cầu giấy|cau giay/i.test(addr)) return { price: 120_000_000, region: 'Cầu Giấy, Hà Nội', confidence: 60 };
  if (/tây hồ|tay ho/i.test(addr)) return { price: 130_000_000, region: 'Tây Hồ, Hà Nội', confidence: 60 };
  if (/nam từ liêm|nam tu liem|bắc từ liêm|bac tu liem/i.test(addr)) return { price: 85_000_000, region: 'Từ Liêm, Hà Nội', confidence: 58 };
  if (/long biên|long bien/i.test(addr)) return { price: 70_000_000, region: 'Long Biên, Hà Nội', confidence: 58 };
  if (/hà đông|ha dong/i.test(addr)) return { price: 60_000_000, region: 'Hà Đông, Hà Nội', confidence: 55 };
  if (/hà nội|hanoi|ha noi/i.test(addr)) return { price: 110_000_000, region: 'Hà Nội (trung bình)', confidence: 52 };

  // Các thành phố lớn khác
  if (/đà nẵng|da nang/i.test(addr)) return { price: 75_000_000, region: 'Đà Nẵng', confidence: 55 };
  if (/nha trang/i.test(addr)) return { price: 60_000_000, region: 'Nha Trang', confidence: 52 };
  if (/hải phòng|hai phong/i.test(addr)) return { price: 50_000_000, region: 'Hải Phòng', confidence: 52 };
  if (/cần thơ|can tho/i.test(addr)) return { price: 35_000_000, region: 'Cần Thơ', confidence: 50 };
  if (/long an|bình phước|đồng nai|dong nai/i.test(addr)) return { price: 30_000_000, region: 'Khu vực lân cận HCM', confidence: 48 };

  // Default — tỉnh/thành khác
  return { price: 25_000_000, region: 'Tỉnh/Thành khác', confidence: 42 };
}
