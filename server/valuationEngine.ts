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
 *  Method 2 — Income Capitalization:
 *    NOI           = Effective Gross Income − Operating Expenses
 *    P_income      = NOI / Cap Rate
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
  paybackYears: number;      // years to recoup at current NOI
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
// Cap Rates by Property Type — Vietnamese Market 2024-2025
// Source: CBRE, Savills Vietnam, JLL Vietnam reports
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_CAP_RATES: Record<PropertyType, number> = {
  apartment_center:  0.045,  // Căn hộ trung tâm (Quận 1, Hoàn Kiếm)
  apartment_suburb:  0.055,  // Căn hộ ngoại thành
  townhouse_center:  0.050,  // Nhà phố nội đô
  townhouse_suburb:  0.065,  // Nhà phố ngoại thành
  villa:             0.060,  // Biệt thự
  shophouse:         0.055,  // Nhà phố thương mại
  land_urban:        0.040,  // Đất thổ cư nội đô (tích lũy giá trị)
  land_suburban:     0.070,  // Đất ngoại thành (cho thuê thấp hơn)
  penthouse:         0.038,  // Penthouse — cap thấp nhất, cực kỳ cao cấp
  office:            0.062,  // Văn phòng / Thương mại — yield ổn định
  warehouse:         0.072,  // Nhà xưởng / Kho bãi — yield cao, ít tăng giá
  land_agricultural: 0.012,  // Đất nông nghiệp — chủ yếu đầu cơ/chuyển đổi
  land_industrial:   0.048,  // Đất KCN — yield từ cho thuê kho xưởng
  project:           0.045,  // Off-plan — blended theo tiến độ dự án
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
//    Standard reference: 60-100m²
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
// 5. Income Capitalization Engine
//    NOI = Effective Gross Income - OPEX
//    Value = NOI / Cap Rate
// ─────────────────────────────────────────────────────────────────────────────
function applyIncomeApproach(
  monthlyRent: number,       // triệu VNĐ/tháng
  totalPrice: number,        // VNĐ (comps value — used to compute yield)
  propertyType: PropertyType,
  vacancyRate = DEFAULT_VACANCY_RATE,
  opexRate = DEFAULT_OPEX_RATE,
  capRateAdj = 0,            // dynamic adjustment: negative = lower cap (higher value)
): IncomeApproachResult {
  // Clamp rates to valid ranges [0, 1]
  const safeVacancyRate = Math.min(1, Math.max(0, vacancyRate));
  const safeOpexRate = Math.min(1, Math.max(0, opexRate));
  const baseCapRate = DEFAULT_CAP_RATES[propertyType];
  // Apply trend-based adjustment, but clamp cap rate to sensible range [1.5%, 12%]
  const capRate = Math.min(0.12, Math.max(0.015, baseCapRate + capRateAdj));
  const grossIncomeTrieu = monthlyRent * 12;                     // triệu/năm
  const vacancyLossTrieu = grossIncomeTrieu * safeVacancyRate;
  const effectiveIncomeTrieu = grossIncomeTrieu * (1 - safeVacancyRate);
  const opexTrieu = grossIncomeTrieu * safeOpexRate;
  const noiTrieu = Math.max(0, effectiveIncomeTrieu - opexTrieu); // NOI cannot be negative

  // Convert to VNĐ for capital value
  const noiVND = noiTrieu * 1_000_000;
  const safeCapRate = capRate > 0 ? capRate : DEFAULT_CAP_RATE;
  const capitalValue = Math.max(0, Math.round(noiVND / safeCapRate));

  const grossRentalYield = totalPrice > 0
    ? (grossIncomeTrieu * 1_000_000) / totalPrice * 100
    : 0;
  const paybackYears = noiTrieu > 0
    ? (capitalValue / 1_000_000) / noiTrieu
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
    floorLevel, direction, frontageWidth, furnishing, buildingAge,
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

  // ── Core coefficients ─────────────────────────────────────────
  const Kd_data = getKd(roadWidth);
  const Kp_data = getKp(legal);
  const Ka_data = getKa(area);

  const Kd = Kd_data.value;
  const Kp = Kp_data.value;
  const Ka = Ka_data.value;

  // ── Optional coefficients ─────────────────────────────────────
  const pType = propertyType || 'townhouse_center';
  const Kfl_data = (floorLevel !== undefined && floorLevel > 0) ? getKfl(floorLevel, pType) : null;
  const Kdir_data = direction ? getKdir(direction) : null;
  const Kmf_data = (frontageWidth !== undefined && frontageWidth > 0) ? getKmf(frontageWidth, pType) : null;
  const Kfurn_data = furnishing ? getKfurn(furnishing) : null;
  const Kage_data = (buildingAge !== undefined) ? getKage(buildingAge, pType) : null;

  const Kfl = Kfl_data?.value ?? 1.0;
  const Kdir = Kdir_data?.value ?? 1.0;
  const Kmf = Kmf_data?.value ?? 1.0;
  const Kfurn = Kfurn_data?.value ?? 1.0;
  const Kage = Kage_data?.value ?? 1.0;

  // ── Method 1: AVM/Comps ────────────────────────────────────────
  const safeArea = Math.max(1, area);
  const safeMarketBase = Math.max(0, effectiveBasePrice);
  const rawPricePerM2 = safeMarketBase * Kd * Kp * Ka * Kfl * Kdir * Kmf * Kfurn * Kage;
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
      finalConfidence = Math.max(finalConfidence - 3, 90); // small penalty only
    } else if (methodDeviation > 0.30) {
      // Moderate divergence 30-50% — slight penalty
      finalConfidence = Math.max(finalConfidence - 1, 94);
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
    coefficients: { Kd, Kp, Ka, ...(Kfl_data && { Kfl }), ...(Kdir_data && { Kdir }), ...(Kmf_data && { Kmf }), ...(Kfurn_data && { Kfurn }), ...(Kage_data && { Kage }) },
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
// Source: Batdongsan/Savills Vietnam 2024-2025 cross-type analysis
const PROPERTY_TYPE_PRICE_MULT: Record<string, number> = {
  apartment_center:  0.42,  // Căn hộ nội đô: ~42% giá nhà phố cùng khu vực
  apartment_suburb:  0.50,  // Căn hộ ngoại thành: ~50%
  townhouse_center:  1.00,  // Tham chiếu chuẩn
  townhouse_suburb:  1.00,
  villa:             0.85,  // Biệt thự: ít hơn/m² do diện tích lớn
  shophouse:         1.20,  // Shophouse: premium thương mại
  land_urban:        1.30,  // Đất thổ cư nội đô: premium (không có khấu hao nhà)
  land_suburban:     1.00,
  penthouse:         0.60,  // Penthouse: ~60% nhà phố/m² nhưng floor premium bù lại
  office:            1.10,  // Văn phòng: premium thương mại trên nhà phố
  warehouse:         0.45,  // Nhà xưởng: rẻ/m² do diện tích lớn, hạ tầng đơn giản
  land_agricultural: 0.06,  // Đất nông nghiệp: rất rẻ so với thổ cư
  land_industrial:   0.35,  // Đất KCN: đắt hơn nông nghiệp, rẻ hơn thổ cư
  project:           0.75,  // Off-plan: chiết khấu so với thứ cấp (chưa bàn giao)
};

export function getRegionalBasePrice(address: string, pType?: string): {
  price: number;
  region: string;
  confidence: number;
} {
  const addr = address.toLowerCase();

  // ── Street/corridor-level premium overrides (highest precision) ───────────
  // These trump the district-level table when matched
  let streetOverride: number | null = null;
  if (/nguyễn huệ|le loi|lê lợi|dong khoi|đồng khởi/i.test(addr) && /quận 1|q\.?1/i.test(addr))
    streetOverride = 450_000_000; // Pedestrian streets Q1 — ultra-premium
  if (/vinhomes central park|binh thanh|bình thạnh.*vinhomes/i.test(addr))
    streetOverride = 140_000_000;
  if (/phú mỹ hưng|phu my hung/i.test(addr))
    streetOverride = 160_000_000;
  if (/thảo điền|thao dien/i.test(addr))
    streetOverride = 180_000_000;

  // Apply street override if matched
  const getBase = (base: number, region: string, conf: number) => {
    const refPrice = streetOverride ?? base;
    const mult = PROPERTY_TYPE_PRICE_MULT[pType || 'townhouse_center'] ?? 1.00;
    return { price: Math.round(refPrice * mult), region, confidence: conf };
  };

  // ── TP.HCM ────────────────────────────────────────────────────────────────
  if (/quận 1\b|q\.?1\b|district 1/i.test(addr)) return getBase(280_000_000, 'Quận 1, TP.HCM', 62);
  if (/quận 3\b|q\.?3\b/i.test(addr))             return getBase(200_000_000, 'Quận 3, TP.HCM', 62);
  if (/quận 4\b|q\.?4\b/i.test(addr))             return getBase(130_000_000, 'Quận 4, TP.HCM', 62);
  if (/quận 5\b|q\.?5\b/i.test(addr))             return getBase(140_000_000, 'Quận 5, TP.HCM', 62);
  if (/quận 6\b|q\.?6\b/i.test(addr))             return getBase(90_000_000,  'Quận 6, TP.HCM', 60);
  if (/quận 7\b|q\.?7\b/i.test(addr))             return getBase(150_000_000, 'Quận 7, TP.HCM', 62);
  if (/quận 8\b|q\.?8\b/i.test(addr))             return getBase(80_000_000,  'Quận 8, TP.HCM', 60);
  if (/quận 9\b|q\.?9\b/i.test(addr))             return getBase(70_000_000,  'Quận 9, TP.HCM', 60);
  if (/quận 10\b|q\.?10\b/i.test(addr))           return getBase(160_000_000, 'Quận 10, TP.HCM', 62);
  if (/quận 11\b|q\.?11\b/i.test(addr))           return getBase(110_000_000, 'Quận 11, TP.HCM', 60);
  if (/quận 12\b|q\.?12\b/i.test(addr))           return getBase(65_000_000,  'Quận 12, TP.HCM', 60);
  if (/bình chánh|binh chanh/i.test(addr))        return getBase(35_000_000,  'Bình Chánh, TP.HCM', 55);
  if (/nhà bè|nha be/i.test(addr))                return getBase(45_000_000,  'Nhà Bè, TP.HCM', 55);
  if (/hóc môn|hoc mon/i.test(addr))              return getBase(40_000_000,  'Hóc Môn, TP.HCM', 55);
  if (/củ chi|cu chi/i.test(addr))                return getBase(25_000_000,  'Củ Chi, TP.HCM', 52);
  if (/cần giờ|can gio/i.test(addr))              return getBase(20_000_000,  'Cần Giờ, TP.HCM', 50);
  if (/bình thạnh|binh thanh/i.test(addr))        return getBase(120_000_000, 'Bình Thạnh, TP.HCM', 62);
  if (/phú nhuận|phu nhuan/i.test(addr))          return getBase(150_000_000, 'Phú Nhuận, TP.HCM', 62);
  if (/tân bình|tan binh/i.test(addr))            return getBase(100_000_000, 'Tân Bình, TP.HCM', 62);
  if (/tân phú|tan phu/i.test(addr))              return getBase(80_000_000,  'Tân Phú, TP.HCM', 60);
  if (/gò vấp|go vap/i.test(addr))                return getBase(75_000_000,  'Gò Vấp, TP.HCM', 60);
  if (/thủ đức|thu duc/i.test(addr))              return getBase(65_000_000,  'Thủ Đức, TP.HCM', 60);
  if (/bình dương|binh duong/i.test(addr))        return getBase(45_000_000,  'Bình Dương', 57);
  if (/hcm|hồ chí minh|ho chi minh|sài gòn|saigon/i.test(addr)) return getBase(100_000_000, 'TP.HCM (trung bình)', 55);

  // ── Hà Nội ───────────────────────────────────────────────────────────────
  if (/hoàn kiếm|hoan kiem/i.test(addr))           return getBase(300_000_000, 'Hoàn Kiếm, Hà Nội', 62);
  if (/ba đình|ba dinh/i.test(addr))               return getBase(220_000_000, 'Ba Đình, Hà Nội', 62);
  if (/đống đa|dong da/i.test(addr))               return getBase(180_000_000, 'Đống Đa, Hà Nội', 62);
  if (/hai bà trưng|hai ba trung/i.test(addr))     return getBase(170_000_000, 'Hai Bà Trưng, Hà Nội', 62);
  if (/cầu giấy|cau giay/i.test(addr))             return getBase(120_000_000, 'Cầu Giấy, Hà Nội', 60);
  if (/tây hồ|tay ho/i.test(addr))                 return getBase(130_000_000, 'Tây Hồ, Hà Nội', 60);
  if (/thanh xuân|thanh xuan/i.test(addr))         return getBase(100_000_000, 'Thanh Xuân, Hà Nội', 60);
  if (/hoàng mai|hoang mai/i.test(addr))           return getBase(75_000_000,  'Hoàng Mai, Hà Nội', 58);
  if (/nam từ liêm|nam tu liem|bắc từ liêm|bac tu liem/i.test(addr)) return getBase(85_000_000, 'Từ Liêm, Hà Nội', 58);
  if (/long biên|long bien/i.test(addr))           return getBase(70_000_000,  'Long Biên, Hà Nội', 58);
  if (/hà đông|ha dong/i.test(addr))               return getBase(60_000_000,  'Hà Đông, Hà Nội', 57);
  if (/gia lâm|gia lam/i.test(addr))               return getBase(55_000_000,  'Gia Lâm, Hà Nội', 55);
  if (/đông anh|dong anh/i.test(addr))             return getBase(50_000_000,  'Đông Anh, Hà Nội', 55);
  if (/hà nội|hanoi|ha noi/i.test(addr))           return getBase(110_000_000, 'Hà Nội (trung bình)', 52);

  // ── Đà Nẵng (TP trực thuộc TW) ───────────────────────────────────────────
  if (/hải châu|hai chau/i.test(addr))             return getBase(90_000_000,  'Hải Châu, Đà Nẵng', 60);
  if (/thanh khê|thanh khe/i.test(addr))           return getBase(70_000_000,  'Thanh Khê, Đà Nẵng', 58);
  if (/sơn trà|son tra/i.test(addr))               return getBase(75_000_000,  'Sơn Trà, Đà Nẵng', 58);
  if (/ngũ hành sơn|ngu hanh son/i.test(addr))     return getBase(60_000_000,  'Ngũ Hành Sơn, Đà Nẵng', 57);
  if (/liên chiểu|lien chieu/i.test(addr))         return getBase(55_000_000,  'Liên Chiểu, Đà Nẵng', 55);
  if (/đà nẵng|da nang/i.test(addr))               return getBase(75_000_000,  'Đà Nẵng', 57);

  // ── Hải Phòng (TP trực thuộc TW) ────────────────────────────────────────
  if (/hồng bàng|hong bang/i.test(addr))           return getBase(60_000_000,  'Hồng Bàng, Hải Phòng', 58);
  if (/ngô quyền|ngo quyen/i.test(addr))           return getBase(55_000_000,  'Ngô Quyền, Hải Phòng', 57);
  if (/lê chân|le chan/i.test(addr))               return getBase(50_000_000,  'Lê Chân, Hải Phòng', 57);
  if (/hải an|hai an/i.test(addr))                 return getBase(38_000_000,  'Hải An, Hải Phòng', 55);
  if (/đồ sơn|do son/i.test(addr))                 return getBase(40_000_000,  'Đồ Sơn, Hải Phòng', 53);
  if (/hải phòng|hai phong/i.test(addr))           return getBase(50_000_000,  'Hải Phòng', 55);

  // ── Cần Thơ (TP trực thuộc TW) ───────────────────────────────────────────
  if (/ninh kiều|ninh kieu/i.test(addr))           return getBase(42_000_000,  'Ninh Kiều, Cần Thơ', 57);
  if (/bình thuỷ|binh thuy/i.test(addr))           return getBase(28_000_000,  'Bình Thuỷ, Cần Thơ', 53);
  if (/cần thơ|can tho/i.test(addr))               return getBase(35_000_000,  'Cần Thơ', 53);

  // ── Khánh Hòa (Nha Trang) ────────────────────────────────────────────────
  if (/nha trang/i.test(addr))                     return getBase(65_000_000,  'Nha Trang', 57);
  if (/cam ranh/i.test(addr))                      return getBase(25_000_000,  'Cam Ranh, Khánh Hòa', 50);
  if (/ninh hòa|ninh hoa/i.test(addr))             return getBase(15_000_000,  'Ninh Hòa, Khánh Hòa', 48);
  if (/khánh hòa|khanh hoa/i.test(addr))           return getBase(55_000_000,  'Khánh Hòa', 53);

  // ── Lâm Đồng (Đà Lạt) ────────────────────────────────────────────────────
  if (/đà lạt|da lat/i.test(addr))                 return getBase(45_000_000,  'Đà Lạt', 57);
  if (/bảo lộc|bao loc/i.test(addr))               return getBase(20_000_000,  'Bảo Lộc, Lâm Đồng', 50);
  if (/lâm đồng|lam dong/i.test(addr))             return getBase(35_000_000,  'Lâm Đồng', 52);

  // ── Bà Rịa – Vũng Tàu ────────────────────────────────────────────────────
  if (/vũng tàu|vung tau/i.test(addr))             return getBase(55_000_000,  'Vũng Tàu', 57);
  if (/phú mỹ.*brvt|phu my.*brvt/i.test(addr))    return getBase(35_000_000,  'Phú Mỹ, BR-VT', 53);
  if (/bà rịa|ba ria/i.test(addr))                 return getBase(30_000_000,  'Bà Rịa', 52);
  if (/bà rịa.?vũng tàu|br.?vt/i.test(addr))      return getBase(40_000_000,  'Bà Rịa-Vũng Tàu', 52);

  // ── Đồng Nai ──────────────────────────────────────────────────────────────
  if (/biên hòa|bien hoa/i.test(addr))             return getBase(42_000_000,  'Biên Hòa, Đồng Nai', 57);
  if (/long thành|long thanh.*dong nai/i.test(addr)) return getBase(35_000_000, 'Long Thành, Đồng Nai', 55);
  if (/nhơn trạch|nhon trach/i.test(addr))         return getBase(30_000_000,  'Nhơn Trạch, Đồng Nai', 53);
  if (/đồng nai|dong nai/i.test(addr))             return getBase(35_000_000,  'Đồng Nai', 53);

  // ── Bình Dương ────────────────────────────────────────────────────────────
  if (/thuận an|thuan an/i.test(addr))             return getBase(55_000_000,  'Thuận An, Bình Dương', 58);
  if (/dĩ an|di an/i.test(addr))                   return getBase(50_000_000,  'Dĩ An, Bình Dương', 57);
  if (/thủ dầu một|thu dau mot/i.test(addr))       return getBase(45_000_000,  'Thủ Dầu Một, Bình Dương', 57);
  if (/bến cát|ben cat/i.test(addr))               return getBase(30_000_000,  'Bến Cát, Bình Dương', 52);
  if (/bình dương|binh duong/i.test(addr))         return getBase(45_000_000,  'Bình Dương', 57);

  // ── Long An ───────────────────────────────────────────────────────────────
  if (/tân an|tan an.*long an/i.test(addr))        return getBase(30_000_000,  'Tân An, Long An', 52);
  if (/cần đước|can duoc/i.test(addr))             return getBase(22_000_000,  'Cần Đước, Long An', 48);
  if (/long an/i.test(addr))                       return getBase(28_000_000,  'Long An', 52);

  // ── Tây Ninh ──────────────────────────────────────────────────────────────
  if (/tây ninh|tay ninh/i.test(addr))             return getBase(18_000_000,  'Tây Ninh', 48);

  // ── Bình Phước ────────────────────────────────────────────────────────────
  if (/đồng xoài|dong xoai/i.test(addr))           return getBase(16_000_000,  'Đồng Xoài, Bình Phước', 47);
  if (/bình phước|binh phuoc/i.test(addr))         return getBase(18_000_000,  'Bình Phước', 47);

  // ── Thừa Thiên Huế ───────────────────────────────────────────────────────
  if (/huế|hue/i.test(addr))                       return getBase(32_000_000,  'TP. Huế', 52);
  if (/thừa thiên|thua thien/i.test(addr))         return getBase(28_000_000,  'Thừa Thiên Huế', 50);

  // ── Quảng Nam ─────────────────────────────────────────────────────────────
  if (/hội an|hoi an/i.test(addr))                 return getBase(55_000_000,  'Hội An, Quảng Nam', 57);
  if (/tam kỳ|tam ky/i.test(addr))                 return getBase(20_000_000,  'Tam Kỳ, Quảng Nam', 50);
  if (/quảng nam|quang nam/i.test(addr))           return getBase(22_000_000,  'Quảng Nam', 50);

  // ── Bình Định ─────────────────────────────────────────────────────────────
  if (/quy nhơn|quy nhon/i.test(addr))             return getBase(28_000_000,  'Quy Nhơn', 52);
  if (/bình định|binh dinh/i.test(addr))           return getBase(22_000_000,  'Bình Định', 50);

  // ── Bình Thuận (Phan Thiết) ───────────────────────────────────────────────
  if (/phan thiết|phan thiet/i.test(addr))         return getBase(32_000_000,  'Phan Thiết', 52);
  if (/mũi né|mui ne/i.test(addr))                 return getBase(45_000_000,  'Mũi Né, Bình Thuận', 53);
  if (/bình thuận|binh thuan/i.test(addr))         return getBase(25_000_000,  'Bình Thuận', 50);

  // ── Ninh Thuận ────────────────────────────────────────────────────────────
  if (/phan rang|ninh thuận|ninh thuan/i.test(addr)) return getBase(20_000_000, 'Ninh Thuận', 48);

  // ── Phú Yên ───────────────────────────────────────────────────────────────
  if (/tuy hòa|tuy hoa|phú yên|phu yen/i.test(addr)) return getBase(18_000_000, 'Phú Yên', 47);

  // ── Quảng Ngãi ────────────────────────────────────────────────────────────
  if (/quảng ngãi|quang ngai/i.test(addr))         return getBase(16_000_000,  'Quảng Ngãi', 47);

  // ── Nghệ An ───────────────────────────────────────────────────────────────
  if (/vinh|nghệ an|nghe an/i.test(addr))          return getBase(22_000_000,  'Vinh, Nghệ An', 50);

  // ── Thanh Hóa ─────────────────────────────────────────────────────────────
  if (/sầm sơn|sam son/i.test(addr))               return getBase(22_000_000,  'Sầm Sơn, Thanh Hóa', 50);
  if (/thanh hóa|thanh hoa/i.test(addr))           return getBase(18_000_000,  'Thanh Hóa', 48);

  // ── Hà Tĩnh ───────────────────────────────────────────────────────────────
  if (/hà tĩnh|ha tinh/i.test(addr))               return getBase(14_000_000,  'Hà Tĩnh', 46);

  // ── Quảng Bình ────────────────────────────────────────────────────────────
  if (/đồng hới|dong hoi|quảng bình|quang binh/i.test(addr)) return getBase(14_000_000, 'Quảng Bình', 46);

  // ── Quảng Trị ─────────────────────────────────────────────────────────────
  if (/đông hà|dong ha|quảng trị|quang tri/i.test(addr)) return getBase(12_000_000, 'Quảng Trị', 45);

  // ── Tây Nguyên ────────────────────────────────────────────────────────────
  if (/buôn ma thuột|buon ma thuot|ban me thuot/i.test(addr)) return getBase(18_000_000, 'Buôn Ma Thuột, Đắk Lắk', 48);
  if (/đắk lắk|dak lak/i.test(addr))               return getBase(16_000_000,  'Đắk Lắk', 46);
  if (/pleiku|gia lai/i.test(addr))                 return getBase(16_000_000,  'Gia Lai', 46);
  if (/đắk nông|dak nong|gia nghĩa|gia nghia/i.test(addr)) return getBase(13_000_000, 'Đắk Nông', 44);
  if (/kon tum/i.test(addr))                        return getBase(12_000_000,  'Kon Tum', 44);

  // ── Đồng bằng sông Cửu Long ──────────────────────────────────────────────
  if (/mỹ tho|my tho|tiền giang|tien giang/i.test(addr)) return getBase(22_000_000, 'Tiền Giang', 50);
  if (/bến tre|ben tre/i.test(addr))               return getBase(16_000_000,  'Bến Tre', 47);
  if (/trà vinh|tra vinh/i.test(addr))             return getBase(13_000_000,  'Trà Vinh', 45);
  if (/vĩnh long|vinh long/i.test(addr))           return getBase(16_000_000,  'Vĩnh Long', 47);
  if (/cao lãnh|cao lanh|đồng tháp|dong thap/i.test(addr)) return getBase(14_000_000, 'Đồng Tháp', 46);
  if (/long xuyên|long xuyen|châu đốc|chau doc|an giang/i.test(addr)) return getBase(18_000_000, 'An Giang', 48);
  if (/phú quốc|phu quoc/i.test(addr))             return getBase(80_000_000,  'Phú Quốc, Kiên Giang', 57);
  if (/rạch giá|rach gia|kiên giang|kien giang/i.test(addr)) return getBase(20_000_000, 'Kiên Giang', 48);
  if (/vị thanh|vi thanh|hậu giang|hau giang/i.test(addr)) return getBase(12_000_000, 'Hậu Giang', 44);
  if (/sóc trăng|soc trang/i.test(addr))           return getBase(12_000_000,  'Sóc Trăng', 44);
  if (/bạc liêu|bac lieu/i.test(addr))             return getBase(12_000_000,  'Bạc Liêu', 44);
  if (/cà mau/i.test(addr))                        return getBase(14_000_000,  'Cà Mau', 44);

  // ── Quảng Ninh (Hạ Long) ─────────────────────────────────────────────────
  if (/hạ long|ha long/i.test(addr))               return getBase(40_000_000,  'Hạ Long, Quảng Ninh', 55);
  if (/móng cái|mong cai/i.test(addr))             return getBase(25_000_000,  'Móng Cái, Quảng Ninh', 50);
  if (/quảng ninh|quang ninh/i.test(addr))         return getBase(35_000_000,  'Quảng Ninh', 53);

  // ── Các tỉnh phía Bắc (quanh Hà Nội) ────────────────────────────────────
  if (/bắc ninh|bac ninh/i.test(addr))             return getBase(32_000_000,  'Bắc Ninh', 52);
  if (/bắc giang|bac giang/i.test(addr))           return getBase(22_000_000,  'Bắc Giang', 50);
  if (/vĩnh phúc|vinh phuc/i.test(addr))           return getBase(26_000_000,  'Vĩnh Phúc', 50);
  if (/hải dương|hai duong/i.test(addr))           return getBase(25_000_000,  'Hải Dương', 50);
  if (/hưng yên|hung yen/i.test(addr))             return getBase(22_000_000,  'Hưng Yên', 50);
  if (/thái bình|thai binh/i.test(addr))           return getBase(15_000_000,  'Thái Bình', 47);
  if (/hà nam|ha nam/i.test(addr))                 return getBase(18_000_000,  'Hà Nam', 48);
  if (/nam định|nam dinh/i.test(addr))             return getBase(18_000_000,  'Nam Định', 48);
  if (/ninh bình|ninh binh/i.test(addr))           return getBase(20_000_000,  'Ninh Bình', 48);

  // ── Trung du & Miền núi phía Bắc ─────────────────────────────────────────
  if (/thái nguyên|thai nguyen/i.test(addr))       return getBase(20_000_000,  'Thái Nguyên', 49);
  if (/phú thọ|phu tho/i.test(addr))               return getBase(18_000_000,  'Phú Thọ', 47);
  if (/yên bái|yen bai/i.test(addr))               return getBase(10_000_000,  'Yên Bái', 45);
  if (/lào cai|lao cai/i.test(addr))               return getBase(15_000_000,  'Lào Cai', 46);
  if (/sa pa|sapa/i.test(addr))                    return getBase(28_000_000,  'Sa Pa, Lào Cai', 52);
  if (/tuyên quang|tuyen quang/i.test(addr))       return getBase(10_000_000,  'Tuyên Quang', 44);
  if (/hòa bình|hoa binh/i.test(addr))             return getBase(12_000_000,  'Hòa Bình', 45);
  if (/sơn la|son la/i.test(addr))                 return getBase(10_000_000,  'Sơn La', 44);
  if (/điện biên|dien bien/i.test(addr))           return getBase(8_000_000,   'Điện Biên', 42);
  if (/lai châu|lai chau/i.test(addr))             return getBase(7_000_000,   'Lai Châu', 40);
  if (/lạng sơn|lang son/i.test(addr))             return getBase(10_000_000,  'Lạng Sơn', 44);
  if (/cao bằng|cao bang/i.test(addr))             return getBase(8_000_000,   'Cao Bằng', 42);
  if (/bắc kạn|bac kan/i.test(addr))               return getBase(8_000_000,   'Bắc Kạn', 42);
  if (/hà giang|ha giang/i.test(addr))             return getBase(8_000_000,   'Hà Giang', 42);

  return getBase(20_000_000, 'Tỉnh/Thành khác', 42);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. FALLBACK MONTHLY RENT ESTIMATE (when AI is unavailable)
//    Based on typical gross rental yield in each region
// ─────────────────────────────────────────────────────────────────────────────
export function estimateFallbackRent(
  compsPrice: number,        // VNĐ
  propertyType: PropertyType,
  area: number,
): number {
  const capRate = DEFAULT_CAP_RATES[propertyType];
  const safeArea = area > 0 ? area : 1; // guard against zero area
  const safeCap = capRate > 0 ? capRate : DEFAULT_CAP_RATE;
  const grossYield = safeCap + 0.015;  // gross ≈ cap rate + 1.5% (before vacancy/opex)
  const annualRentVND = compsPrice * grossYield;
  const monthlyRentTrieu = (annualRentVND / 12) / 1_000_000;
  // Sanity check: rent/m² should be 0.05–5 triệu/m²/tháng
  const rentPerM2 = monthlyRentTrieu / safeArea;
  if (rentPerM2 < 0.05 || rentPerM2 > 5) {
    // Fallback: use a simple heuristic
    return Math.round(safeArea * 0.25 * 10) / 10;  // ~0.25 triệu/m²/tháng
  }
  return Math.round(monthlyRentTrieu * 10) / 10;
}
