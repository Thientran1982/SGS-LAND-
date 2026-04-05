/**
 * SGS Land — Vietnamese Real Estate Valuation Engine v3
 *
 * Multi-source, multi-coefficient approach:
 *
 *  Method 1 — AVM/Comps (Sales Comparison):
 *    P_adjusted/m² = P_blended × Kd × Kp × Ka × Kfl × Kdir × Kmf × Kfurn × Kage
 *    P_comps       = P_adjusted/m² × Area
 *    where P_blended = weighted blend of:
 *      - AI-researched market price (Google Search grounding)
 *      - Internal comparable listings from DB
 *      - Cached market index (6-hour TTL)
 *
 *  Coefficients:
 *    Kd   — Road width (lộ giới)         : 0.70 – 1.30
 *    Kp   — Legal status (pháp lý)       : 0.80 – 1.00
 *    Ka   — Area size (diện tích)         : 0.90 – 1.10
 *    Kfl  — Floor level (tầng)           : 0.88 – 1.12  [apartments only]
 *    Kdir — Building direction (hướng)   : 0.95 – 1.05
 *    Kmf  — Frontage width (mặt tiền)    : 0.92 – 1.20
 *    Kfurn— Furnishing (nội thất)         : 0.95 – 1.07
 *    Kage — Building age (tuổi nhà)      : 0.70 – 1.05
 *
 *  Method 2 — Income Capitalization (Vietnamese gross yield convention):
 *    GrossIncome   = MonthlyRent × 12
 *    P_income      = GrossIncome / GrossYieldCap
 *
 *  Method 3 — Reconciliation (weighted average):
 *    P_final       = P_comps × W_comps + P_income × W_income
 *
 *  Confidence = f(data_freshness, comps_count, market_liquidity, source_diversity)
 */

import { DEFAULT_VACANCY_RATE, DEFAULT_OPEX_RATE, DEFAULT_CAP_RATE } from './constants';

export type LegalStatus = 'PINK_BOOK' | 'CONTRACT' | 'WAITING';

export type PropertyType =
  | 'apartment_center'
  | 'apartment_suburb'
  | 'townhouse_center'
  | 'townhouse_suburb'
  | 'villa'
  | 'shophouse'
  | 'land_urban'
  | 'land_suburban'
  | 'penthouse'           // Penthouse (tầng cao nhất, view toàn cảnh)
  | 'office'              // Văn phòng / Thương mại
  | 'warehouse'           // Nhà xưởng / Kho bãi / Xưởng sản xuất
  | 'land_agricultural'   // Đất nông nghiệp (chuyển đổi, nghỉ dưỡng)
  | 'land_industrial'     // Đất khu công nghiệp
  | 'project';            // Dự án / Căn hộ off-plan

export interface AVMInput {
  marketBasePrice: number;   // raw price/m² for standard reference property (VNĐ)
  area: number;              // property area (m²)
  roadWidth: number;         // road/alley width in front of property (m)
  legal: LegalStatus;
  confidence: number;        // AI confidence 0-100
  marketTrend: string;
  propertyType?: PropertyType;
  monthlyRent?: number;      // triệu VNĐ/tháng (for income approach)

  // Enhanced inputs (optional — only applied when provided)
  floorLevel?: number;           // tầng (1 = trệt; for apartments)
  direction?: string;            // hướng: 'S','SE','E','NE','N','NW','W','SW'
  frontageWidth?: number;        // mặt tiền (m) — width of the property facing the road
  furnishing?: 'FULL' | 'BASIC' | 'NONE';  // nội thất

  buildingAge?: number;              // tuổi công trình (năm) — 0 = mới xây
  bedrooms?: number;                 // số phòng ngủ — 0 = studio, 1, 2 (ref), 3, 4+

  // Multi-source data
  internalCompsMedian?: number;  // VNĐ/m² from internal comparable listings DB
  internalCompsCount?: number;   // number of internal comparables found
  cachedMarketPrice?: number;    // VNĐ/m² from market data cache (6h TTL)
  cachedConfidence?: number;     // confidence from cache entry
}

// Source breakdown for multi-source transparency
export interface ValuationSources {
  aiPrice: number;
  aiWeight: number;
  internalCompsPrice: number;
  internalCompsCount: number;
  internalCompsWeight: number;
  cachedPrice: number;
  cachedWeight: number;
  blendedPrice: number;          // final weighted average used as marketBasePrice
  confidenceBoost: number;       // bonus confidence from having multiple sources agree
}

export interface AVMFactor {
  label: string;
  coefficient: number;
  impact: number;
  isPositive: boolean;
  description: string;
  type: 'AVM' | 'LOCATION' | 'MULTI_SOURCE';
}

export interface IncomeApproachResult {
  monthlyRent: number;       // triệu/tháng
  grossIncome: number;       // triệu/năm
  vacancyLoss: number;       // triệu/năm
  effectiveIncome: number;   // triệu/năm
  opex: number;              // triệu/năm
  noi: number;               // triệu/năm (Net Operating Income)
  capRate: number;           // % (e.g. 0.050 = 5.0%)
  capitalValue: number;      // VNĐ
  grossRentalYield: number;  // % gross yield
  paybackYears: number;      // years to recoup at current gross income
}

export interface AVMOutput {
  marketBasePrice: number;
  pricePerM2: number;        // AVM-adjusted price/m²
  totalPrice: number;        // RECONCILED final price (or comps-only if no income)
  compsPrice: number;        // pure AVM/comps result (VNĐ)
  rangeMin: number;
  rangeMax: number;
  confidence: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceInterval: string; // e.g. "±10%"
  marketTrend: string;
  factors: AVMFactor[];
  coefficients: { Kd: number; Kp: number; Ka: number; Kfl?: number; Kdir?: number; Kmf?: number; Kfurn?: number; Kage?: number };
  formula: string;
  incomeApproach?: IncomeApproachResult;
  reconciliation?: {
    compsWeight: number;
    incomeWeight: number;
    compsValue: number;     // VNĐ
    incomeValue: number;    // VNĐ
    finalValue: number;     // VNĐ
  };
  sources?: ValuationSources;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cap Rates by Property Type — Vietnamese Market Q1 2025 – Q1 2026
// Source: CBRE Vietnam H2/2025, Savills Vietnam Q4/2025, JLL Vietnam Q1/2026
//
// IMPORTANT: These cap rates are GROSS YIELD caps (annual gross rent / property value)
// NOT NOI caps — aligned with Vietnamese market practice where "tỷ suất cho thuê"
// is always reported as gross yield (before vacancy/opex deductions).
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_CAP_RATES: Record<PropertyType, number> = {
  apartment_center:  0.038,  // Căn hộ nội đô: gross yield 3.5-4.0% (CBRE 2025 — yield nén)
  apartment_suburb:  0.046,  // Căn hộ ngoại thành/trung cấp: 4.4-4.8% gross
  townhouse_center:  0.042,  // Nhà phố nội đô: gross yield 4.0-4.5% (cho thuê nguyên căn)
  townhouse_suburb:  0.055,  // Nhà phố ngoại thành: 5.2-5.8% gross
  villa:             0.045,  // Biệt thự: 4.2-4.8% gross (diện tích lớn, yield thấp hơn)
  shophouse:         0.052,  // Shophouse mặt đường: 5.0-5.5% gross (retail ổn định)
  land_urban:        0.038,  // Đất thổ cư nội đô — thuần tích lũy, yield thấp
  land_suburban:     0.060,  // Đất ngoại thành (cho thuê nông nghiệp/ki-ốt)
  penthouse:         0.030,  // Penthouse — yield thấp nhất: 2.8-3.2% gross (ultra-premium)
  office:            0.065,  // Văn phòng Grade B: 6.0-7.0% gross (Grade A CBD ~5.5-6.5%)
  warehouse:         0.078,  // Kho logistics RBW: 7.5-8.5% gross (e-commerce boom)
  land_agricultural: 0.012,  // Đất nông nghiệp — đầu cơ chuyển đổi, yield danh nghĩa
  land_industrial:   0.048,  // Đất KCN — yield từ cho thuê nhà xưởng: 4.5-5.0%
  project:           0.040,  // Off-plan căn hộ — blended theo tiến độ: ~4.0%
};

// Reconciliation weights: comps vs income, by property type
// Commercial/income-generating → income method has higher weight
// Land → comps more reliable (harder to rent)
const RECONCILE_WEIGHTS: Record<PropertyType, { comps: number; income: number }> = {
  apartment_center:  { comps: 0.55, income: 0.45 },
  apartment_suburb:  { comps: 0.60, income: 0.40 },
  townhouse_center:  { comps: 0.60, income: 0.40 },
  townhouse_suburb:  { comps: 0.65, income: 0.35 },
  villa:             { comps: 0.60, income: 0.40 },
  shophouse:         { comps: 0.45, income: 0.55 },  // income-driven
  land_urban:        { comps: 0.75, income: 0.25 },  // comps-driven
  land_suburban:     { comps: 0.80, income: 0.20 },
  penthouse:         { comps: 0.50, income: 0.50 },  // balanced — premium comps + strong income
  office:            { comps: 0.40, income: 0.60 },  // income-driven (lease yield primary)
  warehouse:         { comps: 0.35, income: 0.65 },  // strongly income-driven
  land_agricultural: { comps: 0.88, income: 0.12 },  // almost pure comps — hard to yield
  land_industrial:   { comps: 0.65, income: 0.35 },
  project:           { comps: 0.60, income: 0.40 },
};

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
//    Standard reference: 60-100m² for buildings, 100-500m² for land
//    NOTE: For land types, larger area → lower per-m² (harder to liquidate)
// ─────────────────────────────────────────────────────────────────────────────
function getKa(area: number, propertyType?: PropertyType): { value: number; label: string; description: string } {
  // ── Đặc biệt cho đất: diện tích lớn → giảm thanh khoản → Ka < 1.0 ─────────
  if (propertyType?.startsWith('land_')) {
    if (area < 50) return {
      value: 1.05,
      label: `Đất nhỏ ${area}m²`,
      description: 'Đất < 50m² nội đô — đắt/m² do khan hiếm, tiện phân lô',
    };
    if (area < 200) return {
      value: 1.00,
      label: `Đất chuẩn ${area}m²`,
      description: 'Diện tích đất chuẩn tham chiếu 50-200m² — thanh khoản tốt',
    };
    if (area < 500) return {
      value: 0.97,
      label: `Đất vừa ${area}m²`,
      description: 'Đất 200-500m² — ít người mua tổng, thanh khoản giảm nhẹ (-3%)',
    };
    if (area < 2_000) return {
      value: 0.93,
      label: `Đất lớn ${area}m²`,
      description: 'Đất 500-2000m² — cần nhiều vốn, thường dành nhà phát triển (-7%)',
    };
    return {
      value: 0.88,
      label: `Đất rất lớn ${area}m²`,
      description: 'Đất ≥ 2000m² — phân lô/đầu tư, giảm giá/m² do ít người mua (-12%)',
    };
  }

  // ── Nhà ở / Thương mại: diện tích lớn hơn = cao hơn một chút ────────────
  if (area < 25) return {
    value: 0.90,
    label: `Siêu nhỏ ${area}m²`,
    description: 'Diện tích < 25m² — thị trường hạn chế, khó bán lại'
  };
  if (area < 40) return {
    value: 0.95,
    label: `Nhỏ ${area}m²`,
    description: 'Diện tích 25-40m² — phù hợp đầu tư cho thuê'
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
    label: `Rất rộng ${area}m²`,
    description: 'Diện tích ≥ 250m² — quý hiếm, tiềm năng phân lô hoặc xây cao tầng'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4a. Hệ số tầng (Kfl — Floor Level Coefficient) — for apartments only
//     Standard reference: floors 4-10
//     Source: CBRE Vietnam 2024, floor premium analysis
// ─────────────────────────────────────────────────────────────────────────────
export function getKfl(floorLevel: number, propertyType?: PropertyType): { value: number; label: string; description: string } | null {
  // Apply for apartments and penthouse
  const isApartment = !propertyType || propertyType.startsWith('apartment') || propertyType === 'penthouse';
  if (!isApartment) return null;

  if (floorLevel <= 1) return {
    value: 0.88,
    label: `Tầng trệt`,
    description: 'Tầng trệt căn hộ — ít riêng tư, ồn ào, dễ ngập (-12%)'
  };
  if (floorLevel <= 3) return {
    value: 0.93,
    label: `Tầng thấp (${floorLevel})`,
    description: 'Tầng 2-3 — có thể ảnh hưởng bởi tiếng ồn và ít view (-7%)'
  };
  if (floorLevel <= 10) return {
    value: 1.00,
    label: `Tầng trung (${floorLevel})`,
    description: 'Tầng 4-10 — chuẩn tham chiếu, cân bằng view và giá cả'
  };
  if (floorLevel <= 20) return {
    value: 1.05,
    label: `Tầng cao (${floorLevel})`,
    description: 'Tầng 11-20 — view đẹp, thoáng mát (+5%)'
  };
  if (floorLevel <= 30) return {
    value: 1.09,
    label: `Tầng rất cao (${floorLevel})`,
    description: 'Tầng 21-30 — view toàn cảnh, penthouse range (+9%)'
  };
  return {
    value: 1.12,
    label: `Penthouse / Tầng thượng (${floorLevel})`,
    description: 'Tầng 31+ — premium penthouse, view độc quyền (+12%)'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. Hệ số hướng nhà (Kdir — Building Direction Coefficient)
//     Standard reference: Đông (East)
//     Source: Feng shui + climate studies in VN; South-facing commands premium
// ─────────────────────────────────────────────────────────────────────────────
export function getKdir(direction: string): { value: number; label: string; description: string } | null {
  if (!direction) return null;
  const d = direction.toUpperCase().trim();
  const map: Record<string, { value: number; label: string; description: string }> = {
    'S':  { value: 1.05, label: 'Hướng Nam', description: 'Mát mẻ quanh năm, phong thủy tốt (+5%)' },
    'SE': { value: 1.04, label: 'Hướng Đông Nam', description: 'Đón nắng sáng, thoáng gió (+4%)' },
    'E':  { value: 1.00, label: 'Hướng Đông', description: 'Đón nắng sáng sớm — chuẩn tham chiếu' },
    'NE': { value: 0.98, label: 'Hướng Đông Bắc', description: 'Đón nắng sáng, hơi lạnh về mùa đông (-2%)' },
    'N':  { value: 0.96, label: 'Hướng Bắc', description: 'Ít nắng, tối và lạnh (-4%)' },
    'NW': { value: 0.97, label: 'Hướng Tây Bắc', description: 'Chiều nắng tây, nóng (-3%)' },
    'W':  { value: 0.95, label: 'Hướng Tây', description: 'Nắng chiều tây rất nóng — kém nhất (-5%)' },
    'SW': { value: 0.97, label: 'Hướng Tây Nam', description: 'Nắng chiều, hơi nóng (-3%)' },
    // Vietnamese full names
    'NAM': { value: 1.05, label: 'Hướng Nam', description: 'Mát mẻ quanh năm, phong thủy tốt (+5%)' },
    'DONG NAM': { value: 1.04, label: 'Hướng Đông Nam', description: 'Đón nắng sáng, thoáng gió (+4%)' },
    'ĐÔNG NAM': { value: 1.04, label: 'Hướng Đông Nam', description: 'Đón nắng sáng, thoáng gió (+4%)' },
    'DONG': { value: 1.00, label: 'Hướng Đông', description: 'Đón nắng sáng sớm — chuẩn tham chiếu' },
    'ĐÔNG': { value: 1.00, label: 'Hướng Đông', description: 'Đón nắng sáng sớm — chuẩn tham chiếu' },
    'BAC': { value: 0.96, label: 'Hướng Bắc', description: 'Ít nắng, tối và lạnh (-4%)' },
    'BẮC': { value: 0.96, label: 'Hướng Bắc', description: 'Ít nắng, tối và lạnh (-4%)' },
    'TAY': { value: 0.95, label: 'Hướng Tây', description: 'Nắng chiều tây rất nóng (-5%)' },
    'TÂY': { value: 0.95, label: 'Hướng Tây', description: 'Nắng chiều tây rất nóng (-5%)' },
  };
  return map[d] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4c. Hệ số mặt tiền (Kmf — Frontage Width Coefficient)
//     Standard reference: 4m frontage (mặt tiền chuẩn)
//     Applies primarily to townhouses, shophouses, land (not apartments)
// ─────────────────────────────────────────────────────────────────────────────
export function getKmf(frontageWidth: number, propertyType?: PropertyType): { value: number; label: string; description: string } | null {
  // Not applicable for apartments, penthouse, warehouse, or pure land (uses Kfl instead)
  if (propertyType?.startsWith('apartment') || propertyType === 'penthouse' ||
      propertyType === 'warehouse' || propertyType?.startsWith('land_')) return null;
  if (!frontageWidth || frontageWidth <= 0) return null;

  if (frontageWidth >= 10) return {
    value: 1.20,
    label: `Mặt tiền siêu rộng ${frontageWidth}m`,
    description: 'Mặt tiền ≥ 10m — lý tưởng cho thương mại, rất hiếm (+20%)'
  };
  if (frontageWidth >= 7) return {
    value: 1.12,
    label: `Mặt tiền rộng ${frontageWidth}m`,
    description: 'Mặt tiền 7-10m — thuận lợi kinh doanh, showroom (+12%)'
  };
  if (frontageWidth >= 5) return {
    value: 1.06,
    label: `Mặt tiền đẹp ${frontageWidth}m`,
    description: 'Mặt tiền 5-7m — chuẩn nhà phố thương mại (+6%)'
  };
  if (frontageWidth >= 4) return {
    value: 1.00,
    label: `Mặt tiền chuẩn ${frontageWidth}m`,
    description: 'Mặt tiền 4-5m — chuẩn tham chiếu thị trường'
  };
  if (frontageWidth >= 3) return {
    value: 0.96,
    label: `Mặt tiền hẹp ${frontageWidth}m`,
    description: 'Mặt tiền 3-4m — hơi chật, khó cải tạo mặt tiền (-4%)'
  };
  return {
    value: 0.92,
    label: `Mặt tiền rất hẹp ${frontageWidth}m`,
    description: 'Mặt tiền < 3m — hẹp, hạn chế khai thác thương mại (-8%)'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4d. Hệ số nội thất (Kfurn — Furnishing Coefficient)
//     Standard reference: BASIC (nội thất cơ bản)
// ─────────────────────────────────────────────────────────────────────────────
export function getKfurn(furnishing: 'FULL' | 'BASIC' | 'NONE' | undefined): { value: number; label: string; description: string } | null {
  if (!furnishing) return null;
  switch (furnishing) {
    case 'FULL': return {
      value: 1.07,
      label: 'Nội thất cao cấp đầy đủ',
      description: 'Full nội thất cao cấp — vào ở ngay, giá trị thêm +7%'
    };
    case 'BASIC': return {
      value: 1.00,
      label: 'Nội thất cơ bản',
      description: 'Nội thất cơ bản — chuẩn tham chiếu thị trường'
    };
    case 'NONE': return {
      value: 0.95,
      label: 'Không có nội thất (nhà thô)',
      description: 'Nhà thô — người mua tự hoàn thiện, giảm 5% so với chuẩn'
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4e. Hệ số tuổi/tình trạng (Kage — Building Age/Condition Coefficient)
//     Standard reference: 0-5 years (mới xây)
//     Source: Vietnamese depreciation standards, SXD HCM guidelines
// ─────────────────────────────────────────────────────────────────────────────
export function getKage(buildingAge: number | undefined, propertyType?: PropertyType): { value: number; label: string; description: string } | null {
  if (buildingAge === undefined || buildingAge < 0) return null;
  if (propertyType?.startsWith('land')) return null;

  if (buildingAge <= 2) return {
    value: 1.05,
    label: `Mới xây (${buildingAge} năm)`,
    description: 'Nhà mới xây 0-2 năm — chất lượng tốt nhất, giá premium (+5%)'
  };
  if (buildingAge <= 5) return {
    value: 1.00,
    label: `Nhà mới (${buildingAge} năm)`,
    description: 'Nhà 3-5 năm — chuẩn tham chiếu thị trường'
  };
  if (buildingAge <= 10) return {
    value: 0.96,
    label: `Nhà đã qua sử dụng (${buildingAge} năm)`,
    description: 'Nhà 6-10 năm — bắt đầu xuống cấp nhẹ, cần bảo trì (-4%)'
  };
  if (buildingAge <= 20) return {
    value: 0.90,
    label: `Nhà cũ (${buildingAge} năm)`,
    description: 'Nhà 11-20 năm — cần sửa chữa lớn, khấu hao đáng kể (-10%)'
  };
  if (buildingAge <= 30) return {
    value: 0.82,
    label: `Nhà rất cũ (${buildingAge} năm)`,
    description: 'Nhà 21-30 năm — khấu hao nặng, có thể cần xây lại (-18%)'
  };
  return {
    value: 0.70,
    label: `Nhà xuống cấp (${buildingAge} năm)`,
    description: 'Nhà trên 30 năm — giá trị chủ yếu ở đất, công trình gần hết hạn sử dụng (-30%)'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4f. Hệ số số phòng ngủ (Kbr — Bedroom Count Coefficient)
//     Standard reference: 2 phòng ngủ (phổ biến nhất, thanh khoản cao nhất)
//     Chỉ áp dụng với căn hộ/penthouse — không áp dụng cho nhà phố, đất, kho.
//     Source: Batdongsan transaction data Q1/2026, Savills Vietnam Apartment Market
// ─────────────────────────────────────────────────────────────────────────────
export function getKbr(bedrooms: number | undefined, propertyType?: PropertyType): { value: number; label: string; description: string } | null {
  // Only applies to apartment-type properties
  if (bedrooms === undefined || bedrooms === null) return null;
  const pType = propertyType || '';
  if (!pType.startsWith('apartment') && pType !== 'penthouse' && pType !== 'project') return null;

  if (bedrooms === 0) return {
    value: 0.95,
    label: 'Studio (không phòng ngủ)',
    description: 'Studio: thanh khoản thấp hơn, nhu cầu gia đình giới hạn — -5% vs 2PN chuẩn'
  };
  if (bedrooms === 1) return {
    value: 0.98,
    label: '1 Phòng ngủ',
    description: '1PN: phổ biến với nhà đầu tư nhỏ, thấp hơn 2PN chuẩn (-2%)'
  };
  if (bedrooms === 2) return {
    value: 1.00,
    label: '2 Phòng ngủ (chuẩn)',
    description: '2PN: loại phòng ngủ tham chiếu thị trường — thanh khoản và nhu cầu cao nhất'
  };
  if (bedrooms === 3) return {
    value: 1.05,
    label: '3 Phòng ngủ',
    description: '3PN: căn gia đình cao cấp, khan hiếm hơn, nhu cầu cao từ hộ đa thế hệ (+5%)'
  };
  return {
    value: 1.10,
    label: `${bedrooms} Phòng ngủ (cao cấp)`,
    description: `${bedrooms}PN: căn hạng sang/penthouse gia đình, premium cao nhất phân khúc (+10%)`
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-source price blending
// Combines: AI market research + internal DB comps + cached market index
// Returns blended price/m² and source breakdown
// ─────────────────────────────────────────────────────────────────────────────
export function computeBlendedBasePrice(params: {
  aiPrice: number;
  aiConfidence: number;
  internalCompsMedian?: number;
  internalCompsCount?: number;
  cachedMarketPrice?: number;
  cachedConfidence?: number;
}): { blendedPrice: number; confidenceBoost: number; sources: ValuationSources } {
  const { aiPrice, aiConfidence, internalCompsMedian, internalCompsCount = 0, cachedMarketPrice, cachedConfidence = 0 } = params;

  // Determine weights based on data availability and quality
  // AI is always present; internal comps and cache are bonuses
  let wAi = 1.0;
  let wInternal = 0.0;
  let wCached = 0.0;

  // Internal comps contribution: increases with sample count
  if (internalCompsMedian && internalCompsMedian > 0 && internalCompsCount > 0) {
    if (internalCompsCount >= 10) wInternal = 0.40;       // Strong comps dataset → 40%
    else if (internalCompsCount >= 5) wInternal = 0.25;   // Moderate dataset → 25%
    else if (internalCompsCount >= 2) wInternal = 0.12;   // Few comps → 12%
  }

  // Cached market data contribution
  if (cachedMarketPrice && cachedMarketPrice > 0 && cachedConfidence >= 50) {
    wCached = 0.15 * (cachedConfidence / 100);  // Scale by cache confidence
  }

  // Normalize weights to sum to 1.0
  const total = wAi + wInternal + wCached;
  wAi /= total;
  wInternal /= total;
  wCached /= total;

  const blendedPrice = Math.round(
    aiPrice * wAi +
    (internalCompsMedian || aiPrice) * wInternal +
    (cachedMarketPrice || aiPrice) * wCached
  );

  // Confidence boost: multiple sources agreeing increases confidence
  const aiVsInternal = internalCompsMedian ? Math.abs(aiPrice - internalCompsMedian) / aiPrice : 1;
  const aiVsCached = cachedMarketPrice ? Math.abs(aiPrice - cachedMarketPrice) / aiPrice : 1;
  const sourceDivergence = Math.min(aiVsInternal, aiVsCached, 1);

  // Boost = 0 to 12 points based on agreement between sources
  const sourcesUsed = (wInternal > 0 ? 1 : 0) + (wCached > 0 ? 1 : 0);
  const agreementBonus = sourcesUsed * Math.max(0, 1 - sourceDivergence * 3) * 6;
  const confidenceBoost = Math.round(Math.min(12, agreementBonus));

  return {
    blendedPrice,
    confidenceBoost,
    sources: {
      aiPrice,
      aiWeight: Math.round(wAi * 100) / 100,
      internalCompsPrice: internalCompsMedian || 0,
      internalCompsCount,
      internalCompsWeight: Math.round(wInternal * 100) / 100,
      cachedPrice: cachedMarketPrice || 0,
      cachedWeight: Math.round(wCached * 100) / 100,
      blendedPrice,
      confidenceBoost,
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Confidence Interval Margin
// ─────────────────────────────────────────────────────────────────────────────
function getConfidenceMargin(confidence: number): number {
  if (confidence >= 95) return 0.05;  // ±5% for high-confidence AI-grounded data
  if (confidence >= 88) return 0.07;
  if (confidence >= 78) return 0.10;
  if (confidence >= 68) return 0.14;
  if (confidence >= 55) return 0.18;
  return 0.25;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-specific operating expense rates (% of gross annual income)
// Vietnamese market context:
//   Residential: quản lý phí thường do tenant trả → chủ sở hữu chỉ chịu thuế + bảo hiểm (~8-10%)
//   Thương mại:  utilities + maintenance + management on owner → 18-22%
//   Đất:         thuế đất duy nhất → 3-5%
// ─────────────────────────────────────────────────────────────────────────────
const OPEX_RATES_BY_TYPE: Partial<Record<PropertyType, number>> = {
  apartment_center:  0.09,   // Thuế + bảo hiểm + quản lý (phần chủ chịu)
  apartment_suburb:  0.09,
  townhouse_center:  0.10,
  townhouse_suburb:  0.10,
  villa:             0.10,
  penthouse:         0.08,   // Penthouse: low maintenance, high-grade materials
  project:           0.09,
  shophouse:         0.18,   // Thương mại: utilities/maintenance on owner
  office:            0.22,   // VP: cao nhất — HVAC, cleaning, management
  warehouse:         0.12,   // Kho: bảo hiểm + bảo trì kết cấu
  land_urban:        0.04,   // Thuế đất thổ cư
  land_suburban:     0.04,
  land_agricultural: 0.02,   // Thuế đất nông nghiệp tối thiểu
  land_industrial:   0.06,
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Income Capitalization Engine
//    Vietnamese market: "tỷ suất cho thuê" = gross yield (annual gross rent / value)
//    → capitalValue = grossIncome / grossYieldCap  (matches market convention)
//    NOI & payback still calculated for transparency / professional reports.
// ─────────────────────────────────────────────────────────────────────────────
function applyIncomeApproach(
  monthlyRent: number,       // triệu VNĐ/tháng
  totalPrice: number,        // VNĐ (comps value — used to compute gross yield %)
  propertyType: PropertyType,
  vacancyRate = DEFAULT_VACANCY_RATE,
  opexRate?: number,         // if undefined → uses OPEX_RATES_BY_TYPE
  capRateAdj = 0,            // dynamic adjustment: negative = lower cap (higher value)
): IncomeApproachResult {
  // Clamp rates to valid ranges [0, 1]
  const safeVacancyRate = Math.min(1, Math.max(0, vacancyRate));
  // Use type-specific opex rate (more accurate than single DEFAULT_OPEX_RATE)
  const resolvedOpexRate = opexRate !== undefined
    ? opexRate
    : (OPEX_RATES_BY_TYPE[propertyType] ?? DEFAULT_OPEX_RATE);
  const safeOpexRate = Math.min(1, Math.max(0, resolvedOpexRate));

  const baseCapRate = DEFAULT_CAP_RATES[propertyType];
  // Apply trend-based adjustment, clamp to sensible range [1.5%, 12%]
  const capRate = Math.min(0.12, Math.max(0.015, baseCapRate + capRateAdj));

  const grossIncomeTrieu = monthlyRent * 12;                       // triệu/năm
  const vacancyLossTrieu = grossIncomeTrieu * safeVacancyRate;
  const effectiveIncomeTrieu = grossIncomeTrieu * (1 - safeVacancyRate);
  const opexTrieu = grossIncomeTrieu * safeOpexRate;               // opex on gross (VN standard)
  const noiTrieu = Math.max(0, effectiveIncomeTrieu - opexTrieu);  // NOI for display

  // ── Capital value: GROSS INCOME / gross yield cap ──────────────────────────
  // Aligned with Vietnamese market convention: gross yield = gross rent / value.
  // This is more accurate than NOI/cap for residential where management fees
  // are paid by tenant (lower effective owner cost than gross opex implies).
  const grossIncomeVND = grossIncomeTrieu * 1_000_000;
  const safeCapRate = capRate > 0 ? capRate : DEFAULT_CAP_RATE;
  const capitalValue = Math.max(0, Math.round(grossIncomeVND / safeCapRate));

  const grossRentalYield = totalPrice > 0
    ? grossIncomeVND / totalPrice * 100
    : 0;
  const paybackYears = grossIncomeTrieu > 0
    ? (capitalValue / 1_000_000) / grossIncomeTrieu
    : 0;

  return {
    monthlyRent,
    grossIncome: grossIncomeTrieu,
    vacancyLoss: vacancyLossTrieu,
    effectiveIncome: effectiveIncomeTrieu,
    opex: opexTrieu,
    noi: noiTrieu,
    capRate,
    capitalValue,
    grossRentalYield,
    paybackYears,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. MAIN AVM + RECONCILIATION ENGINE (v3 — multi-source, 7 coefficients)
// ─────────────────────────────────────────────────────────────────────────────
export function applyAVM(input: AVMInput): AVMOutput {
  const {
    marketBasePrice, area, roadWidth, legal, confidence, marketTrend, propertyType, monthlyRent,
    floorLevel, direction, frontageWidth, furnishing, buildingAge, bedrooms,
    internalCompsMedian, internalCompsCount, cachedMarketPrice, cachedConfidence,
  } = input;

  // ── Multi-source blending: determine actual base price ────────
  let effectiveBasePrice = marketBasePrice;
  let effectiveConfidence = confidence;
  let sources: ValuationSources | undefined;

  if (internalCompsMedian || cachedMarketPrice) {
    const blended = computeBlendedBasePrice({
      aiPrice: marketBasePrice,
      aiConfidence: confidence,
      internalCompsMedian,
      internalCompsCount,
      cachedMarketPrice,
      cachedConfidence,
    });
    effectiveBasePrice = blended.blendedPrice;
    effectiveConfidence = Math.min(100, confidence + blended.confidenceBoost);
    sources = blended.sources;
  }

  // ── Resolve property type early (used by multiple coefficient functions) ────
  const pType = propertyType || 'townhouse_center';

  // ── Core coefficients ─────────────────────────────────────────
  const Kd_data = getKd(roadWidth);
  const Kp_data = getKp(legal);
  const Ka_data = getKa(area, pType);

  // For apartments & penthouse: road width affects value INDIRECTLY (building entrance, not direct frontage)
  // Cap Kd at 1.10 (+10%) — full +30% for đại lộ only applies to nhà phố/shophouse/land facing the road directly.
  const isApartmentType = pType === 'apartment_center' || pType === 'apartment_suburb' || pType === 'penthouse';
  const Kd = isApartmentType ? Math.min(1.10, Kd_data.value) : Kd_data.value;
  const Kp = Kp_data.value;
  const Ka = Ka_data.value;

  // ── Optional coefficients ─────────────────────────────────────
  const Kfl_data = (floorLevel !== undefined && floorLevel > 0) ? getKfl(floorLevel, pType) : null;
  const Kdir_data = direction ? getKdir(direction) : null;
  const Kmf_data = (frontageWidth !== undefined && frontageWidth > 0) ? getKmf(frontageWidth, pType) : null;
  const Kfurn_data = furnishing ? getKfurn(furnishing) : null;
  const Kage_data = (buildingAge !== undefined) ? getKage(buildingAge, pType) : null;
  const Kbr_data = (bedrooms !== undefined) ? getKbr(bedrooms, pType) : null;

  const Kfl = Kfl_data?.value ?? 1.0;
  const Kdir = Kdir_data?.value ?? 1.0;
  const Kmf = Kmf_data?.value ?? 1.0;
  const Kfurn = Kfurn_data?.value ?? 1.0;
  const Kage = Kage_data?.value ?? 1.0;
  const Kbr = Kbr_data?.value ?? 1.0;

  // ── Method 1: AVM/Comps ────────────────────────────────────────
  const safeArea = Math.max(1, area);
  const safeMarketBase = Math.max(0, effectiveBasePrice);
  const rawPricePerM2 = safeMarketBase * Kd * Kp * Ka * Kfl * Kdir * Kmf * Kfurn * Kage * Kbr;
  const pricePerM2 = Math.max(0, Math.round(rawPricePerM2));
  const compsPrice = Math.max(0, Math.round(pricePerM2 * safeArea));

  // ── Method 2: Income Approach (if rent data available) ────────
  let incomeApproach: IncomeApproachResult | undefined;
  let reconciliation: AVMOutput['reconciliation'] | undefined;
  let totalPrice = compsPrice;

  if (monthlyRent && monthlyRent > 0) {
    // Dynamic cap rate: positive growth trend → investors accept lower yield → lower cap rate
    // Negative/stable trend → standard cap rate table
    const trendLower = (marketTrend || '').toLowerCase();
    const trendGrowthMatch = trendLower.match(/tăng\s+(\d+)/i) || trendLower.match(/(\d+)\s*%.*tăng/i);
    const trendGrowthPct = trendGrowthMatch ? parseInt(trendGrowthMatch[1], 10) : 0;
    const capRateAdj = trendGrowthPct >= 15 ? -0.005   // strong growth → lower cap −0.5%
                     : trendGrowthPct >= 8  ? -0.003   // moderate growth → −0.3%
                     : 0;                              // stable/declining → no adjustment

    incomeApproach = applyIncomeApproach(monthlyRent, compsPrice, pType, undefined, undefined, capRateAdj);

    // ── Method 3: Reconciliation ──────────────────────────────
    const weights = RECONCILE_WEIGHTS[pType];
    const finalValue = Math.round(
      compsPrice * weights.comps + incomeApproach.capitalValue * weights.income
    );
    reconciliation = {
      compsWeight: weights.comps,
      incomeWeight: weights.income,
      compsValue: compsPrice,
      incomeValue: incomeApproach.capitalValue,
      finalValue,
    };
    totalPrice = finalValue;
  }

  // ── Confidence Interval & Level ───────────────────────────────
  let finalConfidence = effectiveConfidence;

  // If income approach is available, check method divergence/convergence
  if (incomeApproach && compsPrice > 0 && incomeApproach.capitalValue > 0) {
    const methodDeviation = Math.abs(compsPrice - incomeApproach.capitalValue) / Math.max(compsPrice, incomeApproach.capitalValue);

    if (methodDeviation > 0.50) {
      // Extreme divergence >50% — income data is unreliable (bad rent estimate).
      // Switch to comps-dominant blend (95% comps, 5% income) to preserve accuracy.
      const conservativeValue = Math.round(compsPrice * 0.95 + incomeApproach.capitalValue * 0.05);
      if (reconciliation) {
        reconciliation = {
          ...reconciliation,
          compsWeight: 0.95,
          incomeWeight: 0.05,
          finalValue: conservativeValue,
        };
      }
      totalPrice = conservativeValue;
      // Honest penalty: 50%+ divergence = rental data unreliable, cap confidence at 82
      finalConfidence = Math.min(finalConfidence, 82);
    } else if (methodDeviation > 0.30) {
      // Moderate divergence 30-50% — cap at 88 (data partially inconsistent)
      finalConfidence = Math.min(finalConfidence, 88);
    } else if (methodDeviation <= 0.15) {
      // Methods agree within 15% — convergence bonus (data is consistent)
      finalConfidence = Math.min(100, finalConfidence + 2);
    }
  }

  const margin = getConfidenceMargin(finalConfidence);
  const rangeMin = Math.round(totalPrice * (1 - margin));
  const rangeMax = Math.round(totalPrice * (1 + margin));

  const confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
    finalConfidence >= 90 ? 'HIGH' :
    finalConfidence >= 70 ? 'MEDIUM' : 'LOW';
  const confidenceInterval = `±${Math.round(margin * 100)}%`;

  // ── Factors ───────────────────────────────────────────────────
  const factors: AVMFactor[] = [];

  factors.push({
    label: Kd_data.label, coefficient: Kd,
    impact: Math.abs(Math.round((Kd - 1.00) * 100)),
    isPositive: Kd >= 1.00, description: Kd_data.description, type: 'AVM'
  });
  factors.push({
    label: Kp_data.label, coefficient: Kp,
    impact: Math.abs(Math.round((Kp - 1.00) * 100)),
    isPositive: Kp >= 1.00, description: Kp_data.description, type: 'AVM'
  });
  factors.push({
    label: Ka_data.label, coefficient: Ka,
    impact: Math.abs(Math.round((Ka - 1.00) * 100)),
    isPositive: Ka >= 1.00, description: Ka_data.description, type: 'AVM'
  });

  if (Kfl_data) factors.push({
    label: Kfl_data.label, coefficient: Kfl,
    impact: Math.abs(Math.round((Kfl - 1.00) * 100)),
    isPositive: Kfl >= 1.00, description: Kfl_data.description, type: 'AVM'
  });
  if (Kdir_data) factors.push({
    label: Kdir_data.label, coefficient: Kdir,
    impact: Math.abs(Math.round((Kdir - 1.00) * 100)),
    isPositive: Kdir >= 1.00, description: Kdir_data.description, type: 'AVM'
  });
  if (Kmf_data) factors.push({
    label: Kmf_data.label, coefficient: Kmf,
    impact: Math.abs(Math.round((Kmf - 1.00) * 100)),
    isPositive: Kmf >= 1.00, description: Kmf_data.description, type: 'AVM'
  });
  if (Kfurn_data) factors.push({
    label: Kfurn_data.label, coefficient: Kfurn,
    impact: Math.abs(Math.round((Kfurn - 1.00) * 100)),
    isPositive: Kfurn >= 1.00, description: Kfurn_data.description, type: 'AVM'
  });
  if (Kage_data) factors.push({
    label: Kage_data.label, coefficient: Kage,
    impact: Math.abs(Math.round((Kage - 1.00) * 100)),
    isPositive: Kage >= 1.00, description: Kage_data.description, type: 'AVM'
  });
  if (Kbr_data) factors.push({
    label: Kbr_data.label, coefficient: Kbr,
    impact: Math.abs(Math.round((Kbr - 1.00) * 100)),
    isPositive: Kbr >= 1.00, description: Kbr_data.description, type: 'AVM'
  });

  // Multi-source factor
  if (sources && sources.confidenceBoost > 0) {
    const srcParts: string[] = [];
    if (sources.internalCompsCount > 0) srcParts.push(`${sources.internalCompsCount} BĐS tương đồng nội bộ`);
    if (sources.cachedPrice > 0) srcParts.push('dữ liệu thị trường cache');
    factors.push({
      label: `Đa nguồn dữ liệu (${srcParts.join(' + ')})`,
      coefficient: sources.blendedPrice / (sources.aiPrice || 1),
      impact: sources.confidenceBoost,
      isPositive: true,
      description: `Blended: AI ${Math.round(sources.aiWeight * 100)}% + Nội bộ ${Math.round(sources.internalCompsWeight * 100)}% + Cache ${Math.round(sources.cachedWeight * 100)}%`,
      type: 'MULTI_SOURCE'
    });
  }

  // Build formula string showing all active coefficients
  const activeCoeffs: string[] = [`Kd(${Kd})`];
  activeCoeffs.push(`Kp(${Kp})`);
  activeCoeffs.push(`Ka(${Ka})`);
  if (Kfl !== 1.0) activeCoeffs.push(`Kfl(${Kfl})`);
  if (Kdir !== 1.0) activeCoeffs.push(`Kdir(${Kdir})`);
  if (Kmf !== 1.0) activeCoeffs.push(`Kmf(${Kmf})`);
  if (Kfurn !== 1.0) activeCoeffs.push(`Kfurn(${Kfurn})`);
  if (Kage !== 1.0) activeCoeffs.push(`Kage(${Kage})`);
  if (Kbr !== 1.0) activeCoeffs.push(`Kbr(${Kbr})`);
  let formula = `${(effectiveBasePrice / 1_000_000).toFixed(0)} tr/m² × ${activeCoeffs.join(' × ')} = ${(pricePerM2 / 1_000_000).toFixed(0)} tr/m²`;
  if (reconciliation) {
    formula += ` → Hòa giải: Comps(${(reconciliation.compsWeight * 100).toFixed(0)}%) + Thu nhập(${(reconciliation.incomeWeight * 100).toFixed(0)}%) = ${(totalPrice / 1e9).toFixed(2)} Tỷ`;
  }

  return {
    marketBasePrice: effectiveBasePrice,
    pricePerM2,
    totalPrice,
    compsPrice,
    rangeMin,
    rangeMax,
    confidence: finalConfidence,
    confidenceLevel,
    confidenceInterval,
    marketTrend,
    factors,
    coefficients: { Kd, Kp, Ka, ...(Kfl_data && { Kfl }), ...(Kdir_data && { Kdir }), ...(Kmf_data && { Kmf }), ...(Kfurn_data && { Kfurn }), ...(Kage_data && { Kage }), ...(Kbr_data && { Kbr }) },
    formula,
    incomeApproach,
    reconciliation,
    sources,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. REGIONAL BASE PRICE TABLE (static fallback — no AI)
//    Unit: VNĐ/m² for TOWNHOUSE reference (Sổ Hồng, 4m road, 60-100m²)
//    Property-type multipliers applied to derive type-specific sanity ranges.
// ─────────────────────────────────────────────────────────────────────────────

// Multipliers relative to townhouse reference price (townhouse_center = 1.00)
// Applied ONLY to regional fallback table and sanity-check bounds — NOT to AI-returned prices.
// Source: Batdongsan/Savills/CBRE Vietnam Q1/2026 cross-type transaction analysis
// ─────────────────────────────────────────────────────────────────────────────
// Calibration notes:
//  apartment_center: 0.52 → Q.Bình Thạnh: 120M × 0.52 = 62M/m² (Vinhomes thực tế 65-95M) ✓
//  penthouse:        0.78 → Q.Bình Thạnh: 120M × 0.78 = 94M/m² (Vinhomes PH ~100-180M) ✓
//  project:          0.85 → off-plan chiết khấu 15% vs thứ cấp (thị trường VN Q1/2026: 8-15%)
// ─────────────────────────────────────────────────────────────────────────────
export const PROPERTY_TYPE_PRICE_MULT: Record<string, number> = {
  apartment_center:  0.55,  // Căn hộ nội đô: ~55% nhà phố (thực tế 60-85M/m² vs 120M/m² nhà phố Q.BT — Q1/2026)
  apartment_suburb:  0.50,  // Căn hộ ngoại thành/trung cấp: ~50% (tăng từ 0.48 — CPI bất động sản +8% 2024)
  townhouse_center:  1.00,  // Tham chiếu chuẩn — nhà phố nội đô Sổ Hồng, hẻm 4m
  townhouse_suburb:  1.00,  // Nhà phố ngoại thành — tương đương mức cơ sở
  villa:             0.85,  // Biệt thự: thấp hơn/m² vì DT lớn, ít giao dịch
  shophouse:         1.25,  // Shophouse: premium thương mại cao nhất phân khúc nhà phố
  land_urban:        1.30,  // Đất thổ cư nội đô: premium (không khấu hao công trình)
  land_suburban:     1.00,  // Đất thổ cư ngoại thành: tương đương nhà phố (giá đất thuần)
  penthouse:         0.78,  // Penthouse: ~78% nhà phố/m² (Vinhomes PH ~100-180M/m²) + Kfl boost
  office:            0.75,  // Văn phòng: 75% nhà phố (CBD B-class ~50-80M/m²)
  warehouse:         0.18,  // Kho xưởng RBW: 18% nhà phố — Bình Dương ~3-8M/m² (Savills 2024)
  land_agricultural: 0.05,  // Đất nông nghiệp: rất rẻ, chủ yếu đầu cơ chuyển đổi
  land_industrial:   0.28,  // Đất KCN: ~200-600 USD/m² → 5-15M VNĐ/m²
  project:           0.85,  // Căn hộ off-plan: chiết khấu ~15% vs thứ cấp (thị trường VN Q1/2026: 8-15%)
};

export function getRegionalBasePrice(address: string, pType?: string): {
  price: number;
  region: string;
  confidence: number;
} {
  const addr = address.toLowerCase();

  // ── District inference from well-known projects/streets ──────────────────
  // Ensures addresses like "Vinhome Central Park" match the correct district
  // even without explicit district name in the input.
  const PROJECT_DISTRICT_INFER: [RegExp, string][] = [
    [/vinhome[s]?\s*central\s*park|saigon\s*pearl|landmark\s*81|pearl\s*plaza|city\s*garden|nguyễn hữu cảnh|nguyen huu canh|ung văn khiêm|ung van khiem|xô viết nghệ tĩnh|xo viet nghe tinh|điện biên phủ.*bình thạnh/i, 'bình thạnh'],
    [/masteri\s*thảo\s*điền|masteri\s*thao\s*dien|sala|thảo điền|thao dien|an phú|an phu|feliz|estella|the vista|xa lộ hà nội|xa lo ha noi/i, 'thủ đức'],
    [/phú mỹ hưng|phu my hung|midtown|scenic\s*valley|riviera\s*point|sunrise|crescent|star\s*hill|happy\s*valley|nam viên|nam vien/i, 'quận 7'],
    [/vinhome[s]?\s*grand\s*park|vinhome[s]?\s*q9|vinhome[s]?\s*quận 9|the\s*rainbow/i, 'quận 9'],
    [/vinhome[s]?\s*golden\s*river|vinhome[s]?\s*bason|ba son|sài gòn.*quận 1|the\s*marq/i, 'quận 1'],
    [/vinhome[s]?\s*ocean\s*park|ocean\s*park/i, 'gia lâm'],
    [/vinhome[s]?\s*smart\s*city|smart\s*city/i, 'nam từ liêm'],
    [/ecopark/i, 'hưng yên'],
    [/celadon\s*city|aeon\s*tân phú|aeon\s*tan phu/i, 'tân phú'],
    [/richstar|novaland\s*tân phú/i, 'tân phú'],
    [/sunwah\s*pearl/i, 'bình thạnh'],
    // ── Vùng ven / Tỉnh lân cận ──────────────────────────────────────────────
    [/aqua\s*city|aquacity|aqua\s*island/i, 'nhơn trạch'],
    [/swan\s*park/i, 'nhơn trạch'],
    [/izumi\s*city/i, 'biên hòa'],
    [/waterpoint/i, 'bến lức'],
    [/la\s*mer|phu quoc\s*marina|premier\s*village/i, 'phú quốc'],
    [/novaworld\s*phan\s*thiet|novabeach|nova\s*phan\s*thiet/i, 'phan thiết'],
    [/golden\s*bay\s*cam\s*ranh|cam\s*ranh/i, 'khánh hòa'],
  ];
  let enrichedAddr = addr;
  for (const [regex, district] of PROJECT_DISTRICT_INFER) {
    if (regex.test(addr) && !addr.includes(district)) {
      enrichedAddr = `${addr}, ${district}`;
      break;
    }
  }

  // ── Street/corridor-level premium overrides (highest precision) ───────────
  // These trump the district-level table when matched
  let streetOverride: number | null = null;
  if (/nguyễn huệ|le loi|lê lợi|dong khoi|đồng khởi/i.test(enrichedAddr) && /quận 1|q\.?1/i.test(enrichedAddr))
    streetOverride = 450_000_000;
  if (/vinhome[s]?\s*central\s*park|saigon\s*pearl/i.test(enrichedAddr))
    streetOverride = 140_000_000;
  if (/phú mỹ hưng|phu my hung/i.test(enrichedAddr))
    streetOverride = 160_000_000;
  if (/thảo điền|thao dien/i.test(enrichedAddr))
    streetOverride = 180_000_000;
  if (/vinhome[s]?\s*golden\s*river|vinhome[s]?\s*bason|ba son/i.test(enrichedAddr))
    streetOverride = 250_000_000;
  if (/landmark\s*81/i.test(enrichedAddr))
    streetOverride = 160_000_000;
  // ── Premium projects vùng ven / tỉnh lân cận ─────────────────────────────
  // Source: Batdongsan/Savills/OneHousing Q1/2026 transaction data
  if (/aqua\s*city|aquacity/i.test(enrichedAddr))
    streetOverride = 72_000_000;  // Aqua City Novaland nhà phố liên kề: 65-95M/m² Q1/2026
  if (/swan\s*park/i.test(enrichedAddr))
    streetOverride = 52_000_000;  // Swan Park Novaland Nhơn Trạch: 45-65M/m²
  if (/izumi\s*city/i.test(enrichedAddr))
    streetOverride = 55_000_000;  // Izumi City Nam Long Biên Hòa: 45-65M/m²
  if (/waterpoint.*bến\s*lức|bến\s*lức.*waterpoint/i.test(enrichedAddr))
    streetOverride = 45_000_000;  // Waterpoint Nam Long Bến Lức: 35-55M/m²
  if (/novaworld\s*phan\s*thiet|phan\s*thiet.*novaworld/i.test(enrichedAddr))
    streetOverride = 40_000_000;  // NovaWorld Phan Thiết biệt thự/nhà phố: 35-55M/m²

  // Apply street override if matched
  const getBase = (base: number, region: string, conf: number) => {
    const refPrice = streetOverride ?? base;
    const mult = PROPERTY_TYPE_PRICE_MULT[pType || 'townhouse_center'] ?? 1.00;
    return { price: Math.round(refPrice * mult), region, confidence: conf };
  };

  // ── TP.HCM ────────────────────────────────────────────────────────────────
  if (/quận 1\b|q\.?1\b|district 1/i.test(enrichedAddr)) return getBase(280_000_000, 'Quận 1, TP.HCM', 62);
  if (/quận 3\b|q\.?3\b/i.test(enrichedAddr))             return getBase(200_000_000, 'Quận 3, TP.HCM', 62);
  if (/quận 4\b|q\.?4\b/i.test(enrichedAddr))             return getBase(130_000_000, 'Quận 4, TP.HCM', 62);
  if (/quận 5\b|q\.?5\b/i.test(enrichedAddr))             return getBase(140_000_000, 'Quận 5, TP.HCM', 62);
  if (/quận 6\b|q\.?6\b/i.test(enrichedAddr))             return getBase(90_000_000,  'Quận 6, TP.HCM', 60);
  if (/quận 7\b|q\.?7\b/i.test(enrichedAddr))             return getBase(150_000_000, 'Quận 7, TP.HCM', 62);
  if (/quận 8\b|q\.?8\b/i.test(enrichedAddr))             return getBase(80_000_000,  'Quận 8, TP.HCM', 60);
  if (/quận 9\b|q\.?9\b/i.test(enrichedAddr))             return getBase(75_000_000,  'Quận 9, TP.HCM', 60);
  if (/quận 10\b|q\.?10\b/i.test(enrichedAddr))           return getBase(165_000_000, 'Quận 10, TP.HCM', 62);
  if (/quận 11\b|q\.?11\b/i.test(enrichedAddr))           return getBase(110_000_000, 'Quận 11, TP.HCM', 60);
  if (/quận 12\b|q\.?12\b/i.test(enrichedAddr))           return getBase(65_000_000,  'Quận 12, TP.HCM', 60);
  if (/bình chánh|binh chanh/i.test(enrichedAddr))        return getBase(35_000_000,  'Bình Chánh, TP.HCM', 55);
  if (/nhà bè|nha be/i.test(enrichedAddr))                return getBase(45_000_000,  'Nhà Bè, TP.HCM', 55);
  if (/hóc môn|hoc mon/i.test(enrichedAddr))              return getBase(40_000_000,  'Hóc Môn, TP.HCM', 55);
  if (/củ chi|cu chi/i.test(enrichedAddr))                return getBase(25_000_000,  'Củ Chi, TP.HCM', 52);
  if (/cần giờ|can gio/i.test(enrichedAddr))              return getBase(20_000_000,  'Cần Giờ, TP.HCM', 50);
  if (/bình thạnh|binh thanh/i.test(enrichedAddr))        return getBase(120_000_000, 'Bình Thạnh, TP.HCM', 62);
  if (/phú nhuận|phu nhuan/i.test(enrichedAddr))          return getBase(150_000_000, 'Phú Nhuận, TP.HCM', 62);
  if (/tân bình|tan binh/i.test(enrichedAddr))            return getBase(100_000_000, 'Tân Bình, TP.HCM', 62);
  if (/tân phú|tan phu/i.test(enrichedAddr))              return getBase(80_000_000,  'Tân Phú, TP.HCM', 60);
  if (/gò vấp|go vap/i.test(enrichedAddr))                return getBase(75_000_000,  'Gò Vấp, TP.HCM', 60);
  if (/thủ đức|thu duc/i.test(enrichedAddr))              return getBase(78_000_000,  'Thủ Đức, TP.HCM', 60);
  if (/hcm|hồ chí minh|ho chi minh|sài gòn|saigon/i.test(enrichedAddr)) return getBase(100_000_000, 'TP.HCM (trung bình)', 55);

  // ── Hà Nội ───────────────────────────────────────────────────────────────
  if (/hoàn kiếm|hoan kiem/i.test(enrichedAddr))           return getBase(300_000_000, 'Hoàn Kiếm, Hà Nội', 62);
  if (/ba đình|ba dinh/i.test(enrichedAddr))               return getBase(220_000_000, 'Ba Đình, Hà Nội', 62);
  if (/đống đa|dong da/i.test(enrichedAddr))               return getBase(180_000_000, 'Đống Đa, Hà Nội', 62);
  if (/hai bà trưng|hai ba trung/i.test(enrichedAddr))     return getBase(170_000_000, 'Hai Bà Trưng, Hà Nội', 62);
  if (/cầu giấy|cau giay/i.test(enrichedAddr))             return getBase(120_000_000, 'Cầu Giấy, Hà Nội', 60);
  if (/tây hồ|tay ho/i.test(enrichedAddr))                 return getBase(130_000_000, 'Tây Hồ, Hà Nội', 60);
  if (/thanh xuân|thanh xuan/i.test(enrichedAddr))         return getBase(100_000_000, 'Thanh Xuân, Hà Nội', 60);
  if (/hoàng mai|hoang mai/i.test(enrichedAddr))           return getBase(75_000_000,  'Hoàng Mai, Hà Nội', 58);
  if (/nam từ liêm|nam tu liem|bắc từ liêm|bac tu liem/i.test(enrichedAddr)) return getBase(85_000_000, 'Từ Liêm, Hà Nội', 58);
  if (/long biên|long bien/i.test(enrichedAddr))           return getBase(80_000_000,  'Long Biên, Hà Nội', 58);
  if (/hà đông|ha dong/i.test(enrichedAddr))               return getBase(70_000_000,  'Hà Đông, Hà Nội', 57);
  if (/gia lâm|gia lam/i.test(enrichedAddr))               return getBase(65_000_000,  'Gia Lâm, Hà Nội', 55);
  if (/đông anh|dong anh/i.test(enrichedAddr))             return getBase(60_000_000,  'Đông Anh, Hà Nội', 55);
  if (/hà nội|hanoi|ha noi/i.test(enrichedAddr))           return getBase(110_000_000, 'Hà Nội (trung bình)', 52);

  // ── Đà Nẵng (TP trực thuộc TW) ───────────────────────────────────────────
  if (/hải châu|hai chau/i.test(enrichedAddr))             return getBase(90_000_000,  'Hải Châu, Đà Nẵng', 60);
  if (/thanh khê|thanh khe/i.test(enrichedAddr))           return getBase(70_000_000,  'Thanh Khê, Đà Nẵng', 58);
  if (/sơn trà|son tra/i.test(enrichedAddr))               return getBase(75_000_000,  'Sơn Trà, Đà Nẵng', 58);
  if (/ngũ hành sơn|ngu hanh son/i.test(enrichedAddr))     return getBase(60_000_000,  'Ngũ Hành Sơn, Đà Nẵng', 57);
  if (/liên chiểu|lien chieu/i.test(enrichedAddr))         return getBase(55_000_000,  'Liên Chiểu, Đà Nẵng', 55);
  if (/đà nẵng|da nang/i.test(enrichedAddr))               return getBase(75_000_000,  'Đà Nẵng', 57);

  // ── Hải Phòng (TP trực thuộc TW) ────────────────────────────────────────
  if (/hồng bàng|hong bang/i.test(enrichedAddr))           return getBase(60_000_000,  'Hồng Bàng, Hải Phòng', 58);
  if (/ngô quyền|ngo quyen/i.test(enrichedAddr))           return getBase(55_000_000,  'Ngô Quyền, Hải Phòng', 57);
  if (/lê chân|le chan/i.test(enrichedAddr))               return getBase(50_000_000,  'Lê Chân, Hải Phòng', 57);
  if (/hải an|hai an/i.test(enrichedAddr))                 return getBase(38_000_000,  'Hải An, Hải Phòng', 55);
  if (/đồ sơn|do son/i.test(enrichedAddr))                 return getBase(40_000_000,  'Đồ Sơn, Hải Phòng', 53);
  if (/hải phòng|hai phong/i.test(enrichedAddr))           return getBase(50_000_000,  'Hải Phòng', 55);

  // ── Cần Thơ (TP trực thuộc TW) ───────────────────────────────────────────
  if (/ninh kiều|ninh kieu/i.test(enrichedAddr))           return getBase(42_000_000,  'Ninh Kiều, Cần Thơ', 57);
  if (/bình thuỷ|binh thuy/i.test(enrichedAddr))           return getBase(28_000_000,  'Bình Thuỷ, Cần Thơ', 53);
  if (/cần thơ|can tho/i.test(enrichedAddr))               return getBase(35_000_000,  'Cần Thơ', 53);

  // ── Khánh Hòa (Nha Trang) ────────────────────────────────────────────────
  if (/nha trang/i.test(enrichedAddr))                     return getBase(65_000_000,  'Nha Trang', 57);
  if (/cam ranh/i.test(enrichedAddr))                      return getBase(25_000_000,  'Cam Ranh, Khánh Hòa', 50);
  if (/ninh hòa|ninh hoa/i.test(enrichedAddr))             return getBase(15_000_000,  'Ninh Hòa, Khánh Hòa', 48);
  if (/khánh hòa|khanh hoa/i.test(enrichedAddr))           return getBase(55_000_000,  'Khánh Hòa', 53);

  // ── Lâm Đồng (Đà Lạt) ────────────────────────────────────────────────────
  if (/đà lạt|da lat/i.test(enrichedAddr))                 return getBase(45_000_000,  'Đà Lạt', 57);
  if (/bảo lộc|bao loc/i.test(enrichedAddr))               return getBase(20_000_000,  'Bảo Lộc, Lâm Đồng', 50);
  if (/lâm đồng|lam dong/i.test(enrichedAddr))             return getBase(35_000_000,  'Lâm Đồng', 52);

  // ── Bà Rịa – Vũng Tàu ────────────────────────────────────────────────────
  if (/vũng tàu|vung tau/i.test(enrichedAddr))             return getBase(55_000_000,  'Vũng Tàu', 57);
  if (/phú mỹ.*brvt|phu my.*brvt/i.test(enrichedAddr))    return getBase(35_000_000,  'Phú Mỹ, BR-VT', 53);
  if (/bà rịa|ba ria/i.test(enrichedAddr))                 return getBase(30_000_000,  'Bà Rịa', 52);
  if (/bà rịa.?vũng tàu|br.?vt/i.test(enrichedAddr))      return getBase(40_000_000,  'Bà Rịa-Vũng Tàu', 52);

  // ── Đồng Nai ──────────────────────────────────────────────────────────────
  if (/biên hòa|bien hoa/i.test(enrichedAddr))             return getBase(42_000_000,  'Biên Hòa, Đồng Nai', 57);
  if (/long thành|long thanh.*dong nai/i.test(enrichedAddr)) return getBase(35_000_000, 'Long Thành, Đồng Nai', 55);
  if (/nhơn trạch|nhon trach/i.test(enrichedAddr))         return getBase(30_000_000,  'Nhơn Trạch, Đồng Nai', 53);
  if (/đồng nai|dong nai/i.test(enrichedAddr))             return getBase(35_000_000,  'Đồng Nai', 53);

  // ── Bình Dương ────────────────────────────────────────────────────────────
  if (/thuận an|thuan an/i.test(enrichedAddr))             return getBase(55_000_000,  'Thuận An, Bình Dương', 58);
  if (/dĩ an|di an/i.test(enrichedAddr))                   return getBase(50_000_000,  'Dĩ An, Bình Dương', 57);
  if (/thủ dầu một|thu dau mot/i.test(enrichedAddr))       return getBase(45_000_000,  'Thủ Dầu Một, Bình Dương', 57);
  if (/bến cát|ben cat/i.test(enrichedAddr))               return getBase(30_000_000,  'Bến Cát, Bình Dương', 52);
  if (/bình dương|binh duong/i.test(enrichedAddr))         return getBase(45_000_000,  'Bình Dương', 57);

  // ── Long An ───────────────────────────────────────────────────────────────
  if (/tân an|tan an.*long an/i.test(enrichedAddr))        return getBase(30_000_000,  'Tân An, Long An', 52);
  if (/cần đước|can duoc/i.test(enrichedAddr))             return getBase(22_000_000,  'Cần Đước, Long An', 48);
  if (/long an/i.test(enrichedAddr))                       return getBase(28_000_000,  'Long An', 52);

  // ── Tây Ninh ──────────────────────────────────────────────────────────────
  if (/tây ninh|tay ninh/i.test(enrichedAddr))             return getBase(18_000_000,  'Tây Ninh', 48);

  // ── Bình Phước ────────────────────────────────────────────────────────────
  if (/đồng xoài|dong xoai/i.test(enrichedAddr))           return getBase(16_000_000,  'Đồng Xoài, Bình Phước', 47);
  if (/bình phước|binh phuoc/i.test(enrichedAddr))         return getBase(18_000_000,  'Bình Phước', 47);

  // ── Thừa Thiên Huế ───────────────────────────────────────────────────────
  if (/huế|hue/i.test(enrichedAddr))                       return getBase(32_000_000,  'TP. Huế', 52);
  if (/thừa thiên|thua thien/i.test(enrichedAddr))         return getBase(28_000_000,  'Thừa Thiên Huế', 50);

  // ── Quảng Nam ─────────────────────────────────────────────────────────────
  if (/hội an|hoi an/i.test(enrichedAddr))                 return getBase(55_000_000,  'Hội An, Quảng Nam', 57);
  if (/tam kỳ|tam ky/i.test(enrichedAddr))                 return getBase(20_000_000,  'Tam Kỳ, Quảng Nam', 50);
  if (/quảng nam|quang nam/i.test(enrichedAddr))           return getBase(22_000_000,  'Quảng Nam', 50);

  // ── Bình Định ─────────────────────────────────────────────────────────────
  if (/quy nhơn|quy nhon/i.test(enrichedAddr))             return getBase(28_000_000,  'Quy Nhơn', 52);
  if (/bình định|binh dinh/i.test(enrichedAddr))           return getBase(22_000_000,  'Bình Định', 50);

  // ── Bình Thuận (Phan Thiết) ───────────────────────────────────────────────
  if (/phan thiết|phan thiet/i.test(enrichedAddr))         return getBase(32_000_000,  'Phan Thiết', 52);
  if (/mũi né|mui ne/i.test(enrichedAddr))                 return getBase(45_000_000,  'Mũi Né, Bình Thuận', 53);
  if (/bình thuận|binh thuan/i.test(enrichedAddr))         return getBase(25_000_000,  'Bình Thuận', 50);

  // ── Ninh Thuận ────────────────────────────────────────────────────────────
  if (/phan rang|ninh thuận|ninh thuan/i.test(enrichedAddr)) return getBase(20_000_000, 'Ninh Thuận', 48);

  // ── Phú Yên ───────────────────────────────────────────────────────────────
  if (/tuy hòa|tuy hoa|phú yên|phu yen/i.test(enrichedAddr)) return getBase(18_000_000, 'Phú Yên', 47);

  // ── Quảng Ngãi ────────────────────────────────────────────────────────────
  if (/quảng ngãi|quang ngai/i.test(enrichedAddr))         return getBase(16_000_000,  'Quảng Ngãi', 47);

  // ── Nghệ An ───────────────────────────────────────────────────────────────
  if (/tp\.?\s*vinh|thành phố vinh|thanh pho vinh|nghệ an|nghe an/i.test(enrichedAddr)) return getBase(22_000_000, 'Vinh, Nghệ An', 50);

  // ── Thanh Hóa ─────────────────────────────────────────────────────────────
  if (/sầm sơn|sam son/i.test(enrichedAddr))               return getBase(22_000_000,  'Sầm Sơn, Thanh Hóa', 50);
  if (/thanh hóa|thanh hoa/i.test(enrichedAddr))           return getBase(18_000_000,  'Thanh Hóa', 48);

  // ── Hà Tĩnh ───────────────────────────────────────────────────────────────
  if (/hà tĩnh|ha tinh/i.test(enrichedAddr))               return getBase(14_000_000,  'Hà Tĩnh', 46);

  // ── Quảng Bình ────────────────────────────────────────────────────────────
  if (/đồng hới|dong hoi|quảng bình|quang binh/i.test(enrichedAddr)) return getBase(14_000_000, 'Quảng Bình', 46);

  // ── Quảng Trị ─────────────────────────────────────────────────────────────
  if (/đông hà|dong ha|quảng trị|quang tri/i.test(enrichedAddr)) return getBase(12_000_000, 'Quảng Trị', 45);

  // ── Tây Nguyên ────────────────────────────────────────────────────────────
  if (/buôn ma thuột|buon ma thuot|ban me thuot/i.test(enrichedAddr)) return getBase(18_000_000, 'Buôn Ma Thuột, Đắk Lắk', 48);
  if (/đắk lắk|dak lak/i.test(enrichedAddr))               return getBase(16_000_000,  'Đắk Lắk', 46);
  if (/pleiku|gia lai/i.test(enrichedAddr))                 return getBase(16_000_000,  'Gia Lai', 46);
  if (/đắk nông|dak nong|gia nghĩa|gia nghia/i.test(enrichedAddr)) return getBase(13_000_000, 'Đắk Nông', 44);
  if (/kon tum/i.test(enrichedAddr))                        return getBase(12_000_000,  'Kon Tum', 44);

  // ── Đồng bằng sông Cửu Long ──────────────────────────────────────────────
  if (/mỹ tho|my tho|tiền giang|tien giang/i.test(enrichedAddr)) return getBase(22_000_000, 'Tiền Giang', 50);
  if (/bến tre|ben tre/i.test(enrichedAddr))               return getBase(16_000_000,  'Bến Tre', 47);
  if (/trà vinh|tra vinh/i.test(enrichedAddr))             return getBase(13_000_000,  'Trà Vinh', 45);
  if (/vĩnh long|vinh long/i.test(enrichedAddr))           return getBase(16_000_000,  'Vĩnh Long', 47);
  if (/cao lãnh|cao lanh|đồng tháp|dong thap/i.test(enrichedAddr)) return getBase(14_000_000, 'Đồng Tháp', 46);
  if (/long xuyên|long xuyen|châu đốc|chau doc|an giang/i.test(enrichedAddr)) return getBase(18_000_000, 'An Giang', 48);
  if (/phú quốc|phu quoc/i.test(enrichedAddr))             return getBase(80_000_000,  'Phú Quốc, Kiên Giang', 57);
  if (/rạch giá|rach gia|kiên giang|kien giang/i.test(enrichedAddr)) return getBase(20_000_000, 'Kiên Giang', 48);
  if (/vị thanh|vi thanh|hậu giang|hau giang/i.test(enrichedAddr)) return getBase(12_000_000, 'Hậu Giang', 44);
  if (/sóc trăng|soc trang/i.test(enrichedAddr))           return getBase(12_000_000,  'Sóc Trăng', 44);
  if (/bạc liêu|bac lieu/i.test(enrichedAddr))             return getBase(12_000_000,  'Bạc Liêu', 44);
  if (/cà mau/i.test(enrichedAddr))                        return getBase(14_000_000,  'Cà Mau', 44);

  // ── Quảng Ninh (Hạ Long) ─────────────────────────────────────────────────
  if (/hạ long|ha long/i.test(enrichedAddr))               return getBase(40_000_000,  'Hạ Long, Quảng Ninh', 55);
  if (/móng cái|mong cai/i.test(enrichedAddr))             return getBase(25_000_000,  'Móng Cái, Quảng Ninh', 50);
  if (/quảng ninh|quang ninh/i.test(enrichedAddr))         return getBase(35_000_000,  'Quảng Ninh', 53);

  // ── Các tỉnh phía Bắc (quanh Hà Nội) ────────────────────────────────────
  if (/bắc ninh|bac ninh/i.test(enrichedAddr))             return getBase(32_000_000,  'Bắc Ninh', 52);
  if (/bắc giang|bac giang/i.test(enrichedAddr))           return getBase(22_000_000,  'Bắc Giang', 50);
  if (/vĩnh phúc|vinh phuc/i.test(enrichedAddr))           return getBase(26_000_000,  'Vĩnh Phúc', 50);
  if (/hải dương|hai duong/i.test(enrichedAddr))           return getBase(25_000_000,  'Hải Dương', 50);
  if (/hưng yên|hung yen/i.test(enrichedAddr))             return getBase(22_000_000,  'Hưng Yên', 50);
  if (/thái bình|thai binh/i.test(enrichedAddr))           return getBase(15_000_000,  'Thái Bình', 47);
  if (/hà nam|ha nam/i.test(enrichedAddr))                 return getBase(18_000_000,  'Hà Nam', 48);
  if (/nam định|nam dinh/i.test(enrichedAddr))             return getBase(18_000_000,  'Nam Định', 48);
  if (/ninh bình|ninh binh/i.test(enrichedAddr))           return getBase(20_000_000,  'Ninh Bình', 48);

  // ── Trung du & Miền núi phía Bắc ─────────────────────────────────────────
  if (/thái nguyên|thai nguyen/i.test(enrichedAddr))       return getBase(20_000_000,  'Thái Nguyên', 49);
  if (/phú thọ|phu tho/i.test(enrichedAddr))               return getBase(18_000_000,  'Phú Thọ', 47);
  if (/yên bái|yen bai/i.test(enrichedAddr))               return getBase(10_000_000,  'Yên Bái', 45);
  if (/lào cai|lao cai/i.test(enrichedAddr))               return getBase(15_000_000,  'Lào Cai', 46);
  if (/sa pa|sapa/i.test(enrichedAddr))                    return getBase(28_000_000,  'Sa Pa, Lào Cai', 52);
  if (/tuyên quang|tuyen quang/i.test(enrichedAddr))       return getBase(10_000_000,  'Tuyên Quang', 44);
  if (/hòa bình|hoa binh/i.test(enrichedAddr))             return getBase(12_000_000,  'Hòa Bình', 45);
  if (/sơn la|son la/i.test(enrichedAddr))                 return getBase(10_000_000,  'Sơn La', 44);
  if (/điện biên|dien bien/i.test(enrichedAddr))           return getBase(8_000_000,   'Điện Biên', 42);
  if (/lai châu|lai chau/i.test(enrichedAddr))             return getBase(7_000_000,   'Lai Châu', 40);
  if (/lạng sơn|lang son/i.test(enrichedAddr))             return getBase(10_000_000,  'Lạng Sơn', 44);
  if (/cao bằng|cao bang/i.test(enrichedAddr))             return getBase(8_000_000,   'Cao Bằng', 42);
  if (/bắc kạn|bac kan/i.test(enrichedAddr))               return getBase(8_000_000,   'Bắc Kạn', 42);
  if (/hà giang|ha giang/i.test(enrichedAddr))             return getBase(8_000_000,   'Hà Giang', 42);

  return getBase(20_000_000, 'Tỉnh/Thành khác', 42);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. FALLBACK MONTHLY RENT ESTIMATE (when AI is unavailable)
//    Source: Batdongsan/CBRE/Savills Vietnam 2025-2026 rental market data
//
//    *** RESIDENTIAL ***: dùng trực tiếp đơn giá/m²/tháng (thực tế thị trường)
//    *** THƯƠNG MẠI   ***: dùng công thức yield (thu nhập thuần / cap rate)
//
//    Apartment: KHÔNG dùng công thức yield từ comps value vì:
//      - Vinhome 80m² ~ 7.5 tỷ → grossYield 6% → 37.5tr/th (SAI — thực tế 22-25tr)
//      - Yield thực tế căn hộ premium chỉ ~3-3.5%, không phải 6%
//      - Dùng đơn giá/m²/tháng cho kết quả chính xác hơn
// ─────────────────────────────────────────────────────────────────────────────

// Đơn giá thuê thực tế (triệu VNĐ/m²/tháng) — dùng làm nguồn CHÍNH cho nhà ở
// Source: Batdongsan.com.vn, OneHousing, CBRE Vietnam Rental Report 2025-2026
// ─────────────────────────────────────────────────────────────────────────────
// Calibration (tháng 4/2026):
//   apartment_center  0.28: Vinhomes BT 80m² = 22.4tr ✓ (thực tế 20-28tr)
//   townhouse_center  0.32: nhà phố 100m² Bình Thạnh = 32tr ✓ (thực tế 28-45tr)
//   villa             0.18: biệt thự 200m² = 36tr ✓ (thực tế 30-80tr)
//   penthouse         0.40: PH Vinhomes 150m² = 60tr ✓ (thực tế 50-120tr)
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_RENT_PER_M2: Record<string, number> = {
  // ── Nhà ở (residential) — đơn giá/m²/tháng thực tế ────────────────────────
  apartment_center:  0.28,  // Căn hộ nội đô cao cấp: 70m²=19.6tr, 80m²=22.4tr, 90m²=25.2tr
  apartment_suburb:  0.20,  // Căn hộ ngoại thành/trung cấp: 70m²=14tr, 80m²=16tr
  townhouse_center:  0.32,  // Nhà phố nội đô cho thuê nguyên căn: 100m²=32tr (thực tế 28-45tr)
  townhouse_suburb:  0.20,  // Nhà phố ngoại thành: 100m²=20tr (thực tế 15-28tr)
  villa:             0.18,  // Biệt thự: 200m²=36tr, 300m²=54tr (thực tế 30-80tr)
  penthouse:         0.40,  // Penthouse: 150m²=60tr (thực tế 50-120tr, premium view)
  project:           0.23,  // Căn hộ off-plan: tương đương apartment_suburb + nhỉnh khi bàn giao

  // ── Thương mại / Công nghiệp ────────────────────────────────────────────────
  shophouse:         0.45,  // Shophouse mặt đường: 50m²=22.5tr (thực tế 20-50tr/50m²)
  office:            0.33,  // VP B-class: USD 12/m²/th ≈ 300K VNĐ/m²/th
  warehouse:         0.075, // Kho RBW: USD 3-5/m²/th ≈ 75-125K VNĐ/m²/th (Savills 2024)
  land_urban:        0.08,  // Đất thổ cư nội đô — cho thuê ki-ốt/mặt bằng
  land_suburban:     0.04,  // Đất ngoại thành
  land_agricultural: 0.003, // Đất nông nghiệp — cho thuê canh tác
  land_industrial:   0.05,  // Đất KCN — cho thuê dài hạn
};

// Loại nhà ở dùng đơn giá/m²/tháng thực tế (KHÔNG dùng yield từ comps value).
// Lý do: yield thực tế nhà ở (2.8-3.8%) ≠ DEFAULT_CAP_RATE bảng → tính yield ra sai.
const RESIDENTIAL_TYPES_FOR_RENT: PropertyType[] = [
  'apartment_center', 'apartment_suburb',
  'townhouse_center', 'townhouse_suburb',
  'villa', 'penthouse', 'project',
];

export function estimateFallbackRent(
  compsPrice: number,        // VNĐ (total property value — chỉ dùng cho thương mại)
  propertyType: PropertyType,
  area: number,
): number {
  const safeArea = area > 0 ? area : 1;

  // ── Nhà ở: dùng đơn giá/m²/tháng thực tế ─────────────────────────────────
  // Phương pháp yield (compsPrice × grossYield) cho kết quả sai với nhà ở cao cấp
  // vì yield thực tế (2.8-3.5%) thấp hơn nhiều so với cap rate danh nghĩa (4.5-6%)
  if (RESIDENTIAL_TYPES_FOR_RENT.includes(propertyType)) {
    const perM2Rate = FALLBACK_RENT_PER_M2[propertyType] ?? 0.25;
    return Math.round(safeArea * perM2Rate * 10) / 10;
  }

  // ── Thương mại / Công nghiệp: dùng công thức yield ──────────────────────
  const capRate = DEFAULT_CAP_RATES[propertyType];
  const safeCap = capRate > 0 ? capRate : DEFAULT_CAP_RATE;
  const grossYield = safeCap;  // DEFAULT_CAP_RATES are already gross yield caps (VN market standard)
  const annualRentVND = compsPrice * grossYield;
  const monthlyRentTrieu = (annualRentVND / 12) / 1_000_000;

  // Kiểm tra sanity: rent/m²/tháng phải nằm trong 0.002–8 triệu/m²
  const rentPerM2 = monthlyRentTrieu / safeArea;
  if (rentPerM2 < 0.002 || rentPerM2 > 8) {
    const floorPerM2 = FALLBACK_RENT_PER_M2[propertyType] ?? 0.20;
    return Math.round(safeArea * floorPerM2 * 10) / 10;
  }
  return Math.round(monthlyRentTrieu * 10) / 10;
}
