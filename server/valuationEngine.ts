/**
 * SGS Land — Vietnamese Real Estate Valuation Engine v2
 *
 * Three-method approach (industry standard):
 *
 *  Method 1 — AVM/Comps (Sales Comparison):
 *    P_adjusted/m² = P_market × Kd × Kp × Ka
 *    P_comps       = P_adjusted/m² × Area
 *    where P_market is the AI-researched median price for a STANDARD reference
 *    property (Sổ Hồng, 4m road, 60-100m²) in the target area.
 *
 *  Method 2 — Income Capitalization:
 *    NOI           = Effective Gross Income − Operating Expenses
 *    P_income      = NOI / Cap Rate
 *
 *  Method 3 — Reconciliation:
 *    P_final       = P_comps × W_comps + P_income × W_income
 *    where weights depend on property type and data availability.
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
}

export interface AVMFactor {
  label: string;
  coefficient: number;
  impact: number;
  isPositive: boolean;
  description: string;
  type: 'AVM' | 'LOCATION';
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
  coefficients: { Kd: number; Kp: number; Ka: number };
  formula: string;
  incomeApproach?: IncomeApproachResult;
  reconciliation?: {
    compsWeight: number;
    incomeWeight: number;
    compsValue: number;     // VNĐ
    incomeValue: number;    // VNĐ
    finalValue: number;     // VNĐ
  };
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
  const capRate = DEFAULT_CAP_RATES[propertyType];
  const grossIncomeTrieu = monthlyRent * 12;                     // triệu/năm
  const vacancyLossTrieu = grossIncomeTrieu * vacancyRate;
  const effectiveIncomeTrieu = grossIncomeTrieu * (1 - vacancyRate);
  const opexTrieu = grossIncomeTrieu * opexRate;
  const noiTrieu = effectiveIncomeTrieu - opexTrieu;             // triệu/năm

  // Convert to VNĐ for capital value
  const noiVND = noiTrieu * 1_000_000;
  const safeCapRate = capRate > 0 ? capRate : DEFAULT_CAP_RATE;
  const capitalValue = Math.round(noiVND / safeCapRate);

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
// 6. MAIN AVM + RECONCILIATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export function applyAVM(input: AVMInput): AVMOutput {
  const { marketBasePrice, area, roadWidth, legal, confidence, marketTrend, propertyType, monthlyRent } = input;

  const Kd_data = getKd(roadWidth);
  const Kp_data = getKp(legal);
  const Ka_data = getKa(area);

  const Kd = Kd_data.value;
  const Kp = Kp_data.value;
  const Ka = Ka_data.value;

  // ── Method 1: AVM/Comps ─────────────────────────────────────
  const safeArea = Math.max(1, area); // guard against zero/negative area
  const rawPricePerM2 = marketBasePrice * Kd * Kp * Ka;
  const pricePerM2 = Math.max(0, Math.round(rawPricePerM2)); // guard against negative
  const compsPrice = Math.max(0, Math.round(pricePerM2 * safeArea));

  // ── Method 2: Income Approach (if rent data available) ──────
  let incomeApproach: IncomeApproachResult | undefined;
  let reconciliation: AVMOutput['reconciliation'] | undefined;
  let totalPrice = compsPrice;

  const pType = propertyType || 'townhouse_center';

  if (monthlyRent && monthlyRent > 0) {
    incomeApproach = applyIncomeApproach(monthlyRent, compsPrice, pType);

    // ── Method 3: Reconciliation ─────────────────────────────
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

  // ── Confidence Interval (applied to final reconciled value) ──
  const margin = getConfidenceMargin(confidence);
  const rangeMin = Math.round(totalPrice * (1 - margin));
  const rangeMax = Math.round(totalPrice * (1 + margin));

  // ── Factors ──────────────────────────────────────────────────
  const factors: AVMFactor[] = [];

  const kdImpact = Math.round((Kd - 1.00) * 100);
  factors.push({
    label: Kd_data.label,
    coefficient: Kd,
    impact: Math.abs(kdImpact),
    isPositive: Kd >= 1.00,
    description: Kd_data.description,
    type: 'AVM'
  });

  const kpImpact = Math.round((Kp - 1.00) * 100);
  factors.push({
    label: Kp_data.label,
    coefficient: Kp,
    impact: Math.abs(kpImpact),
    isPositive: Kp >= 1.00,
    description: Kp_data.description,
    type: 'AVM'
  });

  const kaImpact = Math.round((Ka - 1.00) * 100);
  factors.push({
    label: Ka_data.label,
    coefficient: Ka,
    impact: Math.abs(kaImpact),
    isPositive: Ka >= 1.00,
    description: Ka_data.description,
    type: 'AVM'
  });

  const formula = `${(marketBasePrice / 1_000_000).toFixed(0)} tr/m² × Kd(${Kd}) × Kp(${Kp}) × Ka(${Ka}) = ${(pricePerM2 / 1_000_000).toFixed(0)} tr/m²`;

  return {
    marketBasePrice,
    pricePerM2,
    totalPrice,
    compsPrice,
    rangeMin,
    rangeMax,
    confidence,
    marketTrend,
    factors,
    coefficients: { Kd, Kp, Ka },
    formula,
    incomeApproach,
    reconciliation,
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
