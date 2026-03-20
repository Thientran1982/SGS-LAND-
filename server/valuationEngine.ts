/**
 * SGS Land — Vietnamese Real Estate Valuation Engine v3
 *
 * Multi-source, multi-coefficient approach:
 *
 *  Method 1 — AVM/Comps (Sales Comparison):
 *    P_adjusted/m² = P_blended × Kd × Kp × Ka × Kfl × Kdir × Kmf × Kfurn
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
  | 'land_suburban';

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
  marketTrend: string;
  factors: AVMFactor[];
  coefficients: { Kd: number; Kp: number; Ka: number; Kfl?: number; Kdir?: number; Kmf?: number; Kfurn?: number };
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
  // Only apply for apartments
  const isApartment = !propertyType || propertyType.startsWith('apartment');
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
  // Not applicable for apartments (uses Kfl instead)
  if (propertyType?.startsWith('apartment')) return null;
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
): IncomeApproachResult {
  // Clamp rates to valid ranges [0, 1]
  const safeVacancyRate = Math.min(1, Math.max(0, vacancyRate));
  const safeOpexRate = Math.min(1, Math.max(0, opexRate));
  const capRate = DEFAULT_CAP_RATES[propertyType];
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
    floorLevel, direction, frontageWidth, furnishing,
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
    effectiveConfidence = Math.min(98, confidence + blended.confidenceBoost);
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

  const Kfl = Kfl_data?.value ?? 1.0;
  const Kdir = Kdir_data?.value ?? 1.0;
  const Kmf = Kmf_data?.value ?? 1.0;
  const Kfurn = Kfurn_data?.value ?? 1.0;

  // ── Method 1: AVM/Comps ────────────────────────────────────────
  const safeArea = Math.max(1, area);
  const safeMarketBase = Math.max(0, effectiveBasePrice);
  const rawPricePerM2 = safeMarketBase * Kd * Kp * Ka * Kfl * Kdir * Kmf * Kfurn;
  const pricePerM2 = Math.max(0, Math.round(rawPricePerM2));
  const compsPrice = Math.max(0, Math.round(pricePerM2 * safeArea));

  // ── Method 2: Income Approach (if rent data available) ────────
  let incomeApproach: IncomeApproachResult | undefined;
  let reconciliation: AVMOutput['reconciliation'] | undefined;
  let totalPrice = compsPrice;

  if (monthlyRent && monthlyRent > 0) {
    incomeApproach = applyIncomeApproach(monthlyRent, compsPrice, pType);

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

  // ── Confidence Interval ───────────────────────────────────────
  const margin = getConfidenceMargin(effectiveConfidence);
  const rangeMin = Math.round(totalPrice * (1 - margin));
  const rangeMax = Math.round(totalPrice * (1 + margin));

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
  const formula = `${(effectiveBasePrice / 1_000_000).toFixed(0)} tr/m² × ${activeCoeffs.join(' × ')} = ${(pricePerM2 / 1_000_000).toFixed(0)} tr/m²`;

  return {
    marketBasePrice: effectiveBasePrice,
    pricePerM2,
    totalPrice,
    compsPrice,
    rangeMin,
    rangeMax,
    confidence: effectiveConfidence,
    marketTrend,
    factors,
    coefficients: { Kd, Kp, Ka, ...(Kfl_data && { Kfl }), ...(Kdir_data && { Kdir }), ...(Kmf_data && { Kmf }), ...(Kfurn_data && { Kfurn }) },
    formula,
    incomeApproach,
    reconciliation,
    sources,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. REGIONAL BASE PRICE TABLE (static fallback — no AI)
//    Unit: VNĐ/m² for standard reference property (Sổ Hồng, 4m road, 60-100m²)
// ─────────────────────────────────────────────────────────────────────────────
export function getRegionalBasePrice(address: string): {
  price: number;
  region: string;
  confidence: number;
} {
  const addr = address.toLowerCase();

  // TP.HCM
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

  // Hà Nội
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

  // Thành phố lớn khác
  if (/đà nẵng|da nang/i.test(addr)) return { price: 75_000_000, region: 'Đà Nẵng', confidence: 55 };
  if (/nha trang/i.test(addr)) return { price: 60_000_000, region: 'Nha Trang', confidence: 52 };
  if (/hải phòng|hai phong/i.test(addr)) return { price: 50_000_000, region: 'Hải Phòng', confidence: 52 };
  if (/cần thơ|can tho/i.test(addr)) return { price: 35_000_000, region: 'Cần Thơ', confidence: 50 };
  if (/long an|bình phước|đồng nai|dong nai/i.test(addr)) return { price: 30_000_000, region: 'Khu vực lân cận HCM', confidence: 48 };

  return { price: 25_000_000, region: 'Tỉnh/Thành khác', confidence: 42 };
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
