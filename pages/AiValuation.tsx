
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { useTranslation } from '../services/i18n';
import { formatSmartPrice } from '../utils/textUtils';
import { aiService } from '../services/aiService';
import { db } from '../services/dbApi';
import { User } from '../types';


const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    SEARCH: <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    AI_CHIP: <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>,
    DATA: <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    LOCK: <svg className="w-12 h-12 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    HOME: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 01 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    LEGAL: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    ROAD: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    EDIT: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    RESET: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

// ─── AUTO-DETECT PROPERTY TYPE FROM ADDRESS / FREE-TEXT ───────────────────────
// Phân tích văn bản địa chỉ để tự nhận dạng loại BĐS.
// Ưu tiên: keyword mạnh (căn hộ, biệt thự) → keyword yếu (đất, nhà)
function detectPropertyTypeFromText(text: string): string | null {
    const t = text.toLowerCase();
    // Penthouse (priority over apartment)
    if (/penthouse|ph\s/i.test(t)) return 'penthouse';
    // Apartment — project names + generic keywords
    // NOTE: waterpoint, aqua city, swan park, izumi city = townhouse projects → excluded here
    if (/căn hộ|chung cư|apartment|vinhome|vinhomes|the sun|masteri|diamond|icon|botanica|river gate|gateway|sky |sunrise|estella|flora|richstar|sky garden|block [a-z]\d|tầng \d{2,}|p\d+\.\d+|m\d+\.\d+|imperia|celadon|akari|westgate|one |eaton|picity|tecco|goldmark|mipec|times city|season avenue|d'capitale/i.test(t))
        return 'apartment_center';
    if (/căn hộ ngoại|chung cư ngoại|căn hộ huyện|căn hộ bình dương|căn hộ đồng nai|căn hộ long an/i.test(t))
        return 'apartment_suburb';
    // Villa
    if (/biệt thự|villa\b|resort villa|compound villa/i.test(t)) return 'villa';
    // Shophouse
    if (/shophouse|shop house|nhà phố thương mại|mặt bằng kinh doanh/i.test(t)) return 'shophouse';
    // Warehouse / industrial
    if (/kho xưởng|nhà xưởng|warehouse|factory|xưởng sản xuất|logistics|kho hàng|kho lạnh/i.test(t)) return 'warehouse';
    // Office
    if (/văn phòng|office|tòa nhà vp|building vp/i.test(t)) return 'office';
    // Land types
    if (/đất nông nghiệp|đất rẫy|đất vườn|đất ao|đất ruộng|đất canh tác/i.test(t)) return 'land_agricultural';
    if (/đất kcn|khu công nghiệp|industrial park/i.test(t)) return 'land_industrial';
    if (/đất ngoại thành|đất huyện|đất ngoại ô|đất bình chánh|đất nhà bè|đất hóc môn|đất củ chi/i.test(t)) return 'land_suburban';
    if (/lô đất|đất nền|đất thổ cư|đất mặt tiền|đất sổ|đất ở/i.test(t)) return 'land_urban';
    // Off-plan project (priority before townhouse) — includes known project brands
    if (/dự án|off.plan|chưa bàn giao|off plan|căn hộ hình thành|nhà hình thành/i.test(t)) return 'project';
    // Known townhouse/villa suburban projects — detected BEFORE generic townhouse
    if (/aqua\s*city|aquacity|aqua\s*island|swan\s*park|izumi\s*city|waterpoint|novaworld|bien\s*hoa\s*new\s*city|la\s*maison|vinh\s*long\s*new\s*town/i.test(t)) return 'townhouse_suburb';
    // Townhouse
    if (/nhà phố ngoại|nhà ngoại thành|nhà huyện|nhà liền kề/i.test(t)) return 'townhouse_suburb';
    if (/nhà phố|nhà mặt tiền|nhà mặt phố|nhà phố nội|townhouse/i.test(t)) return 'townhouse_center';
    return null; // no detection
}

// Tên hiển thị loại BĐS (cho badge trên form)
const PROPERTY_TYPE_LABELS: Record<string, string> = {
    apartment_center:  'Căn hộ nội đô',
    apartment_suburb:  'Căn hộ ngoại ô',
    penthouse:         'Penthouse',
    villa:             'Biệt thự',
    shophouse:         'Shophouse',
    warehouse:         'Kho / Xưởng',
    office:            'Văn phòng',
    land_agricultural: 'Đất nông nghiệp',
    land_industrial:   'Đất KCN',
    land_suburban:     'Đất ngoại thành',
    land_urban:        'Đất thổ cư',
    project:           'Off-plan',
    townhouse_suburb:  'Nhà phố ngoại thành',
    townhouse_center:  'Nhà phố nội đô',
};

// --- GUEST QUOTA ---
const GUEST_DAILY_LIMIT = 1;
const GUEST_LS_KEY = 'sgs_guest_val';

interface GuestValRecord { count: number; date: string }

function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}
function readGuestVal(): GuestValRecord {
    try {
        const raw = localStorage.getItem(GUEST_LS_KEY);
        if (!raw) return { count: 0, date: todayStr() };
        const parsed: GuestValRecord = JSON.parse(raw);
        return parsed.date === todayStr() ? parsed : { count: 0, date: todayStr() };
    } catch {
        return { count: 0, date: todayStr() };
    }
}
function writeGuestVal(v: GuestValRecord): void {
    try { localStorage.setItem(GUEST_LS_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

// --- VALUATION HISTORY (localStorage) ---
const HISTORY_LS_KEY = 'sgs_val_history';
const HISTORY_MAX = 8;

interface ValuationHistoryItem {
    id: string;
    date: string;
    address: string;
    area: number;
    propertyType: string;
    legal: 'PINK_BOOK' | 'CONTRACT' | 'PENDING' | 'WAITING';
    totalPrice: number;
    pricePerM2: number;
    rangeMin: number;
    rangeMax: number;
    confidence: number;
    marketTrend: string;
}

function readHistory(): ValuationHistoryItem[] {
    try {
        const raw = localStorage.getItem(HISTORY_LS_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ValuationHistoryItem[];
    } catch { return []; }
}

function addToHistory(item: ValuationHistoryItem): void {
    try {
        const current = readHistory().filter(h => h.id !== item.id);
        const updated = [item, ...current].slice(0, HISTORY_MAX);
        localStorage.setItem(HISTORY_LS_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
}

function clearHistory(): void {
    try { localStorage.removeItem(HISTORY_LS_KEY); } catch { /* ignore */ }
}

// --- FORMAT TIỀN VIỆT NAM ---
// formatVND(6.5)   → "6,50 tỷ"
// formatVND(0.85)  → "850 triệu"
function formatVND(totalVnd: number): string {
    const ty = totalVnd / 1_000_000_000;
    if (ty >= 1) {
        const rounded = Math.round(ty * 100) / 100;
        return rounded.toFixed(2).replace('.', ',') + ' tỷ';
    }
    const trieu = Math.round(ty * 1000);
    return trieu.toLocaleString('vi-VN') + ' triệu';
}

function getConfidenceLevel(c: number): 'high' | 'med' | 'low' {
    return c >= 80 ? 'high' : c >= 70 ? 'med' : 'low';
}

// --- DYNAMIC AGENT STEPS (ghi nhận thông tin người dùng và xử lý theo từng agent) ---
interface AgentStep { icon: string; title: string; details: string[] }

// ─── Client-side region inference (mirrors server/valuationEngine.ts) ────────
function inferRegionClient(addr: string): { region: string; baseMRange: string; conf: number; streetHit: boolean } {
    const a = addr.toLowerCase();
    // Street / project overrides
    if (/aqua\s*city|aquacity/i.test(a))    return { region: 'Aqua City, Nhơn Trạch', baseMRange: '65–95M/m²', conf: 72, streetHit: true };
    if (/swan\s*park/i.test(a))             return { region: 'Swan Park, Nhơn Trạch', baseMRange: '45–65M/m²', conf: 68, streetHit: true };
    if (/izumi\s*city/i.test(a))            return { region: 'Izumi City, Biên Hòa', baseMRange: '45–65M/m²', conf: 68, streetHit: true };
    if (/waterpoint/i.test(a))              return { region: 'Waterpoint, Bến Lức', baseMRange: '35–55M/m²', conf: 65, streetHit: true };
    if (/novaworld.*phan|phan.*novaworld/i.test(a)) return { region: 'NovaWorld Phan Thiết', baseMRange: '35–55M/m²', conf: 62, streetHit: true };
    if (/nguyễn huệ|le loi|lê lợi|dong khoi|đồng khởi/i.test(a) && /quận 1|q\.?1/i.test(a))
        return { region: 'Trục Nguyễn Huệ/Đồng Khởi, Q.1', baseMRange: '350–550M/m²', conf: 70, streetHit: true };
    if (/vinhome[s]?\s*central\s*park|saigon\s*pearl/i.test(a)) return { region: 'VH Central Park, Bình Thạnh', baseMRange: '120–165M/m²', conf: 72, streetHit: true };
    if (/phú mỹ hưng|phu my hung/i.test(a)) return { region: 'Phú Mỹ Hưng, Q.7', baseMRange: '140–180M/m²', conf: 70, streetHit: true };
    if (/thảo điền|thao dien/i.test(a))     return { region: 'Thảo Điền, Thủ Đức', baseMRange: '150–210M/m²', conf: 68, streetHit: true };
    if (/vinhome[s]?\s*golden\s*river|ba son/i.test(a)) return { region: 'Vinhomes Golden River, Q.1', baseMRange: '200–300M/m²', conf: 68, streetHit: true };
    // District-level
    if (/quận 1\b|q\.?1\b/i.test(a))         return { region: 'Quận 1, TP.HCM', baseMRange: '220–340M/m²', conf: 62, streetHit: false };
    if (/quận 3\b|q\.?3\b/i.test(a))         return { region: 'Quận 3, TP.HCM', baseMRange: '160–240M/m²', conf: 62, streetHit: false };
    if (/quận 7\b|q\.?7\b/i.test(a))         return { region: 'Quận 7, TP.HCM', baseMRange: '120–180M/m²', conf: 62, streetHit: false };
    if (/bình thạnh|binh thanh/i.test(a))    return { region: 'Bình Thạnh, TP.HCM', baseMRange: '95–145M/m²', conf: 62, streetHit: false };
    if (/phú nhuận|phu nhuan/i.test(a))      return { region: 'Phú Nhuận, TP.HCM', baseMRange: '120–180M/m²', conf: 62, streetHit: false };
    if (/thủ đức|thu duc/i.test(a))          return { region: 'TP. Thủ Đức, TP.HCM', baseMRange: '60–100M/m²', conf: 60, streetHit: false };
    if (/quận 9\b|q\.?9\b/i.test(a))         return { region: 'Quận 9, TP.HCM', baseMRange: '60–90M/m²', conf: 60, streetHit: false };
    if (/quận 4\b|q\.?4\b/i.test(a))         return { region: 'Quận 4, TP.HCM', baseMRange: '100–160M/m²', conf: 62, streetHit: false };
    if (/quận 5\b|q\.?5\b/i.test(a))         return { region: 'Quận 5, TP.HCM', baseMRange: '110–170M/m²', conf: 62, streetHit: false };
    if (/quận 6\b|q\.?6\b/i.test(a))         return { region: 'Quận 6, TP.HCM', baseMRange: '70–110M/m²', conf: 60, streetHit: false };
    if (/quận 10\b|q\.?10\b/i.test(a))       return { region: 'Quận 10, TP.HCM', baseMRange: '130–200M/m²', conf: 62, streetHit: false };
    if (/quận 12\b|q\.?12\b/i.test(a))       return { region: 'Quận 12, TP.HCM', baseMRange: '50–80M/m²', conf: 60, streetHit: false };
    if (/tân bình|tan binh/i.test(a))        return { region: 'Tân Bình, TP.HCM', baseMRange: '80–120M/m²', conf: 62, streetHit: false };
    if (/gò vấp|go vap/i.test(a))            return { region: 'Gò Vấp, TP.HCM', baseMRange: '60–90M/m²', conf: 60, streetHit: false };
    if (/hcm|hồ chí minh|sài gòn|saigon/i.test(a)) return { region: 'TP.HCM (chung)', baseMRange: '70–130M/m²', conf: 52, streetHit: false };
    if (/hoàn kiếm|hoan kiem/i.test(a))      return { region: 'Hoàn Kiếm, Hà Nội', baseMRange: '240–360M/m²', conf: 62, streetHit: false };
    if (/ba đình|ba dinh/i.test(a))          return { region: 'Ba Đình, Hà Nội', baseMRange: '175–265M/m²', conf: 62, streetHit: false };
    if (/đống đa|dong da/i.test(a))          return { region: 'Đống Đa, Hà Nội', baseMRange: '145–215M/m²', conf: 62, streetHit: false };
    if (/cầu giấy|cau giay/i.test(a))        return { region: 'Cầu Giấy, Hà Nội', baseMRange: '95–145M/m²', conf: 60, streetHit: false };
    if (/tây hồ|tay ho/i.test(a))            return { region: 'Tây Hồ, Hà Nội', baseMRange: '105–160M/m²', conf: 60, streetHit: false };
    if (/hà nội|hanoi|ha noi/i.test(a))      return { region: 'Hà Nội (chung)', baseMRange: '80–140M/m²', conf: 52, streetHit: false };
    if (/đà nẵng|da nang/i.test(a))          return { region: 'Đà Nẵng', baseMRange: '50–100M/m²', conf: 57, streetHit: false };
    if (/nha trang/i.test(a))                return { region: 'Nha Trang, Khánh Hòa', baseMRange: '50–80M/m²', conf: 57, streetHit: false };
    if (/đà lạt|da lat/i.test(a))            return { region: 'Đà Lạt, Lâm Đồng', baseMRange: '35–55M/m²', conf: 57, streetHit: false };
    if (/vũng tàu|vung tau/i.test(a))        return { region: 'Vũng Tàu', baseMRange: '40–70M/m²', conf: 57, streetHit: false };
    if (/biên hòa|bien hoa/i.test(a))        return { region: 'Biên Hòa, Đồng Nai', baseMRange: '32–52M/m²', conf: 57, streetHit: false };
    if (/bình dương|binh duong/i.test(a))    return { region: 'Bình Dương', baseMRange: '35–65M/m²', conf: 57, streetHit: false };
    if (/cần thơ|can tho/i.test(a))          return { region: 'Cần Thơ', baseMRange: '25–45M/m²', conf: 53, streetHit: false };
    if (/phú quốc|phu quoc/i.test(a))        return { region: 'Phú Quốc, Kiên Giang', baseMRange: '60–100M/m²', conf: 57, streetHit: false };
    return { region: 'Khu vực đang tra cứu…', baseMRange: '—', conf: 42, streetHit: false };
}

// ─── Market sources by property segment ───────────────────────────────────────
function getMarketSources(pType: string): { primary: string; reports: string } {
    if (['warehouse', 'land_industrial'].includes(pType))
        return { primary: 'JLL Industrial · Savills Logistics · PropertyGuru Pro', reports: 'JLL Vietnam Industrial Q4/2025 · Savills Logistics VN' };
    if (pType === 'office')
        return { primary: 'CBRE Office · Savills Office · JLL Vietnam Office', reports: 'JLL Office Market Q1/2026 · CBRE Vietnam Q1/2026' };
    if (['land_urban', 'land_suburban', 'land_agricultural'].includes(pType))
        return { primary: 'batdongsan.com.vn · muaban.net · alonhadat.vn', reports: 'Savills Land Insight · CBRE Investment Q1/2026' };
    if (['shophouse', 'villa'].includes(pType))
        return { primary: 'batdongsan.com.vn · cen.vn · onehousing.vn', reports: 'Savills Residential · CBRE Vietnam Luxury Q1/2026' };
    if (['apartment_center', 'apartment_suburb', 'penthouse', 'project'].includes(pType))
        return { primary: 'batdongsan.com.vn · onehousing.vn · nha.vn', reports: 'Savills Apartment Q1/2026 · CBRE Vietnam Q1/2026' };
    return { primary: 'batdongsan.com.vn · cafeland.vn · cen.vn', reports: 'Savills · CBRE · JLL Vietnam Q1/2026' };
}

// ─── AVM coefficients with ACTUAL computed values ─────────────────────────────
function computeKd(roadM: number): { val: number; label: string } {
    if (roadM <= 2)  return { val: 0.78, label: `Kd=0.78 (hẻm≤2m)` };
    if (roadM <= 3)  return { val: 0.88, label: `Kd=0.88 (hẻm 3m)` };
    if (roadM <= 4)  return { val: 0.95, label: `Kd=0.95 (hẻm 4m)` };
    if (roadM <= 5)  return { val: 1.00, label: `Kd=1.00 (đường 5m)` };
    if (roadM <= 6)  return { val: 1.08, label: `Kd=1.08 (đường 6m)` };
    if (roadM <= 8)  return { val: 1.15, label: `Kd=1.15 (đường 8m)` };
    if (roadM <= 12) return { val: 1.22, label: `Kd=1.22 (đường 10-12m)` };
    return { val: 1.30, label: `Kd=1.30 (đại lộ ≥12m)` };
}
function computeKp(legal: string): string {
    if (legal === 'PINK_BOOK') return 'Kp=1.00 (Sổ Hồng đầy đủ)';
    if (legal === 'PENDING')   return 'Kp=0.92 (Đang làm sổ, −8%)';
    if (legal === 'CONTRACT')  return 'Kp=0.88 (HĐMB, khấu trừ 12%)';
    return 'Kp=0.80 (Vi Bằng/Giấy tay, rủi ro cao, −20%)';
}
function computeKa(aM2: number): string {
    if (aM2 < 30)   return `Ka=0.90 (DT nhỏ <30m², cộng trừ −10%)`;
    if (aM2 <= 60)  return `Ka=1.00 (DT chuẩn 30–60m²)`;
    if (aM2 <= 100) return `Ka=0.97 (DT 61–100m², −3% hiệu ứng kích thước)`;
    if (aM2 <= 200) return `Ka=0.94 (DT 101–200m², −6%)`;
    return `Ka=0.90 (DT lớn >200m², −10%)`;
}
function computeKdir(direction: string): string | null {
    const d = direction.toUpperCase();
    // Compound directions must be checked BEFORE single-word checks to avoid partial match
    if (d.includes('ĐÔNG') && d.includes('NAM'))  return 'Kdir=1.04 (Đông Nam — đón nắng sáng, thoáng gió)';
    if (d.includes('ĐÔNG') && d.includes('BẮC'))  return 'Kdir=0.98 (Đông Bắc — nắng sáng, hơi lạnh mùa đông)';
    if (d.includes('TÂY')  && d.includes('NAM'))  return 'Kdir=0.97 (Tây Nam — nắng chiều, hơi nóng)';
    if (d.includes('TÂY')  && d.includes('BẮC'))  return 'Kdir=0.97 (Tây Bắc — chiều nắng tây, nóng)';
    // Single directions
    if (d.includes('NAM'))   return 'Kdir=1.04 (Nam — đón gió, thoáng mát)';
    if (d.includes('ĐÔNG'))  return 'Kdir=1.00 (Đông — đón nắng sáng, chuẩn tham chiếu)';
    if (d.includes('TÂY'))   return 'Kdir=0.95 (Tây — nắng chiều tây, nóng)';
    if (d.includes('BẮC'))   return 'Kdir=0.96 (Bắc — ít nắng, tối và lạnh)';
    return null;
}
function computeKfl(floorN: number, pType: string): string | null {
    const isApt = ['apartment_center', 'apartment_suburb', 'penthouse', 'project'].includes(pType);
    if (!isApt) return null;
    if (floorN <= 5)   return `Kfl=1.00 (Tầng thấp 1–5)`;
    if (floorN <= 15)  return `Kfl=1.03 (Tầng trung 6–15)`;
    if (floorN <= 25)  return `Kfl=1.06 (Tầng cao 16–25, view tốt)`;
    return `Kfl=1.09 (Tầng cao >25, view panorama)`;
}
function computeKmf(mfM: number): string | null {
    if (mfM <= 0) return null;
    if (mfM < 3)   return `Kmf=0.90 (Mặt tiền <3m, hẻm nhỏ)`;
    if (mfM < 4)   return `Kmf=0.96 (Mặt tiền 3–4m)`;
    if (mfM < 6)   return `Kmf=1.00 (Mặt tiền 4–6m, chuẩn)`;
    if (mfM < 8)   return `Kmf=1.08 (Mặt tiền 6–8m, rộng)`;
    return `Kmf=1.15 (Mặt tiền ≥8m, tiền cảnh đẹp)`;
}
function computeKfurn(furn: string): string | null {
    if (furn === 'FULL')  return 'Kfurn=1.12 (Nội thất đầy đủ cao cấp)';
    if (furn === 'BASIC') return 'Kfurn=1.05 (Nội thất cơ bản)';
    if (furn === 'NONE')  return 'Kfurn=1.00 (Bàn giao thô)';
    return null;
}
function computeKage(ageY: number): string | null {
    if (ageY <= 0) return null;
    if (ageY <= 3)   return `Kage=1.00 (Nhà mới ≤3 năm)`;
    if (ageY <= 8)   return `Kage=0.96 (Nhà 4–8 năm, −4% khấu hao)`;
    if (ageY <= 15)  return `Kage=0.91 (Nhà 9–15 năm, −9%)`;
    if (ageY <= 25)  return `Kage=0.83 (Nhà 16–25 năm, −17%)`;
    return `Kage=0.74 (Nhà >25 năm, xuống cấp −26%)`;
}

// ─── Main builder ─────────────────────────────────────────────────────────────
function buildAgentSteps(
    addr: string, pType: string, areaM2: string, road: string, legalStatus: string,
    dir: string, mf: string, furn: string, fl: string, rent: string, age: string
): AgentStep[] {
    const ptLabel = PROPERTY_TYPE_LABELS[pType] || pType;
    const legalLabel = legalStatus === 'PINK_BOOK' ? 'Sổ Hồng' : legalStatus === 'CONTRACT' ? 'HĐMB' : legalStatus === 'PENDING' ? 'Đang làm sổ' : 'Vi Bằng';
    const shortAddr = addr.length > 46 ? addr.slice(0, 46) + '…' : addr;

    // ── Infer region & sources ──
    const region = inferRegionClient(addr);
    const sources = getMarketSources(pType);

    // ── Agent 1 details ──
    const a1Details: string[] = [
        `Địa chỉ: "${shortAddr}"`,
        `Loại BĐS: ${ptLabel}  ·  Pháp lý: ${legalLabel}`,
        `Diện tích: ${areaM2 || '—'}m²  ·  Lộ giới: ${road || '—'}m`,
    ];
    if (dir) a1Details.push(`Hướng cửa: ${dir}`);
    if (mf && !isNaN(parseFloat(mf))) a1Details.push(`Mặt tiền: ${mf}m`);
    if (furn) a1Details.push(`Nội thất: ${ furn === 'FULL' ? 'Đầy đủ cao cấp' : furn === 'BASIC' ? 'Cơ bản' : 'Bàn giao thô'}`);
    if (fl && !isNaN(parseFloat(fl))) a1Details.push(`Tầng ${fl}`);
    if (rent && !isNaN(parseFloat(rent))) a1Details.push(`Thuê dự kiến: ${rent} tr/tháng`);
    if (age && !isNaN(parseFloat(age))) a1Details.push(`Tuổi nhà: ${age} năm`);

    // ── Agent 2 details ──
    const a2Details: string[] = [
        `Khu vực: ${region.region}`,
        `Dải giá tham chiếu: ${region.baseMRange}`,
        region.streetHit
            ? `Dữ liệu: Giao dịch dự án thực tế Q1/2026 ✓`
            : `Độ tin cậy khu vực: ${region.conf}% (${region.conf >= 60 ? 'Đủ dữ liệu' : region.conf >= 50 ? 'Dữ liệu hạn chế' : 'Ít giao dịch'})`,
        `Nguồn: ${sources.primary}`,
        `Báo cáo: ${sources.reports}`,
        `Ưu tiên: Giao dịch thực tế > Rao bán > Ước tính`,
    ];

    // ── Agent 3 — compute coefficients ──
    const roadN = parseFloat(road) || 0;
    const areaN = parseFloat(areaM2) || 50;
    const mfN   = parseFloat(mf) || 0;
    const flN   = parseFloat(fl) || 0;
    const ageN  = parseFloat(age) || 0;
    const kd    = roadN > 0 ? computeKd(roadN) : null;
    const kdirStr = dir ? computeKdir(dir) : null;
    const kflStr  = flN > 0 ? computeKfl(flN, pType) : null;
    const kmfStr  = mfN > 0 ? computeKmf(mfN) : null;
    const kfurnStr = furn ? computeKfurn(furn) : null;
    const kageStr  = ageN > 0 ? computeKage(ageN) : null;
    const coeffLines: string[] = [
        kd ? kd.label : 'Kd=1.00 (Lộ giới chưa nhập)',
        computeKp(legalStatus),
        computeKa(areaN),
        ...(kdirStr ? [kdirStr] : []),
        ...(kflStr ? [kflStr] : []),
        ...(kmfStr ? [kmfStr] : []),
        ...(kfurnStr ? [kfurnStr] : []),
        ...(kageStr ? [kageStr] : []),
    ];
    // Method weighting
    const hasRent = rent && !isNaN(parseFloat(rent)) && parseFloat(rent) > 0;
    const isCommercial = ['office', 'warehouse', 'land_industrial', 'shophouse'].includes(pType);
    const isLand = ['land_urban', 'land_suburban', 'land_agricultural'].includes(pType);
    let methodLine: string;
    if (isLand)         methodLine = `Phương pháp: So Sánh 80%  +  Thặng Dư 20%`;
    else if (isCommercial) methodLine = `Phương pháp: Thu Nhập 55%  +  So Sánh 45%`;
    else if (hasRent)   methodLine = `Phương pháp: So Sánh 55%  +  Thu Nhập 45% (có dữ liệu thuê)`;
    else                methodLine = `Phương pháp: So Sánh 70%  +  Thu Nhập 30%`;

    const a3Details: string[] = [
        `${coeffLines.length} hệ số điều chỉnh:`,
        ...coeffLines,
        methodLine,
    ];

    // ── Agent 4 details ──
    const confBand = region.conf >= 65 ? '±5–8%' : region.conf >= 55 ? '±8–12%' : '±12–20%';
    const dataQuality = region.conf >= 60 ? 'Tốt' : region.conf >= 50 ? 'Trung bình' : 'Hạn chế';
    const a4Details: string[] = [
        `Khoảng tin cậy ước tính: ${confBand} (Dữ liệu khu vực: ${dataQuality})`,
        `Kiểm định bounds: ${region.baseMRange} theo ${region.region}`,
        isLand
            ? `Xác nhận: Phương pháp thặng dư + So sánh đất thuần`
            : isCommercial
            ? `Xác nhận: Cap rate thương mại VN 2026 (7–10%/năm)`
            : `Xác nhận: Comps thứ cấp + Yield nhà ở VN (3–5%/năm)`,
        `Hoàn thiện kết quả định giá…`,
    ];

    return [
        { icon: '🔍', title: 'Agent Nhận Diện BĐS', details: a1Details },
        { icon: '📡', title: 'Agent Dữ Liệu Thị Trường', details: a2Details },
        { icon: '⚙️', title: `Agent AVM — ${coeffLines.length} Hệ Số`, details: a3Details },
        { icon: '✅', title: 'Agent Tổng Hợp & Kiểm Định', details: a4Details },
    ];
}

export const AiValuation: React.FC = () => {
    const { t, formatCurrency } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [guestUsed, setGuestUsed] = useState(0);
    const [showGuestGate, setShowGuestGate] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [history, setHistory] = useState<ValuationHistoryItem[]>([]);

    // Feedback / RLHF states
    const [valuationId, setValuationId] = useState<string | null>(null);
    const [feedbackSent, setFeedbackSent] = useState(false);
    const [feedbackRating, setFeedbackRating] = useState<1 | -1 | null>(null);
    const [actualPriceInput, setActualPriceInput] = useState('');
    const [feedbackLoading, setFeedbackLoading] = useState(false);

    const notify = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        setHistory(readHistory());
        db.getCurrentUser().then((user) => {
            setCurrentUser(user);
            if (!user) {
                setGuestUsed(readGuestVal().count);
            }
        });
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;
    
    // Workflow State
    const [step, setStep] = useState<'ADDRESS' | 'DETAILS' | 'ANALYZING' | 'RESULT'>('ADDRESS');
    
    // Input State
    const [address, setAddress] = useState('');
    const [area, setArea] = useState<string>('');
    const [roadWidth, setRoadWidth] = useState<string>('');
    const [legal, setLegal] = useState<'PINK_BOOK' | 'CONTRACT' | 'PENDING' | 'WAITING'>('PINK_BOOK');
    const [propertyType, setPropertyType] = useState<string>('townhouse_center');
    const [autoDetectedType, setAutoDetectedType] = useState<string | null>(null); // null = user hasn't changed
    // Advanced AVM inputs (Kfl, Kdir, Kmf, Kfurn)
    const [direction, setDirection] = useState<string>('');
    const [frontageWidth, setFrontageWidth] = useState<string>('');
    const [furnishing, setFurnishing] = useState<'LUXURY' | 'FULL' | 'BASIC' | 'NONE' | ''>('');
    const [floorLevel, setFloorLevel] = useState<string>('');
    const [monthlyRent, setMonthlyRent] = useState<string>('');
    const [buildingAge, setBuildingAge] = useState<string>('');
    const [bedrooms, setBedrooms] = useState<number | null>(null);
    // Ngang × Dài calculator — auto-computes area & syncs frontageWidth
    const [ngang, setNgang] = useState<string>('');
    const [dai, setDai] = useState<string>('');
    // vi_tri_duong: road type select → maps to roadWidth number
    const [roadTypeSelect, setRoadTypeSelect] = useState<string>('');
    // nam_xay_dung: year built → derives buildingAge automatically
    const [yearBuilt, setYearBuilt] = useState<string>('');
    // inline validation
    const [addressError, setAddressError] = useState<string>('');
    const [areaError, setAreaError] = useState<string>('');
    // Typewriter placeholder animation
    const [typedPlaceholder, setTypedPlaceholder] = useState<string>('');
    const twIndexRef = React.useRef(0);
    const twCharRef  = React.useRef(0);
    const twEraseRef = React.useRef(false);
    const twTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const CURRENT_YEAR = new Date().getFullYear();

    const handleRoadTypeSelect = (id: string, width: number) => {
        setRoadTypeSelect(id);
        setRoadWidth(String(width));
    };

    const handleYearBuiltChange = (val: string) => {
        setYearBuilt(val);
        const y = parseInt(val);
        if (!isNaN(y) && y >= 1900 && y <= CURRENT_YEAR) {
            setBuildingAge(String(CURRENT_YEAR - y));
        } else {
            setBuildingAge('');
        }
    };

    const handleNgangChange = (val: string) => {
        setNgang(val);
        setFrontageWidth(val); // ngang = mặt tiền
        const n = parseFloat(val), d = parseFloat(dai);
        if (n > 0 && d > 0) setArea(String(Math.round(n * d)));
    };
    const handleDaiChange = (val: string) => {
        setDai(val);
        const n = parseFloat(ngang), d = parseFloat(val);
        if (n > 0 && d > 0) setArea(String(Math.round(n * d)));
    };

    const isApartment = propertyType.startsWith('apartment') || propertyType === 'penthouse';
    const isApartmentOrProject = isApartment || propertyType === 'project';

    // Live Accuracy Meter — increases as user fills in more details
    const accuracy = (() => {
        let s = 75.12;
        if (area && parseFloat(area) > 0)         s += 5.22;
        if (roadTypeSelect || (roadWidth && parseFloat(roadWidth) > 0)) s += 4.33;
        if (isApartmentOrProject && bedrooms !== null) s += 3.50;
        if (direction)                              s += 2.54;
        if (!isApartment && frontageWidth && parseFloat(frontageWidth) > 0) s += 3.34;
        if (!isApartment && ngang && dai && parseFloat(ngang) > 0 && parseFloat(dai) > 0) s += 1.50;
        if (isApartment && floorLevel && parseFloat(floorLevel) > 0)        s += 3.34;
        if (buildingAge !== '')                     s += 2.63;
        if (furnishing)                             s += 2.54;
        if (monthlyRent && parseFloat(monthlyRent) > 0) s += 4.29;
        return Math.min(s, 98);
    })();
    const accuracyLabel = accuracy < 80 ? 'Cơ bản' : accuracy < 88 ? 'Khá tốt' : accuracy < 95 ? 'Rất tốt' : 'Chuyên sâu';
    const accuracyColor = accuracy < 80 ? '#eab308' : accuracy < 88 ? '#f97316' : accuracy < 95 ? '#22c55e' : '#10b981';

    // Process State — agent-based
    const [agentStepsList, setAgentStepsList] = useState<AgentStep[]>([]);
    const [currentAgentIdx, setCurrentAgentIdx] = useState(0);
    const [progress, setProgress] = useState(0);

    // Results State
    const [valuation, setValuation] = useState<{
        price: number;
        compsPrice?: number;
        pricePerM2: number;
        range: [number, number];
        factors: { label: string; coefficient?: number; impact: number; isPositive: boolean; description?: string; type?: 'AVM' | 'LOCATION' }[];
        coefficients?: { Kd: number; Kp: number; Ka: number; Kfl?: number; Kdir?: number; Kmf?: number; Kfurn?: number };
        formula?: string;
        confidence: number;
        marketTrend: string;
        chartData: { month: string; price: number }[];
        isRealtime?: boolean;
        incomeApproach?: {
            monthlyRent: number; grossIncome: number; vacancyLoss: number;
            effectiveIncome: number; opex: number; noi: number;
            capRate: number; capitalValue: number;
            grossRentalYield: number; paybackYears: number;
        };
        reconciliation?: {
            compsWeight: number; incomeWeight: number;
            compsValue: number; incomeValue: number; finalValue: number;
        };
    } | null>(null);

    // Ref for interval cleanup
    const intervalRef = useRef<any>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyItems, setHistoryItems] = useState<ValuationHistoryItem[]>([]);
    const [breakdownOpen, setBreakdownOpen] = useState(false);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // --- TYPEWRITER PLACEHOLDER ANIMATION ---
    useEffect(() => {
        const MESSAGES = [
            'Nhập địa chỉ + đường + phường + tỉnh/thành phố',
            'Nhập loại BĐS + phường/xã + dự án + tên đường + tỉnh/thành phố',
            'Nhập loại BĐS + địa chỉ + tên đường + phường/xã + tỉnh/thành phố',
        ];
        const TYPE_SPEED  = 42;   // ms per char typing
        const ERASE_SPEED = 18;   // ms per char erasing
        const HOLD_MS     = 2200; // pause at full message

        const tick = () => {
            const msg   = MESSAGES[twIndexRef.current];
            const erase = twEraseRef.current;

            if (!erase) {
                // Typing forward
                twCharRef.current = Math.min(twCharRef.current + 1, msg.length);
                setTypedPlaceholder(msg.slice(0, twCharRef.current));
                if (twCharRef.current === msg.length) {
                    // Hold then start erasing
                    twTimerRef.current = setTimeout(() => {
                        twEraseRef.current = true;
                        twTimerRef.current = setTimeout(tick, ERASE_SPEED);
                    }, HOLD_MS);
                    return;
                }
            } else {
                // Erasing backward
                twCharRef.current = Math.max(twCharRef.current - 1, 0);
                setTypedPlaceholder(msg.slice(0, twCharRef.current));
                if (twCharRef.current === 0) {
                    // Move to next message
                    twEraseRef.current = false;
                    twIndexRef.current = (twIndexRef.current + 1) % MESSAGES.length;
                    twTimerRef.current = setTimeout(tick, TYPE_SPEED * 4);
                    return;
                }
            }

            twTimerRef.current = setTimeout(tick, erase ? ERASE_SPEED : TYPE_SPEED);
        };

        twTimerRef.current = setTimeout(tick, 600);
        return () => { if (twTimerRef.current) clearTimeout(twTimerRef.current); };
    }, []);

    // --- LOGIC: SIMULATE AVM CALCULATION ---
    const runCalculation = async () => {
        // Guest quota gate — check BEFORE switching to ANALYZING step
        if (!currentUser) {
            const v = readGuestVal();
            if (v.count >= GUEST_DAILY_LIMIT) {
                setShowGuestGate(true);
                return;
            }
        }

        if (intervalRef.current) clearInterval(intervalRef.current);
        // Reset feedback states for a new valuation
        setValuationId(null);
        setFeedbackSent(false);
        setFeedbackRating(null);
        setActualPriceInput('');
        setStep('ANALYZING');
        setProgress(0);
        setCurrentAgentIdx(0);

        // Build dynamic agent steps from current user inputs
        const steps = buildAgentSteps(
            address, propertyType, area, roadWidth, legal,
            direction, frontageWidth, furnishing, floorLevel, monthlyRent, buildingAge
        );
        setAgentStepsList(steps);

        // Advance agent cards every ~900ms while API call is in progress
        let agentTickCount = 0;
        intervalRef.current = setInterval(() => {
            agentTickCount++;
            setCurrentAgentIdx(Math.min(agentTickCount, steps.length - 1));
            setProgress(prev => Math.min(prev + Math.round(80 / steps.length), 90));
        }, 900);

        // Fetch real-time data from Gemini
        const areaNum = parseFloat(area) || 50;
        const roadNum = parseFloat(roadWidth) || 3;

        let aiResult: any;
        // Road type label for AI context (e.g. "Hẻm xe hơi (≥4m)")
        const roadTypeLabelMap: Record<string, string> = {
            alley_moto: 'Hẻm xe máy (<4m)',
            alley_car:  'Hẻm xe hơi (≥4m)',
            minor:      'Mặt tiền đường nhỏ (4–8m)',
            major:      'Mặt tiền đường lớn (>8m)',
            boulevard:  'Đại lộ / Trục chính (≥20m)',
        };
        const roadTypeLabel = roadTypeSelect ? roadTypeLabelMap[roadTypeSelect] || '' : '';
        // Collect optional advanced fields
        const advancedParams = {
            ...(direction && { direction }),
            ...(frontageWidth && !isNaN(parseFloat(frontageWidth)) && { frontageWidth: parseFloat(frontageWidth) }),
            ...(furnishing && { furnishing }),
            ...(floorLevel && !isNaN(parseFloat(floorLevel)) && { floorLevel: parseFloat(floorLevel) }),
            ...(buildingAge && !isNaN(parseFloat(buildingAge)) && { buildingAge: parseFloat(buildingAge) }),
            ...(monthlyRent && !isNaN(parseFloat(monthlyRent)) && { monthlyRent: parseFloat(monthlyRent) }),
            ...(bedrooms !== null && isApartmentOrProject && { bedrooms }),
            ...(roadTypeLabel && { roadTypeLabel }),
        };
        try {
            // All users (guest + auth) go through the full multi-source engine:
            // Redis cache → internal DB comparables (auth only) → 7-coefficient AVM
            aiResult = await aiService.getAdvancedValuation(address, areaNum, roadNum, legal, propertyType, advancedParams);
        } catch (_err: any) {
            // If this is a rate-limit (429) or quota error, show clear message and stop.
            // Do NOT run the offline fallback — it would show wrong prices.
            const errMsg: string = _err?.message || '';
            const isRateLimit = errMsg.includes('hết lượt') || errMsg.includes('hết 1 lượt') || errMsg.includes('hết 3 lượt') || errMsg.includes('Too many') || errMsg.includes('rate limit') || errMsg.includes('429');
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (isRateLimit) {
                setProgress(0);
                setStep('DETAILS');
                notify(errMsg || 'Bạn đã dùng hết lượt định giá miễn phí hôm nay. Đăng nhập để tiếp tục.', 'error');
                return;
            }

            // Emergency client-side fallback (network completely down or server error)
            // Uses same AVM coefficient logic as server/valuationEngine.ts
            notify(t('ai.error_valuation'), 'error');
            const addr = address.toLowerCase();

            // ── Premium project price overrides (match server/valuationEngine.ts) ──
            let streetBase: number | null = null;
            if (/aqua\s*city|aquacity/i.test(addr))          streetBase = 72_000_000;
            else if (/swan\s*park/i.test(addr))              streetBase = 52_000_000;
            else if (/\bizumi\b/i.test(addr))                streetBase = 55_000_000;
            else if (/waterpoint/i.test(addr))               streetBase = 45_000_000;
            else if (/novaworld/i.test(addr))                streetBase = 40_000_000;
            else if (/vinhome.*central.*park|saigon.*pearl/i.test(addr)) streetBase = 140_000_000;
            else if (/phú mỹ hưng|phu my hung/i.test(addr)) streetBase = 160_000_000;
            else if (/thảo điền|thao dien/i.test(addr))     streetBase = 180_000_000;
            else if (/vinhome.*golden.*river|ba.*son\b/i.test(addr)) streetBase = 250_000_000;

            // ── Regional base prices ──
            const isQ1 = /quận 1\b|q\.?1\b/.test(addr);
            const isHCM = /hcm|hồ chí minh|sài gòn|saigon|bình thạnh|thủ đức/.test(addr) || /quận [0-9]/.test(addr);
            const isHanoi = /hà nội|hanoi|cầu giấy|hoàn kiếm|đống đa|hai bà trưng|tây hồ/.test(addr);
            const isDanang = /đà nẵng|da nang/.test(addr);
            const isBienHoa = /biên hòa|bien hoa/i.test(addr);
            const isNhonTrach = /nhơn trạch|nhon trach/i.test(addr);
            const isDongNai = /đồng nai|dong nai/i.test(addr);
            const isBinhDuong = /bình dương|binh duong/i.test(addr);
            const isLongAn = /long an/i.test(addr);
            const regionalBase = isQ1 ? 280_000_000 : isHCM ? 100_000_000 : isHanoi ? 110_000_000 : isDanang ? 75_000_000
                : isBienHoa ? 42_000_000 : isNhonTrach ? 30_000_000 : isDongNai ? 35_000_000
                : isBinhDuong ? 38_000_000 : isLongAn ? 28_000_000 : 25_000_000;
            const marketBase = streetBase ?? regionalBase;

            // Kd: Road Width
            const Kd = roadNum >= 20 ? 1.30 : roadNum >= 12 ? 1.18 : roadNum >= 8 ? 1.10 :
                       roadNum >= 6 ? 1.05 : roadNum >= 4 ? 1.00 : roadNum >= 3 ? 0.90 :
                       roadNum >= 2 ? 0.80 : 0.70;
            // Kp: Legal
            const Kp = legal === 'PINK_BOOK' ? 1.00 : legal === 'PENDING' ? 0.92 : legal === 'CONTRACT' ? 0.88 : 0.80;
            // Ka: Area
            const Ka = areaNum < 25 ? 0.90 : areaNum < 40 ? 0.95 : areaNum < 60 ? 0.98 :
                       areaNum < 100 ? 1.00 : areaNum < 150 ? 1.03 : areaNum < 250 ? 1.06 : 1.10;

            const adjPerM2 = Math.round(marketBase * Kd * Kp * Ka);
            const total = adjPerM2 * areaNum;
            const margin = 0.25;
            const legalLabel = legal === 'PINK_BOOK' ? 'Sổ Hồng' : legal === 'CONTRACT' ? 'Hợp đồng mua bán' : legal === 'PENDING' ? 'Đang làm sổ' : 'Vi Bằng';

            aiResult = {
                basePrice: marketBase,
                pricePerM2: adjPerM2,
                totalPrice: total,
                rangeMin: Math.round(total * (1 - margin)),
                rangeMax: Math.round(total * (1 + margin)),
                confidence: 42,
                marketTrend: "Ước tính offline — không kết nối được server",
                coefficients: { Kd, Kp, Ka },
                formula: `${(marketBase/1_000_000).toFixed(0)} tr/m² × Kd(${Kd}) × Kp(${Kp}) × Ka(${Ka}) = ${(adjPerM2/1_000_000).toFixed(0)} tr/m²`,
                factors: [
                    { label: roadNum >= 4 ? `Hẻm xe hơi / đường ${roadNum}m` : `Hẻm hẹp ${roadNum}m`, coefficient: Kd, impact: Math.round(Math.abs(Kd - 1) * 100), isPositive: Kd >= 1, description: '', type: 'AVM' as const },
                    { label: legalLabel, coefficient: Kp, impact: Math.round(Math.abs(Kp - 1) * 100), isPositive: Kp >= 1, description: '', type: 'AVM' as const },
                    { label: `Diện tích ${areaNum}m²`, coefficient: Ka, impact: Math.round(Math.abs(Ka - 1) * 100), isPositive: Ka >= 1, description: '', type: 'AVM' as const },
                ]
            };
        }
        
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(100);
        setCurrentAgentIdx(999); // mark all agents as done
        
        setTimeout(() => {
            calculateResults(aiResult, areaNum, roadNum);
            setValuationId(aiResult.interactionId || null);
            setStep('RESULT');
            // Save to history
            const totalPrice: number = aiResult.totalPrice || Math.round((aiResult.pricePerM2 || aiResult.basePrice || 0) * areaNum);
            if (totalPrice > 0 && address) {
                const histItem: ValuationHistoryItem = {
                    id: `${Date.now()}`,
                    date: new Date().toISOString(),
                    address,
                    area: areaNum,
                    propertyType,
                    legal,
                    totalPrice,
                    pricePerM2: aiResult.pricePerM2 || aiResult.basePrice || 0,
                    rangeMin: aiResult.rangeMin || Math.round(totalPrice * 0.85),
                    rangeMax: aiResult.rangeMax || Math.round(totalPrice * 1.15),
                    confidence: aiResult.confidence || 75,
                    marketTrend: aiResult.marketTrend || '',
                };
                addToHistory(histItem);
                setHistory(readHistory());
            }
            // Increment guest daily usage counter after a successful valuation
            if (!currentUser) {
                const v = readGuestVal();
                const updated: GuestValRecord = { count: v.count + 1, date: todayStr() };
                writeGuestVal(updated);
                setGuestUsed(updated.count);
            }
        }, 500);
    };

    const calculateResults = (aiResult: any, areaNum: number, _roadNum: number) => {
        // Server returns fully computed AVM result.
        // totalPrice = pricePerM2 × area, already calculated by AVM engine server-side.
        const pricePerM2: number = aiResult.pricePerM2 || (aiResult.basePrice || 0);
        const totalPrice: number = aiResult.totalPrice || Math.round(pricePerM2 * areaNum);
        const confidence: number = aiResult.confidence || 98;

        // Use server's pre-computed range if available, otherwise use confidence margin
        const rangeMin: number = aiResult.rangeMin || (() => {
            const margin = confidence >= 95 ? 0.05 : confidence >= 88 ? 0.07 : confidence >= 78 ? 0.10 : confidence >= 68 ? 0.14 : confidence >= 55 ? 0.18 : 0.25;
            return Math.round(totalPrice * (1 - margin));
        })();
        const rangeMax: number = aiResult.rangeMax || (() => {
            const margin = confidence >= 95 ? 0.05 : confidence >= 88 ? 0.07 : confidence >= 78 ? 0.10 : confidence >= 68 ? 0.14 : confidence >= 55 ? 0.18 : 0.25;
            return Math.round(totalPrice * (1 + margin));
        })();

        const baseBillion = totalPrice / 1_000_000_000;
        // Parse annual growth % from marketTrend text (server does not return trendGrowthPct directly)
        const trendText = (aiResult.marketTrend || '').toLowerCase();
        const trendMatch = trendText.match(/tăng[^\d]*(\d+)/) || trendText.match(/(\d+)\s*%[^(]*tăng/) || trendText.match(/(\d+)%/);
        const rawGrowthPct = trendMatch ? parseInt(trendMatch[1], 10) : 0;
        // Cap: 0% growth → use 5% minimum so chart is never a flat line; cap at 40% to avoid outliers
        const growthPct = Math.min(40, rawGrowthPct > 0 ? rawGrowthPct : 5);
        const monthlyGrowth = growthPct / 100 / 12;
        const now = new Date();
        const chartData = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
            const monthLabel = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
            const monthsFromNow = i - 11;  // negative = past months, 0 = current month (i=11)
            // Compound growth formula: price * (1 + r)^n
            const factor = Math.pow(1 + monthlyGrowth, monthsFromNow);
            return {
                month: monthLabel,
                price: Number((baseBillion * factor).toFixed(3))
            };
        });

        setValuation({
            price: totalPrice,
            compsPrice: aiResult.compsPrice,
            pricePerM2,
            range: [rangeMin, rangeMax],
            factors: aiResult.factors || [],
            coefficients: aiResult.coefficients,
            formula: aiResult.formula,
            confidence,
            marketTrend: aiResult.marketTrend || 'Đang cập nhật',
            chartData,
            isRealtime: aiResult.isRealtime ?? true,
            incomeApproach: aiResult.incomeApproach,
            reconciliation: aiResult.reconciliation,
        });

        // Save to localStorage history
        const histItem: ValuationHistoryItem = {
            id: Date.now().toString(),
            date: new Date().toLocaleString('vi-VN'),
            address,
            area: areaNum,
            propertyType,
            legal: legal as ValuationHistoryItem['legal'],
            totalPrice,
            pricePerM2,
            rangeMin,
            rangeMax,
            confidence,
            marketTrend: aiResult.marketTrend || '',
        };
        addToHistory(histItem);
        setHistoryItems(readHistory());
    };

    const handleAdjustParams = () => {
        setStep('DETAILS');
    };

    const handleNewValuation = () => {
        setAddress('');
        setArea('');
        setRoadWidth('');
        setPropertyType('townhouse_center');
        setLegal('PINK_BOOK');
        setAutoDetectedType(null);
        setDirection('');
        setFrontageWidth('');
        setFurnishing('');
        setFloorLevel('');
        setMonthlyRent('');
        setBuildingAge('');
        setBedrooms(null);
        setNgang('');
        setDai('');
        setRoadTypeSelect('');
        setYearBuilt('');
        setAddressError('');
        setAreaError('');
        setValuation(null);
        setValuationId(null);
        setFeedbackSent(false);
        setFeedbackRating(null);
        setActualPriceInput('');
        setStep('ADDRESS');
    };

    return (
        <>
        <div className="min-h-screen bg-slate-900 font-sans text-white pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-slate-900/80 backdrop-blur-md z-50 border-b border-slate-800">
                <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-2">
                    <button onClick={handleHome} className="flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-white transition-colors min-h-[44px] shrink-0">
                        {ICONS.BACK} <span className="hidden sm:inline">{t('common.go_back')}</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <Logo className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0" />
                        <span className="font-bold text-sm sm:text-lg tracking-wider hidden sm:inline truncate">SGS <span className="text-emerald-400">ĐỊNH GIÁ AI™</span></span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {!currentUser && (
                            <span
                                className={`hidden sm:inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border cursor-default select-none transition-colors ${
                                    guestUsed >= GUEST_DAILY_LIMIT
                                        ? 'bg-rose-900/40 border-rose-700/50 text-rose-300'
                                        : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}
                                title="Lượt định giá miễn phí trong ngày"
                            >
                                {guestUsed >= GUEST_DAILY_LIMIT
                                    ? 'Hết lượt hôm nay'
                                    : `Còn ${GUEST_DAILY_LIMIT - guestUsed}/${GUEST_DAILY_LIMIT} lượt`}
                            </span>
                        )}
                        <button onClick={handleLogin} className="px-3 sm:px-6 py-2 bg-emerald-500 text-[var(--text-primary)] font-bold rounded-xl hover:bg-emerald-400 transition-colors shadow-lg active:scale-95 text-xs sm:text-sm min-h-[44px] whitespace-nowrap">
                            {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="max-w-4xl mx-auto px-6 pt-16 md:pt-24 relative">
                
                {/* BACKGROUND FX */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                {/* STEP INDICATOR */}
                {step !== 'RESULT' && (
                    <div className="flex items-center justify-center gap-2 mb-10">
                        {[
                            { key: 'ADDRESS',   label: 'Địa chỉ',  num: 1 },
                            { key: 'DETAILS',   label: 'Chi tiết', num: 2 },
                            { key: 'ANALYZING', label: 'Phân tích',num: 3 },
                        ].map(({ key, label, num }, i, arr) => {
                            const stepOrder: Record<string, number> = { ADDRESS: 1, DETAILS: 2, ANALYZING: 3, RESULT: 4 };
                            const currentNum = stepOrder[step] ?? 1;
                            const isDone    = currentNum > num;
                            const isActive  = currentNum === num;
                            return (
                                <React.Fragment key={key}>
                                    <div className="flex flex-col items-center gap-1">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-300 ${
                                            isDone    ? 'bg-emerald-500 border-emerald-500 text-white' :
                                            isActive  ? 'bg-slate-800 border-emerald-500 text-emerald-400' :
                                                        'bg-slate-800/50 border-slate-700 text-slate-600'
                                        }`}>
                                            {isDone ? (
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : num}
                                        </div>
                                        <span className={`text-[10px] font-bold transition-colors ${isActive ? 'text-emerald-400' : isDone ? 'text-emerald-600' : 'text-slate-600'}`}>{label}</span>
                                    </div>
                                    {i < arr.length - 1 && (
                                        <div className={`w-12 md:w-20 h-0.5 mb-4 rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {/* STEP 1: ADDRESS INPUT */}
                {step === 'ADDRESS' && (
                    <div className="text-center animate-enter">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Định Giá Thời Gian Thực
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
                            Định Giá Bất Động Sản <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Bằng AI — Sai Số ±5–12%</span>
                        </h1>
                        <p className="text-xl text-slate-400 mb-5 max-w-2xl mx-auto">
                            Nhập địa chỉ — AI phân tích dữ liệu thị trường thực tế. Càng điền đầy đủ, sai số càng nhỏ.
                        </p>

                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-2 rounded-2xl max-w-2xl mx-auto flex items-center gap-1 md:gap-2 shadow-2xl relative z-20 group focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all mt-3">
                            <div className="pl-3 md:pl-4 shrink-0 text-slate-400 flex items-center justify-center">{ICONS.SEARCH}</div>
                            <input 
                                value={address}
                                onChange={(e) => { setAddress(e.target.value); setAutoDetectedType(null); }}
                                className="flex-1 min-w-0 bg-transparent border-none outline-none text-white placeholder:text-slate-500 text-base md:text-lg h-14"
                                placeholder={typedPlaceholder}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && address) {
                                        const detected = detectPropertyTypeFromText(address);
                                        if (detected) { setPropertyType(detected); setAutoDetectedType(detected); }
                                        setStep('DETAILS');
                                    }
                                }}
                                autoFocus
                            />
                            {address && (
                                <button 
                                    onClick={() => { setAddress(''); setAutoDetectedType(null); }}
                                    className="shrink-0 text-slate-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-slate-700 flex items-center justify-center"
                                    title={t('common.clear_search')}
                                >
                                    {ICONS.X}
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    const trimmed = address.trim();
                                    if (trimmed.length < 10) {
                                        setAddressError('Vui lòng nhập địa chỉ đầy đủ (tối thiểu 10 ký tự, ghi rõ phường/quận/thành phố)');
                                        return;
                                    }
                                    setAddressError('');
                                    const detected = detectPropertyTypeFromText(address);
                                    if (detected) { setPropertyType(detected); setAutoDetectedType(detected); }
                                    setStep('DETAILS');
                                }}
                                disabled={!address}
                                className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-[var(--text-primary)] font-bold px-5 md:px-8 h-12 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm md:text-base"
                            >
                                Định Giá →
                            </button>
                        </div>

                        {addressError && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-rose-400 max-w-2xl mx-auto px-1">
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                {addressError}
                            </div>
                        )}

                        {/* Quick-search examples */}
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            {[
                                'Căn hộ Vinhomes Grand Park TP.Thủ Đức',
                                'Nhà phố dự án Aqua City, Biên Hòa, Đồng Nai',
                                'Biệt thự Sala Đại Quang Minh, TP.Thủ Đức',
                                'Đất nền Long Thành, Đồng Nai',
                            ].map(ex => (
                                <button
                                    key={ex}
                                    onClick={() => { setAddress(ex); const d = detectPropertyTypeFromText(ex); if (d) { setPropertyType(d); setAutoDetectedType(d); } }}
                                    className="text-xs text-slate-500 hover:text-emerald-400 border border-slate-700/60 hover:border-emerald-500/40 bg-slate-800/40 hover:bg-emerald-500/5 px-3 py-1.5 rounded-full transition-all"
                                >
                                    {ex}
                                </button>
                            ))}
                        </div>

                        {/* Hint strip below search */}
                        <div className="mt-5 flex items-center justify-center gap-4 md:gap-6 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                                Địa chỉ → <b className="text-yellow-400">75%</b>
                            </span>
                            <span className="text-slate-700">→</span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                                + Chi tiết → <b className="text-orange-400">90%</b>
                            </span>
                            <span className="text-slate-700">→</span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                + Đầy đủ → <b className="text-emerald-400">98%</b>
                            </span>
                        </div>

                        {/* Valuation History */}
                        {history.length > 0 && (
                            <div className="mt-14 text-left max-w-2xl mx-auto">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Lịch sử định giá</h3>
                                    <button
                                        onClick={() => { clearHistory(); setHistory([]); }}
                                        className="text-xs text-slate-600 hover:text-rose-400 transition-colors"
                                    >
                                        Xóa tất cả
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {history.map((h) => {
                                        const legalLabel = h.legal === 'PINK_BOOK' ? 'Sổ Hồng' : h.legal === 'CONTRACT' ? 'HĐMB' : h.legal === 'PENDING' ? 'Đang làm sổ' : 'Vi Bằng';
                                        const ptLabel = PROPERTY_TYPE_LABELS[h.propertyType] || h.propertyType;
                                        const dateStr = new Date(h.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                                        return (
                                            <button
                                                key={h.id}
                                                onClick={() => {
                                                    setAddress(h.address);
                                                    setArea(String(h.area));
                                                    setLegal(h.legal);
                                                    setPropertyType(h.propertyType);
                                                    setAutoDetectedType(null);
                                                    setNgang('');
                                                    setDai('');
                                                    setFrontageWidth('');
                                                    const detected = detectPropertyTypeFromText(h.address);
                                                    if (detected) setAutoDetectedType(detected);
                                                    setStep('DETAILS');
                                                }}
                                                className="w-full flex items-center gap-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/30 rounded-2xl px-4 py-3 text-left transition-all group"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-sm text-white truncate group-hover:text-emerald-300 transition-colors">{h.address}</div>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-xs text-slate-500">{h.area}m²</span>
                                                        <span className="text-slate-700">·</span>
                                                        <span className="text-xs text-slate-500">{ptLabel}</span>
                                                        <span className="text-slate-700">·</span>
                                                        <span className="text-xs text-slate-500">{legalLabel}</span>
                                                        <span className="text-slate-700">·</span>
                                                        <span className="text-xs text-slate-600">{dateStr}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="font-black text-emerald-400 text-base tabular-nums">
                                                        {(h.totalPrice / 1_000_000_000).toFixed(2)} tỷ
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {(h.pricePerM2 / 1_000_000).toFixed(0)} tr/m²
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: DETAIL INPUT (THE REFINEMENT LAYER) */}
                {step === 'DETAILS' && (
                    <div className="max-w-xl mx-auto animate-enter">
                        <div className="bg-slate-800 rounded-[32px] border border-slate-700 p-8 shadow-2xl">

                            {/* ── LIVE ACCURACY METER ── */}
                            <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 mb-7">
                                <div className="flex items-end justify-between mb-2">
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">Độ đầy đủ thông tin</div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black tabular-nums transition-all duration-500" style={{ color: accuracyColor }}>
                                                {accuracy.toFixed(1)}%
                                            </span>
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full border transition-all duration-300"
                                                style={{ color: accuracyColor, borderColor: accuracyColor + '40', background: accuracyColor + '18' }}>
                                                {accuracyLabel}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs text-slate-500">
                                        <div>Tối đa</div>
                                        <div className="font-bold text-emerald-400">98%</div>
                                    </div>
                                </div>
                                {/* Progress bar */}
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${accuracy}%`, background: `linear-gradient(90deg, #eab308, ${accuracyColor})` }}
                                    />
                                </div>
                                <div className="mt-2 text-xs text-slate-500">
                                    {accuracy < 98
                                        ? `Điền thêm ${accuracy < 80 ? (isApartmentOrProject ? 'diện tích, vị trí đường, số phòng ngủ' : 'diện tích, vị trí đường, ngang × dài') : accuracy < 88 ? (isApartmentOrProject && bedrooms === null ? 'số phòng ngủ, hướng nhà' : 'hướng nhà, mặt tiền') : accuracy < 95 ? 'năm xây dựng, nội thất' : 'thuê dự kiến'} để thu hẹp sai số`
                                        : '✓ Dữ liệu đầy đủ — AI định giá với sai số ±5%!'}
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Address Readonly + Auto-Detect Badge */}
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex items-center gap-3">
                                    <div className="text-emerald-500">{ICONS.SEARCH}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-slate-300 font-medium">{address}</div>
                                        {autoDetectedType && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                                                    Tự nhận dạng: {PROPERTY_TYPE_LABELS[autoDetectedType] ?? autoDetectedType}
                                                </span>
                                                <button
                                                    onClick={() => setAutoDetectedType(null)}
                                                    className="text-xs text-slate-500 hover:text-slate-300"
                                                    title="Xoá nhận dạng tự động"
                                                >✕</button>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => { setStep('ADDRESS'); setAutoDetectedType(null); setNgang(''); setDai(''); }} className="text-xs font-bold text-emerald-400 hover:underline shrink-0">Sửa</button>
                                </div>

                                {/* Inputs */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    {/* ── Diện Tích với placeholder thông minh theo loại ── */}
                                    {(() => {
                                        const isLandType = propertyType.startsWith('land_');
                                        let areaPlaceholder = '50';
                                        let areaLabel = 'Diện Tích (m²)';
                                        let areaPresets: number[] = [40, 60, 80, 120];
                                        if (isApartment) {
                                            areaPlaceholder = '70';
                                            areaLabel = 'Diện Tích Căn hộ (m²)';
                                            areaPresets = [45, 65, 85, 110];
                                        } else if (propertyType === 'villa') {
                                            areaPlaceholder = '200';
                                            areaLabel = 'Diện Tích Biệt thự (m²)';
                                            areaPresets = [120, 200, 350, 500];
                                        } else if (propertyType === 'warehouse') {
                                            areaPlaceholder = '500';
                                            areaLabel = 'Diện Tích Xưởng / Kho (m²)';
                                            areaPresets = [200, 500, 1000, 2000];
                                        } else if (propertyType === 'office') {
                                            areaPlaceholder = '100';
                                            areaLabel = 'Diện Tích Sàn VP (m²)';
                                            areaPresets = [50, 100, 200, 500];
                                        } else if (isLandType) {
                                            areaPlaceholder = '200';
                                            areaLabel = 'Diện Tích Đất (m²)';
                                            areaPresets = [100, 200, 500, 1000];
                                        } else if (propertyType === 'project') {
                                            areaPresets = [45, 65, 85, 110];
                                        }
                                        return (
                                            <div>
                                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">{areaLabel} <span className="text-rose-400 font-black">*</span></label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        value={area}
                                                        onChange={e => {
                                                            setArea(e.target.value);
                                                            const v = parseFloat(e.target.value);
                                                            if (isNaN(v) || v <= 0) setAreaError('');
                                                            else if (v < 15) setAreaError('Diện tích tối thiểu 15m²');
                                                            else if (v > 50000) setAreaError('Diện tích tối đa 50,000m²');
                                                            else setAreaError('');
                                                        }}
                                                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all ${areaError ? 'border-rose-500/70' : 'border-slate-700'}`}
                                                        placeholder={areaPlaceholder}
                                                        min="1"
                                                        autoFocus
                                                    />
                                                    <div className="absolute right-4 inset-y-0 flex items-center pointer-events-none text-[var(--text-tertiary)] text-sm">{ICONS.HOME}</div>
                                                </div>
                                                {areaError && (
                                                    <div className="text-rose-400 text-xs mt-1 flex items-center gap-1">
                                                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                                        {areaError}
                                                    </div>
                                                )}
                                                <div className="flex gap-1.5 mt-2 flex-wrap">
                                                    {areaPresets.map(v => (
                                                        <button key={v} type="button" onClick={() => setArea(String(v))}
                                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all ${area === String(v) ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'}`}>
                                                            {v}m²
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* ── Vị Trí Đường (vi_tri_duong) ── */}
                                    {(() => {
                                        const isLargeRoadType = isApartment || propertyType === 'office' || propertyType === 'warehouse';
                                        const roadOptions = isLargeRoadType
                                            ? [
                                                { id: 'internal_small', label: 'Đường nội khu nhỏ', hint: '≤6m',   width: 5  },
                                                { id: 'internal_large', label: 'Đường nội khu lớn', hint: '8–12m',  width: 10 },
                                                { id: 'major',          label: 'Đường phố lớn',     hint: '≥12m',  width: 15 },
                                                { id: 'boulevard',      label: 'Đại lộ / Trục chính',hint: '≥20m', width: 25 },
                                              ]
                                            : [
                                                { id: 'alley_moto', label: 'Hẻm xe máy',           hint: '<4m',   width: 2.5 },
                                                { id: 'alley_car',  label: 'Hẻm xe hơi',           hint: '≥4m',  width: 4   },
                                                { id: 'minor',      label: 'Mặt tiền đường nhỏ',   hint: '4–8m',  width: 6   },
                                                { id: 'major',      label: 'Mặt tiền đường lớn',   hint: '>8m',   width: 10  },
                                              ];
                                        const roadLabel = isLargeRoadType
                                            ? (propertyType === 'warehouse' ? 'Đường trước Kho' : 'Đường vào Tòa Nhà')
                                            : 'Vị Trí Đường';
                                        return (
                                            <div>
                                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">
                                                    {roadLabel} <span className="text-rose-400 font-black">*</span>
                                                    <span className="text-slate-600 normal-case font-normal ml-1">— ảnh hưởng đến giá</span>
                                                </label>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {roadOptions.map(opt => (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            onClick={() => handleRoadTypeSelect(opt.id, opt.width)}
                                                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                                                roadTypeSelect === opt.id
                                                                    ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                                                                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-sky-500/50 hover:text-slate-200'
                                                            }`}
                                                        >
                                                            <span className="truncate pr-1">{opt.label}</span>
                                                            <span className={`text-[10px] shrink-0 font-bold ${roadTypeSelect === opt.id ? 'text-sky-400' : 'text-slate-600'}`}>{opt.hint}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                                {roadTypeSelect ? (
                                                    <div className="flex items-center gap-1.5 mt-2 text-xs text-sky-400/80">
                                                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        Lộ giới tương đương {roadWidth}m
                                                        <button type="button" onClick={() => { const v = prompt('Nhập lộ giới chính xác (m):', roadWidth); if (v && !isNaN(parseFloat(v))) setRoadWidth(v); }} className="ml-1 text-sky-500 underline underline-offset-2 hover:text-sky-400">Chỉnh lại</button>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-slate-600 mt-1.5 italic">Chọn loại đường để AI tính hệ số vị trí</div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* ── NGANG × DÀI CALCULATOR — chỉ hiện với nhà đất (không phải căn hộ) ── */}
                                {!isApartment && (
                                    <div className="bg-slate-900/50 border border-slate-700/60 rounded-2xl p-4">
                                        <div className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
                                            Kích Thước (Ngang × Dài)
                                            <span className="text-slate-600 normal-case font-normal ml-1">— tự động tính diện tích</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="number"
                                                    value={ngang}
                                                    onChange={e => handleNgangChange(e.target.value)}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-center focus:border-emerald-500 outline-none transition-all"
                                                    placeholder="Ngang (m)"
                                                    min="1"
                                                    step="0.1"
                                                />
                                                <div className="text-center text-xs text-slate-600 mt-1">Chiều ngang</div>
                                            </div>
                                            <div className="text-slate-500 font-bold text-lg select-none pb-4">×</div>
                                            <div className="flex-1">
                                                <input
                                                    type="number"
                                                    value={dai}
                                                    onChange={e => handleDaiChange(e.target.value)}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-center focus:border-emerald-500 outline-none transition-all"
                                                    placeholder="Dài (m)"
                                                    min="1"
                                                    step="0.1"
                                                />
                                                <div className="text-center text-xs text-slate-600 mt-1">Chiều dài</div>
                                            </div>
                                            <div className="text-slate-500 font-bold text-lg select-none pb-4">=</div>
                                            <div className="flex-1 text-center pb-4">
                                                {ngang && dai && parseFloat(ngang) > 0 && parseFloat(dai) > 0 ? (
                                                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                                                        <span className="text-emerald-400 font-black text-lg">
                                                            {Math.round(parseFloat(ngang) * parseFloat(dai))}
                                                        </span>
                                                        <span className="text-emerald-500/70 text-xs font-bold"> m²</span>
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                                                        <span className="text-slate-600 text-sm">? m²</span>
                                                    </div>
                                                )}
                                                <div className="text-center text-xs text-slate-600 mt-1">Diện tích</div>
                                            </div>
                                        </div>
                                        {ngang && dai && parseFloat(ngang) > 0 && parseFloat(dai) > 0 && (
                                            <div className="flex items-center gap-2 mt-2.5 text-xs text-emerald-400/80">
                                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                Đã cập nhật Diện Tích ({Math.round(parseFloat(ngang) * parseFloat(dai))}m²) và Mặt Tiền ({parseFloat(ngang)}m)
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">Tình Trạng Pháp Lý <span className="text-rose-400 font-black">*</span></label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'PINK_BOOK', label: 'Sổ Hồng / Sổ Đỏ', badge: 'Đầy đủ', badgeColor: 'text-emerald-400' },
                                            { id: 'PENDING',   label: 'Đang làm sổ',      badge: '-8%',     badgeColor: 'text-sky-400',    title: 'Đang trong quá trình cấp sổ — rủi ro thấp' },
                                            { id: 'CONTRACT',  label: 'HĐ Mua Bán',        badge: '-12%',    badgeColor: 'text-yellow-400' },
                                            { id: 'WAITING',   label: 'Vi Bằng / Giấy tay', badge: '-20%',   badgeColor: 'text-rose-400',   title: 'Chưa có sổ / vi bằng — rủi ro cao' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setLegal(opt.id as any)}
                                                title={opt.title}
                                                className={`py-2.5 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-0.5 ${legal === opt.id ? 'bg-emerald-500 text-[var(--text-primary)] border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}
                                            >
                                                <span>{opt.label}</span>
                                                <span className={`text-[10px] font-bold ${legal === opt.id ? 'text-white/70' : opt.badgeColor}`}>{opt.badge}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-3">Loại Bất Động Sản</label>

                                    {/* Nhóm: Nhà ở */}
                                    <div className="text-xs text-slate-600 font-bold uppercase tracking-widest mb-2">Nhà ở</div>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        {[
                                            { id: 'townhouse_center', label: 'Nhà phố nội đô' },
                                            { id: 'townhouse_suburb', label: 'Nhà phố ngoại thành' },
                                            { id: 'villa', label: 'Biệt thự' },
                                            { id: 'apartment_center', label: 'Căn hộ trung tâm' },
                                            { id: 'apartment_suburb', label: 'Căn hộ ngoại ô' },
                                            { id: 'penthouse', label: 'Penthouse' },
                                        ].map(opt => (
                                            <button key={opt.id} onClick={() => { setPropertyType(opt.id); setAutoDetectedType(null); }}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-left leading-tight ${propertyType === opt.id ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-indigo-500/50'}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Nhóm: Thương mại & Công nghiệp */}
                                    <div className="text-xs text-slate-600 font-bold uppercase tracking-widest mb-2">Thương mại & Công nghiệp</div>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        {[
                                            { id: 'shophouse', label: 'Shophouse' },
                                            { id: 'office', label: 'Văn phòng' },
                                            { id: 'warehouse', label: 'Nhà xưởng / Kho' },
                                        ].map(opt => (
                                            <button key={opt.id} onClick={() => { setPropertyType(opt.id); setAutoDetectedType(null); }}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-left leading-tight ${propertyType === opt.id ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-indigo-500/50'}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Nhóm: Đất */}
                                    <div className="text-xs text-slate-600 font-bold uppercase tracking-widest mb-2">Đất</div>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        {[
                                            { id: 'land_urban', label: 'Đất thổ cư nội đô' },
                                            { id: 'land_suburban', label: 'Đất thổ cư ngoại thành' },
                                            { id: 'land_agricultural', label: 'Đất nông nghiệp' },
                                            { id: 'land_industrial', label: 'Đất khu công nghiệp' },
                                        ].map(opt => (
                                            <button key={opt.id} onClick={() => { setPropertyType(opt.id); setAutoDetectedType(null); }}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-left leading-tight ${propertyType === opt.id ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-indigo-500/50'}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Nhóm: Dự án */}
                                    <div className="text-xs text-slate-600 font-bold uppercase tracking-widest mb-2">Dự án</div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[
                                            { id: 'project', label: 'Dự án / Căn hộ off-plan (chưa bàn giao)' },
                                        ].map(opt => (
                                            <button key={opt.id} onClick={() => { setPropertyType(opt.id); setAutoDetectedType(null); }}
                                                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left leading-tight ${propertyType === opt.id ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-indigo-500/50'}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Số phòng ngủ — chỉ căn hộ / dự án ── */}
                                {isApartmentOrProject && (
                                    <div>
                                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">
                                            Số Phòng Ngủ
                                            <span className="text-emerald-500 ml-1 normal-case font-bold text-[10px]">★ quan trọng với căn hộ</span>
                                        </label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {[
                                                { value: 0, label: 'Studio' },
                                                { value: 1, label: '1 PN' },
                                                { value: 2, label: '2 PN' },
                                                { value: 3, label: '3 PN' },
                                                { value: 4, label: '4 PN+' },
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setBedrooms(prev => prev === opt.value ? null : opt.value)}
                                                    className={`py-3 rounded-xl text-xs font-bold transition-all border ${bedrooms === opt.value ? 'bg-emerald-500 text-[var(--text-primary)] border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        {bedrooms !== null && bedrooms !== 2 && (
                                            <div className="text-slate-500 text-xs mt-1.5 italic">
                                                {bedrooms === 0 ? 'Studio: -5% vs 2PN chuẩn' :
                                                 bedrooms === 1 ? '1PN: -2% vs 2PN chuẩn' :
                                                 bedrooms === 3 ? '3PN: +5% vs 2PN chuẩn' : '4PN+: +10% vs 2PN chuẩn'}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Hướng nhà */}
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">
                                        Hướng Cửa Chính
                                        <span className="text-slate-600 normal-case font-normal"> (không bắt buộc)</span>
                                    </label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { d: 'Bắc' },
                                            { d: 'Đông Bắc' },
                                            { d: 'Đông' },
                                            { d: 'Đông Nam', badge: 'Tốt nhất', badgeColor: 'text-emerald-400' },
                                            { d: 'Nam',      badge: 'Tốt',      badgeColor: 'text-emerald-500' },
                                            { d: 'Tây Nam' },
                                            { d: 'Tây' },
                                            { d: 'Tây Bắc' },
                                        ].map(({ d, badge, badgeColor }) => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => setDirection(prev => prev === d ? '' : d)}
                                                className={`py-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-0.5 ${direction === d ? 'bg-emerald-500 text-[var(--text-primary)] border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}
                                            >
                                                <span>{d}</span>
                                                {badge && <span className={`text-[9px] font-bold ${direction === d ? 'text-white/80' : badgeColor}`}>{badge}</span>}
                                            </button>
                                        ))}
                                    </div>
                                    {direction && (direction === 'Đông Nam' || direction === 'Nam') && (
                                        <div className="text-emerald-400/80 text-xs mt-1.5 italic">✓ Hướng {direction} thường có giá cao hơn 8–15% so với hướng Tây/Tây Bắc</div>
                                    )}
                                    {direction && direction !== 'Đông Nam' && direction !== 'Nam' && (
                                        <div className="text-slate-500 text-xs mt-1.5 italic">Hướng {direction} — hệ số hướng được điều chỉnh tự động theo AVM</div>
                                    )}
                                </div>

                                {/* Mặt tiền / Tầng & Tuổi nhà */}
                                {(() => {
                                    const isLand = propertyType.startsWith('land_');
                                    const showFrontage = !isApartment && !isLand && propertyType !== 'warehouse';
                                    const showFloor    = isApartment || propertyType === 'project';
                                    return (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                            {showFrontage && (
                                                <div>
                                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">Mặt Tiền (m)</label>
                                                    <input type="number" value={frontageWidth}
                                                        onChange={e => setFrontageWidth(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                                                        placeholder="4" min="1" />
                                                </div>
                                            )}
                                            {showFloor && (
                                                <div>
                                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">
                                                        {propertyType === 'penthouse' ? 'Tầng Penthouse' : 'Tầng'}
                                                    </label>
                                                    <input type="number" value={floorLevel}
                                                        onChange={e => setFloorLevel(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                                                        placeholder={propertyType === 'penthouse' ? '25' : '10'} min="1" />
                                                </div>
                                            )}
                                            {!isLand && (
                                                <div>
                                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">
                                                        {propertyType === 'warehouse' ? 'Năm Xây Xưởng' : 'Năm Xây Dựng'}
                                                        <span className="text-slate-600 normal-case font-normal"> (không bắt buộc)</span>
                                                    </label>
                                                    <input type="number" value={yearBuilt}
                                                        onChange={e => handleYearBuiltChange(e.target.value)}
                                                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all ${
                                                            yearBuilt && (parseInt(yearBuilt) < 1975 || parseInt(yearBuilt) > CURRENT_YEAR)
                                                                ? 'border-rose-500/70'
                                                                : 'border-slate-700'
                                                        }`}
                                                        placeholder={`VD: ${CURRENT_YEAR - 10}`}
                                                        min="1975"
                                                        max={CURRENT_YEAR}
                                                    />
                                                    {yearBuilt && parseInt(yearBuilt) >= 1975 && parseInt(yearBuilt) <= CURRENT_YEAR && (
                                                        <div className="text-slate-500 text-xs mt-1.5 italic">
                                                            Tuổi công trình: {CURRENT_YEAR - parseInt(yearBuilt)} năm
                                                        </div>
                                                    )}
                                                    {yearBuilt && (parseInt(yearBuilt) < 1975 || parseInt(yearBuilt) > CURRENT_YEAR) && (
                                                        <div className="text-rose-400 text-xs mt-1.5">
                                                            Phải từ 1975 đến {CURRENT_YEAR}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ── Thuê dự kiến — ẩn với đất nông nghiệp, đổi label với thương mại / dự án ── */}
                                {propertyType !== 'land_agricultural' && (
                                    <div>
                                        {(() => {
                                            const isCommercialType = ['shophouse', 'office', 'warehouse'].includes(propertyType);
                                            const isProject = propertyType === 'project';
                                            const rentLabel = isProject
                                                ? 'Thuê dự kiến sau bàn giao (tr/tháng)'
                                                : isCommercialType
                                                    ? (propertyType === 'warehouse' ? 'Giá Thuê Kho (tr/tháng)' : 'Giá Thuê TM (tr/tháng)')
                                                    : 'Thuê Dự Kiến (tr/tháng)';
                                            const rentHint = isProject
                                                ? 'dùng để tính yield đầu tư'
                                                : isCommercialType
                                                    ? (propertyType === 'warehouse' ? 'vd: 50 tr/tháng cho 500m²' : 'vd: 30 tr/tháng cho 100m²')
                                                    : (isApartment ? 'vd: 20 tr/tháng cho 70m²' : '');
                                            return (
                                                <>
                                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">
                                                        {rentLabel}
                                                        {rentHint && <span className="text-slate-600 normal-case font-normal ml-1">({rentHint})</span>}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={monthlyRent}
                                                        onChange={e => setMonthlyRent(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                                                        placeholder="Tự động tính"
                                                        min="0"
                                                    />
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* ── Nội thất — chỉ hiện với nhà ở / căn hộ (ẩn với đất, kho xưởng) ── */}
                                {!propertyType.startsWith('land_') && propertyType !== 'warehouse' && (
                                    <div>
                                        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">
                                            {propertyType === 'office' ? 'Tình Trạng VP' : 'Nội Thất'}
                                            <span className="text-slate-600 normal-case font-normal"> (không bắt buộc)</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(propertyType === 'office'
                                                ? [
                                                    { id: 'LUXURY', label: 'Cao cấp', badge: '+12%', badgeColor: 'text-purple-400' },
                                                    { id: 'FULL',   label: 'Hoàn thiện', badge: '+7%', badgeColor: 'text-emerald-400' },
                                                    { id: 'BASIC',  label: 'Shell & Core', badge: 'Ref', badgeColor: 'text-slate-400' },
                                                    { id: 'NONE',   label: 'Thô', badge: '-5%', badgeColor: 'text-rose-400' }
                                                ]
                                                : [
                                                    { id: 'LUXURY', label: 'Nội thất cao cấp', badge: '+12%', badgeColor: 'text-purple-400' },
                                                    { id: 'FULL',   label: 'Nội thất đầy đủ',   badge: '+7%',  badgeColor: 'text-emerald-400' },
                                                    { id: 'BASIC',  label: 'Nội thất cơ bản',   badge: 'Ref',  badgeColor: 'text-slate-400' },
                                                    { id: 'NONE',   label: 'Nhà thô',            badge: '-5%',  badgeColor: 'text-rose-400' }
                                                ]
                                            ).map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setFurnishing(prev => prev === opt.id ? '' : opt.id as any)}
                                                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-0.5 ${furnishing === opt.id ? 'bg-emerald-500 text-[var(--text-primary)] border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}
                                                >
                                                    <span>{opt.label}</span>
                                                    <span className={`text-[9px] font-bold ${furnishing === opt.id ? 'text-white/80' : opt.badgeColor}`}>{opt.badge}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!roadTypeSelect && area && parseFloat(area) > 0 && (
                                    <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2.5 text-xs text-yellow-400">
                                        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                        <span>Chọn <b>Vị trí đường</b> để AI tính hệ số vị trí chính xác hơn. Nếu bỏ qua, hệ thống dùng hẻm 3m mặc định.</span>
                                    </div>
                                )}
                                <button 
                                    onClick={runCalculation}
                                    disabled={
                                        !area || parseFloat(area) <= 0 || !!areaError ||
                                        !!(yearBuilt && (parseInt(yearBuilt) < 1975 || parseInt(yearBuilt) > CURRENT_YEAR))
                                    }
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-[var(--text-primary)] font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-lg flex items-center justify-center gap-3"
                                >
                                    <span>Định Giá Ngay</span>
                                    <span className={`text-sm font-bold rounded-full px-3 py-0.5 ${accuracy >= 90 ? 'bg-emerald-400/30 text-emerald-100' : accuracy >= 75 ? 'bg-yellow-400/20 text-yellow-100' : 'bg-white/20 text-white/70'}`}>
                                        {accuracy >= 90 ? '✓ ' : ''}{accuracy.toFixed(0)}% dữ liệu
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: ANALYZING — Agent Cards (ghi nhận thông số thực từ người dùng) */}
                {step === 'ANALYZING' && (
                    <div className="max-w-xl mx-auto pt-8 animate-enter">
                        {/* Header + progress bar */}
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                SGS Định Giá AI™ đang xử lý
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500 ease-out rounded-full"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">{Math.round(progress)}% hoàn thành</div>
                        </div>

                        {/* Agent cards */}
                        <div className="space-y-3">
                            {agentStepsList.map((agent, idx) => {
                                const status: 'done' | 'active' | 'waiting' =
                                    idx < currentAgentIdx ? 'done' :
                                    idx === currentAgentIdx ? 'active' : 'waiting';
                                return (
                                    <div
                                        key={idx}
                                        className={`rounded-2xl border p-4 transition-all duration-500 ${
                                            status === 'done'
                                                ? 'bg-emerald-900/20 border-emerald-500/30'
                                                : status === 'active'
                                                ? 'bg-slate-800 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                                                : 'bg-slate-800/20 border-slate-700/30 opacity-35'
                                        }`}
                                    >
                                        {/* Agent header */}
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xl shrink-0 ${status === 'active' ? 'animate-pulse' : ''}`}>
                                                {agent.icon}
                                            </span>
                                            <span className={`font-bold text-sm flex-1 ${
                                                status === 'done' ? 'text-emerald-400' :
                                                status === 'active' ? 'text-white' : 'text-slate-500'
                                            }`}>
                                                {agent.title}
                                            </span>
                                            {status === 'done' && (
                                                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 shrink-0">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Ghi nhận
                                                </span>
                                            )}
                                            {status === 'active' && (
                                                <span className="inline-flex gap-0.5 shrink-0">
                                                    {[0, 150, 300].map(delay => (
                                                        <span key={delay} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                                                    ))}
                                                </span>
                                            )}
                                        </div>
                                        {/* Agent details — visible when active or done */}
                                        {(status === 'active' || status === 'done') && (
                                            <div className="ml-8 mt-2 space-y-1">
                                                {agent.details.filter(Boolean).map((d, di) => (
                                                    <div key={di} className={`text-xs font-mono flex items-start gap-1.5 ${
                                                        status === 'done' ? 'text-emerald-300/70' : 'text-slate-300'
                                                    }`}>
                                                        <span className={`mt-0.5 shrink-0 ${status === 'done' ? 'text-emerald-500' : 'text-emerald-400'}`}>›</span>
                                                        <span>{d}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* STEP 4: RESULT DASHBOARD */}
                {step === 'RESULT' && valuation && (
                    <div className="animate-enter pb-24">
                        {/* ── MAIN PRICE CARD ── */}
                        <div className="bg-slate-800 rounded-[32px] border border-slate-700 p-8 shadow-2xl relative overflow-hidden mb-6">
                            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
                                <div>
                                    <h3 className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                        {valuation.reconciliation
                                            ? `Giá trị tổng hợp (${(valuation.reconciliation.compsWeight * 100).toFixed(0)}% So Sánh + ${(valuation.reconciliation.incomeWeight * 100).toFixed(0)}% Thu Nhập)`
                                            : 'Giá trị thị trường ước tính'}
                                    </h3>
                                    <div className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-slate-400 tracking-tight">
                                        <span className={!currentUser ? 'blur-sm select-none pointer-events-none' : ''}>{formatSmartPrice(valuation.price, t)}</span>{' '}
                                        <span className="text-2xl text-emerald-500">VNĐ</span>
                                    </div>
                                    <div className="text-slate-400 text-sm mt-2 font-medium">
                                        Biên độ:{' '}
                                        <span className={!currentUser ? 'blur-sm select-none pointer-events-none' : ''}>{formatVND(valuation.range[0])}</span>
                                        {' '}—{' '}
                                        <span className={!currentUser ? 'blur-sm select-none pointer-events-none' : ''}>{formatVND(valuation.range[1])}</span>
                                    </div>
                                    {!currentUser && (
                                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            <a href="/#/auth/login" className="hover:text-emerald-200 transition-colors">Đăng nhập để xem số liệu đầy đủ →</a>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 flex-wrap justify-end">
                                    <div className="bg-slate-900/80 px-5 py-3 rounded-2xl border border-slate-600 backdrop-blur-sm text-center min-w-[100px]">
                                        <div className="text-xs2 text-[var(--text-tertiary)] uppercase font-bold mb-1">Độ Tin Cậy</div>
                                        <div className={`text-xl font-bold ${valuation.confidence >= 90 ? 'text-emerald-400' : valuation.confidence >= 70 ? 'text-yellow-400' : 'text-rose-400'}`}>
                                            {valuation.confidence}%
                                        </div>
                                    </div>
                                    <div className="bg-slate-900/80 px-5 py-3 rounded-2xl border border-slate-600 backdrop-blur-sm text-center min-w-[100px]">
                                        <div className="text-xs2 text-[var(--text-tertiary)] uppercase font-bold mb-1">Đơn giá / m²</div>
                                        <div className={`text-xl font-bold text-white ${!currentUser ? 'blur-sm select-none pointer-events-none' : ''}`}>
                                            {valuation.pricePerM2 >= 1_000_000_000
                                                ? `${(valuation.pricePerM2 / 1_000_000_000).toFixed(1)} Tỷ/m²`
                                                : `${(valuation.pricePerM2 / 1_000_000).toFixed(0)} Tr/m²`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── RANGE BAR ── */}
                            {(() => {
                                const min = valuation.range[0];
                                const max = valuation.range[1];
                                const mid = valuation.price;
                                const pct = max > min ? Math.round(((mid - min) / (max - min)) * 100) : 50;
                                const confLevel = getConfidenceLevel(valuation.confidence);
                                const confColors: Record<string, string> = {
                                    high: 'text-[#3B6D11] bg-[#EAF3DE]',
                                    med:  'text-[#854F0B] bg-[#FAEEDA]',
                                    low:  'text-[#A32D2D] bg-[#FCEBEB]',
                                };
                                return (
                                    <div className="mb-2">
                                        <div className="flex justify-between text-xs text-slate-400 font-medium mb-1.5">
                                            <span>Thấp nhất<br /><span className={`text-white font-bold ${!currentUser ? 'blur-sm select-none pointer-events-none' : ''}`}>{formatVND(min)}</span></span>
                                            <span className="text-right">Cao nhất<br /><span className={`text-white font-bold ${!currentUser ? 'blur-sm select-none pointer-events-none' : ''}`}>{formatVND(max)}</span></span>
                                        </div>
                                        <div className="relative h-2 rounded-full overflow-visible" style={{ background: 'linear-gradient(to right, #639922, #EF9F27, #E24B4A)' }}>
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-[#185FA5] shadow-md"
                                                style={{ left: `clamp(0%, ${pct}%, 100%)`, transform: 'translate(-50%, -50%)' }}
                                                title="Giá ước tính"
                                            />
                                        </div>
                                        <div className="flex justify-end mt-2">
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${confColors[confLevel]}`}>
                                                Độ tin cậy: {valuation.confidence}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ── INPUT SUMMARY CHIPS ── */}
                            {(() => {
                                const legalChip = legal === 'PINK_BOOK' ? '📄 Sổ Hồng' : legal === 'CONTRACT' ? '📋 HĐ Mua Bán' : legal === 'PENDING' ? '🕐 Đang làm sổ' : '📝 Vi Bằng';
                                const dirLabels: Record<string,string> = { N:'Bắc', S:'Nam', E:'Đông', W:'Tây', NE:'Đông Bắc', SE:'Đông Nam', SW:'Tây Nam', NW:'Tây Bắc' };
                                const roadTypeLabelMap: Record<string,string> = { alley_moto:'Hẻm xe máy', alley_car:'Hẻm xe hơi', minor:'Đường nhỏ', major:'Đường lớn', boulevard:'Đại lộ' };
                                const chips: string[] = [];
                                chips.push(`🏠 ${PROPERTY_TYPE_LABELS[propertyType] || 'Nhà phố'}`);
                                chips.push(`📐 ${parseFloat(area) || 0}m²`);
                                chips.push(legalChip);
                                if (roadTypeSelect) chips.push(`🛣 ${roadTypeLabelMap[roadTypeSelect] || roadTypeSelect}`);
                                else if (roadWidth) chips.push(`🛣 Lộ giới ${roadWidth}m`);
                                if (yearBuilt && parseInt(yearBuilt) >= 1975) chips.push(`🏗 Xây ${yearBuilt} (${CURRENT_YEAR - parseInt(yearBuilt)} tuổi)`);
                                else if (buildingAge && parseFloat(buildingAge) > 0) chips.push(`🏗 ${parseFloat(buildingAge)} tuổi`);
                                if (direction) chips.push(`🧭 Hướng ${dirLabels[direction] || direction}`);
                                if (frontageWidth && parseFloat(frontageWidth) > 0) chips.push(`📏 MT ${frontageWidth}m`);
                                if (bedrooms !== null && isApartmentOrProject) chips.push(`🛏 ${bedrooms} phòng ngủ`);
                                if (floorLevel && parseFloat(floorLevel) > 0) chips.push(`🏢 Tầng ${floorLevel}`);
                                return (
                                    <div className="flex flex-wrap gap-1.5 mb-6">
                                        {chips.map((c, i) => (
                                            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-slate-900/70 border border-slate-700 text-slate-300 font-medium">{c}</span>
                                        ))}
                                    </div>
                                );
                            })()}

                            {/* ── FORMULA DISPLAY ── */}
                            {valuation.formula && (
                                <div className="mb-6 bg-slate-900/50 rounded-xl border border-slate-700/40 px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
                                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    <span className="text-xs text-slate-400 font-mono whitespace-nowrap">{valuation.formula}</span>
                                </div>
                            )}

                            {/* ── FACTORS BREAKDOWN (XAI) ── */}
                            {valuation.factors.length > 0 && (() => {
                                const avmFactors = valuation.factors.filter(f => f.type !== 'LOCATION');
                                const locationFactors = valuation.factors.filter(f => f.type === 'LOCATION');
                                const renderFactor = (factor: typeof valuation.factors[0], i: number) => {
                                    const sign = factor.isPositive ? '+' : '-';
                                    const barWidth = Math.min(100, factor.impact * 4);
                                    return (
                                        <div key={i} className="px-5 py-3">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-slate-300 text-sm font-medium">{factor.label}</span>
                                                <span className={`font-bold text-sm ${factor.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {factor.impact === 0 ? 'Chuẩn' : `${sign}${factor.impact}%`}
                                                </span>
                                            </div>
                                            {factor.description && (
                                                <div className="text-[var(--text-secondary)] text-xs3 mb-1.5">{factor.description}</div>
                                            )}
                                            {factor.impact > 0 && (
                                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${factor.isPositive ? 'bg-emerald-500/60' : 'bg-rose-500/60'}`}
                                                        style={{ width: `${barWidth}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                };
                                return (
                                    <div className="space-y-3">
                                        {/* AVM Factors — applied to price */}
                                        {avmFactors.length > 0 && (
                                            <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                                                <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                                    <span className="text-[var(--text-tertiary)] text-xs2 uppercase font-bold tracking-widest">Hệ số điều chỉnh — đã áp dụng vào giá</span>
                                                </div>
                                                <div className="divide-y divide-slate-800">
                                                    {avmFactors.map(renderFactor)}
                                                </div>
                                            </div>
                                        )}
                                        {/* Location Factors — context only */}
                                        {locationFactors.length > 0 && (
                                            <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                                                <div className="px-5 py-3 border-b border-slate-700/50 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                                                    <span className="text-[var(--text-tertiary)] text-xs2 uppercase font-bold tracking-widest">Yếu tố khu vực — đã phản ánh trong giá cơ sở</span>
                                                </div>
                                                <div className="divide-y divide-slate-800">
                                                    {locationFactors.map(renderFactor)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── CƠ SỞ ĐỊNH GIÁ (ACCORDION TABLE) ── */}
                        {valuation.factors.length > 0 && (() => {
                            const avmFactors = valuation.factors.filter(f => f.type === 'AVM');
                            const pricePerM2Tr = Math.round(valuation.pricePerM2 / 1_000_000);
                            const rows: { label: string; detail: string; adj: string; isPos: boolean; isBase: boolean }[] = [
                                {
                                    label: 'Giá đất khu vực',
                                    detail: `${pricePerM2Tr} triệu/m²`,
                                    adj: 'Cơ sở',
                                    isPos: true,
                                    isBase: true,
                                },
                                ...avmFactors.map(f => ({
                                    label: f.label,
                                    detail: f.description || '—',
                                    adj: f.impact === 0 ? 'Chuẩn' : `${f.isPositive ? '+' : '-'}${f.impact}%`,
                                    isPos: f.isPositive,
                                    isBase: false,
                                })),
                            ];
                            return (
                                <div className="bg-slate-800 rounded-[32px] border border-slate-700 shadow-2xl mb-6 overflow-hidden">
                                    <button
                                        onClick={() => setBreakdownOpen(v => !v)}
                                        className="w-full flex items-center justify-between px-8 py-5 text-left hover:bg-slate-700/30 transition-colors"
                                    >
                                        <span className="text-slate-300 uppercase text-xs font-bold tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                                            Cơ sở định giá
                                        </span>
                                        <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${breakdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    {breakdownOpen && (
                                        <div className="border-t border-slate-700">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-700/50 bg-slate-900/30">
                                                        <th className="px-6 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Yếu tố</th>
                                                        <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Chi tiết</th>
                                                        <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Điều chỉnh</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {rows.map((row, i) => (
                                                        <tr key={i} className="hover:bg-slate-700/20">
                                                            <td className="px-6 py-3 font-medium text-slate-200">{row.label}</td>
                                                            <td className="px-4 py-3 text-slate-400 text-xs">
                                                                {row.isBase && !currentUser
                                                                    ? <span className="blur-sm select-none pointer-events-none">{row.detail}</span>
                                                                    : row.detail}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className={`font-bold text-xs ${row.isBase ? 'text-[#9CA3AF]' : row.isPos ? 'text-[#3B6D11]' : 'text-[#A32D2D]'}`}>
                                                                    {row.adj}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* ── NHẬN XÉT AI + LƯU Ý RỦI RO ── */}
                        {valuation.marketTrend && valuation.marketTrend !== 'Đang cập nhật' && (
                            <div className="bg-slate-800 rounded-[32px] border border-slate-700 p-8 shadow-2xl mb-6 space-y-5">
                                <div>
                                    <div className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                        Nhận xét của AI
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed border-l-[3px] border-blue-500 pl-4">
                                        {valuation.marketTrend}
                                    </p>
                                </div>
                                {/giảm|rủi ro|cẩn thận|thận trọng|biến động|khó bán|kém thanh khoản/i.test(valuation.marketTrend) && (
                                    <div className="space-y-1.5">
                                        <div className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-2 flex items-center gap-2">
                                            <span className="text-[#854F0B]">▲</span> Lưu ý rủi ro
                                        </div>
                                        {valuation.marketTrend.split(/[.;]/).filter(s => /giảm|rủi ro|cẩn thận|thận trọng|biến động|khó bán|kém thanh khoản/i.test(s) && s.trim().length > 10).slice(0, 3).map((risk, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm text-amber-300">
                                                <span className="text-[#854F0B] mt-0.5 shrink-0">▲</span>
                                                <span>{risk.trim()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── PHƯƠNG PHÁP THU NHẬP + TỔNG HỢP ── */}
                        {valuation.incomeApproach && (
                            <div className="bg-slate-800 rounded-[32px] border border-slate-700 p-8 shadow-2xl mb-6">
                                <h3 className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-6 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                                    Phân tích đa phương pháp
                                </h3>

                                {/* Two-column: Comps vs Income */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    {/* Comps Method */}
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Phương pháp So sánh thị trường</span>
                                        </div>
                                        <div className="text-2xl font-black text-white mb-1">
                                            <span className={!currentUser ? 'blur-sm select-none pointer-events-none' : ''}>{formatSmartPrice(valuation.compsPrice || valuation.price, t)}</span>{' '}
                                            <span className="text-sm text-emerald-400">VNĐ</span>
                                        </div>
                                        {valuation.reconciliation && (
                                            <div className="mt-3 text-xs bg-emerald-500/10 rounded-lg px-3 py-1.5 inline-block">
                                                Trọng số: <span className="font-bold text-emerald-300">{(valuation.reconciliation.compsWeight * 100).toFixed(0)}%</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Income Method */}
                                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 flex-shrink-0"></span>
                                            <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">Phương pháp Thu nhập & Vốn hóa</span>
                                        </div>
                                        <div className="text-2xl font-black text-white mb-1">
                                            <span className={!currentUser ? 'blur-sm select-none pointer-events-none' : ''}>{formatSmartPrice(valuation.incomeApproach.capitalValue, t)}</span>{' '}
                                            <span className="text-sm text-indigo-400">VNĐ</span>
                                        </div>
                                        {valuation.reconciliation && (
                                            <div className="mt-3 text-xs bg-indigo-500/10 rounded-lg px-3 py-1.5 inline-block">
                                                Trọng số: <span className="font-bold text-indigo-300">{(valuation.reconciliation.incomeWeight * 100).toFixed(0)}%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Income Details breakdown */}
                                <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden mb-4">
                                    <div className="px-5 py-3 border-b border-slate-700/50">
                                        <span className="text-[var(--text-tertiary)] text-xs2 uppercase font-bold tracking-widest">Chi tiết Phương pháp Thu nhập</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-slate-800">
                                        {[
                                            { label: 'Tiền thuê/tháng', value: `${valuation.incomeApproach.monthlyRent.toFixed(1)} Tr`, hint: 'Ước tính theo thị trường' },
                                            { label: 'Thu nhập ròng/năm', value: `${valuation.incomeApproach.noi.toFixed(1)} Tr`, hint: 'Sau khấu trống 8% & chi phí 20%' },
                                            { label: 'Tỷ lệ vốn hóa', value: `${(valuation.incomeApproach.capRate * 100).toFixed(1)}%`, hint: 'NOI / Giá trị thị trường (cap rate)' },
                                            { label: 'Thời gian hoàn vốn', value: `${valuation.incomeApproach.paybackYears.toFixed(1)} năm`, hint: 'Dựa trên thu nhập cho thuê gộp' },
                                        ].map((item, i) => (
                                            <div key={i} className="px-4 py-3 text-center">
                                                <div className="text-[var(--text-tertiary)] text-xs2 mb-1">{item.label}</div>
                                                <div className="text-white font-bold text-base">{item.value}</div>
                                                <div className="text-[var(--text-secondary)] text-xs3 mt-0.5">{item.hint}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Gross Rental Yield */}
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="text-slate-400">Tỷ suất cho thuê gộp:</span>
                                    <span className={`font-bold ${valuation.incomeApproach.grossRentalYield >= 5 ? 'text-emerald-400' : valuation.incomeApproach.grossRentalYield >= 3 ? 'text-yellow-400' : 'text-rose-400'}`}>
                                        {valuation.incomeApproach.grossRentalYield.toFixed(2)}%/năm
                                    </span>
                                    <span className="text-slate-600">|</span>
                                    <span className="text-slate-400">Khấu trống: 8% | Chi phí vận hành: 20%</span>
                                </div>
                            </div>
                        )}

                        {/* Fallback warning banner */}
                        {valuation.isRealtime === false && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-3 flex items-start gap-3">
                                <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                <div>
                                    <p className="text-amber-400 text-xs font-semibold">Dữ liệu thị trường tạm thời không khả dụng</p>
                                    <p className="text-amber-300/70 text-xs mt-0.5">Kết quả ước tính dựa trên bảng giá khu vực tĩnh (không phải realtime). Vui lòng thử lại sau vài phút để nhận định giá từ dữ liệu thị trường thực.</p>
                                </div>
                            </div>
                        )}

                        {/* Chart Simulation */}
                        <div className="bg-slate-800 rounded-[32px] border border-slate-700 p-8 shadow-sm relative">
                            {(() => {
                                // Extract short trend label from AI marketTrend text
                                const raw = valuation.marketTrend || '';
                                const pctMatch = raw.match(/(\d+)\s*%/);
                                const pct = pctMatch ? parseInt(pctMatch[1], 10) : null;
                                const isUp = /tăng/i.test(raw);
                                const isDown = /giảm/i.test(raw);
                                const trendLabel = pct
                                    ? (isDown ? `Giảm ${pct}%/năm` : `Tăng ${pct}%/năm`)
                                    : (isDown ? 'Xu hướng giảm' : isUp ? 'Xu hướng tăng' : 'Ổn định');
                                const isFallback = valuation.isRealtime === false;
                                return (
                                    <div className="flex justify-between items-center mb-2">
                                        <div>
                                            <h3 className="text-slate-400 uppercase text-xs font-bold tracking-widest">Xu hướng giá ước tính</h3>
                                            <p className="text-slate-600 text-xs mt-0.5 italic">
                                                {isFallback
                                                    ? 'Ước tính từ bảng giá khu vực — không phải dữ liệu realtime'
                                                    : 'Mô phỏng 12 tháng từ tỷ lệ tăng trưởng AI trích xuất'}
                                            </p>
                                        </div>
                                        <span className={`text-xs px-3 py-1 rounded-full border font-bold shrink-0 ${isFallback ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : isDown ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                            {trendLabel}
                                        </span>
                                    </div>
                                );
                            })()}
                            <div className="h-[300px] w-full relative min-w-0">
                                <ResponsiveContainer width="100%" height="100%" minHeight={250} minWidth={200}>
                                    <AreaChart data={valuation.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="month" stroke="#64748B" tick={{fill: '#94A3B8', fontSize: 11}} />
                                        <YAxis
                                            hide
                                            domain={[
                                                (dataMin: number) => Math.max(0, parseFloat((dataMin * 0.94).toFixed(3))),
                                                (dataMax: number) => parseFloat((dataMax * 1.06).toFixed(3))
                                            ]}
                                        />
                                        <Tooltip 
                                            contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', fontSize: 13}}
                                            itemStyle={{color: '#fff'}}
                                            formatter={(value: number) => {
                                                const display = value >= 1000
                                                    ? `${(value / 1000).toFixed(2)} Nghìn tỷ`
                                                    : value >= 1
                                                    ? `${value.toFixed(2)} Tỷ`
                                                    : `${(value * 1000).toFixed(0)} Triệu`;
                                                return [display + ' VNĐ', 'Giá ước tính'];
                                            }}
                                        />
                                        <Area type="monotone" dataKey="price" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        
                        {/* ── RLHF Feedback Widget — hiển thị cho mọi người (guest + user) ─── */}
                        {valuationId && (
                            <div className="bg-slate-800/60 border border-slate-700 rounded-[28px] px-7 py-6 flex flex-col gap-4">
                                {feedbackSent ? (
                                    <div className="flex items-center gap-3 text-emerald-400">
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        <span className="text-sm font-medium">Cảm ơn! Phản hồi của bạn giúp AI định giá chính xác hơn.</span>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-slate-400 text-sm font-medium">Kết quả định giá có chính xác không?</p>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setFeedbackRating(1)}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${feedbackRating === 1 ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-slate-600 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400'}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                                                Chính xác
                                            </button>
                                            <button
                                                onClick={() => setFeedbackRating(-1)}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${feedbackRating === -1 ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'border-slate-600 text-slate-400 hover:border-rose-500/50 hover:text-rose-400'}`}
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" /></svg>
                                                Cần cải thiện
                                            </button>
                                        </div>
                                        {feedbackRating === -1 && (
                                            <div className="flex items-center gap-3 mt-1">
                                                <input
                                                    type="number"
                                                    placeholder="Giá thực tế bạn biết (tỷ VNĐ)"
                                                    value={actualPriceInput}
                                                    onChange={(e) => setActualPriceInput(e.target.value)}
                                                    className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60"
                                                    step="0.1"
                                                    min="0"
                                                />
                                            </div>
                                        )}
                                        {feedbackRating !== null && (
                                            <button
                                                disabled={feedbackLoading}
                                                onClick={async () => {
                                                    if (!feedbackRating) return;
                                                    setFeedbackLoading(true);
                                                    try {
                                                        const actualPriceBillion = actualPriceInput ? parseFloat(actualPriceInput) : undefined;
                                                        const actualPriceVnd = actualPriceBillion && !isNaN(actualPriceBillion) ? actualPriceBillion * 1_000_000_000 : undefined;
                                                        await aiService.submitFeedback({
                                                            interactionId: valuationId,
                                                            intent: 'ESTIMATE_VALUATION',
                                                            rating: feedbackRating,
                                                            // aiResponse: rich context for RLHF region matching
                                                            aiResponse: `${address} — ${valuation?.price ? (valuation.price / 1_000_000_000).toFixed(2) + ' tỷ VNĐ' : ''}`,
                                                            userMessage: `${address} | ${propertyType} | ${area}m² | ${roadWidth}m | ${legal}`,
                                                            correction: actualPriceVnd ? String(actualPriceVnd) : undefined,
                                                            // metadata: structured for RLHF price correction queries
                                                            metadata: {
                                                                address,
                                                                propertyType,
                                                                area: parseFloat(area) || undefined,
                                                                roadWidth: parseFloat(roadWidth) || undefined,
                                                                legal,
                                                                totalPrice: valuation?.price ?? undefined,
                                                                pricePerM2: valuation?.pricePerM2 ?? undefined,
                                                                rangeMin: valuation?.range?.[0] ?? undefined,
                                                                rangeMax: valuation?.range?.[1] ?? undefined,
                                                                actualPriceVnd: actualPriceVnd ?? undefined,
                                                            },
                                                        });
                                                        setFeedbackSent(true);
                                                    } catch {
                                                        notify('Không gửi được phản hồi. Vui lòng thử lại.', 'error');
                                                    } finally {
                                                        setFeedbackLoading(false);
                                                    }
                                                }}
                                                className="self-start px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                                            >
                                                {feedbackLoading ? 'Đang gửi...' : 'Gửi phản hồi'}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── DISCLAIMER BẮT BUỘC ── */}
                        <div style={{
                            background: '#F1EFE8',
                            border: '0.5px solid #D3D1C7',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            marginTop: '20px',
                            fontSize: '12px',
                            color: '#5F5E5A',
                            lineHeight: 1.6,
                        }}>
                            ⚠️ <strong>Lưu ý quan trọng:</strong> Kết quả định giá mang tính tham khảo dựa trên dữ liệu AI, không phải thẩm định pháp lý chính thức theo Nghị định 21/2021/NĐ-CP. SGS Land không chịu trách nhiệm về các quyết định giao dịch dựa trên kết quả này. Để có thẩm định chính thức, vui lòng liên hệ chuyên gia thẩm định được cấp phép của Bộ Tài chính Việt Nam.
                        </div>

                        {/* ── ACTION BUTTONS + HISTORY LINK ── */}
                        <div className="flex flex-col items-center gap-3 mt-10">
                            <div className="flex justify-center gap-4">
                                <button onClick={handleAdjustParams} className="px-8 py-3 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-800 font-bold transition-colors flex items-center gap-2">
                                    {ICONS.EDIT} Điều Chỉnh Thông Số
                                </button>
                                <button onClick={handleNewValuation} className="px-8 py-3 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-800 font-bold transition-colors flex items-center gap-2">
                                    {ICONS.RESET} Định Giá Mới
                                </button>
                            </div>
                            {(() => {
                                const hist = readHistory();
                                if (hist.length === 0) return null;
                                return (
                                    <button
                                        onClick={() => { setHistoryItems(hist); setShowHistoryModal(true); }}
                                        className="text-slate-500 hover:text-slate-300 text-sm transition-colors underline underline-offset-2"
                                    >
                                        Lịch sử định giá ({hist.length} lần)
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>

            {/* Features Footer */}
            {step === 'ADDRESS' && (
                <section className="py-20 px-6 max-w-6xl mx-auto border-t border-slate-800 mt-20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-slate-800/50 p-8 rounded-[32px] border border-slate-700 hover:border-emerald-500/50 transition-colors group">
                            <div className="mb-6 group-hover:scale-110 transition-transform duration-300">{ICONS.AI_CHIP}</div>
                            <h3 className="text-xl font-bold text-white mb-3">SGS Định Giá AI™</h3>
                            <p className="text-slate-400 leading-relaxed">Thuật toán độc quyền kết hợp giữa so sánh giá thị trường và phân tích dòng tiền tương lai.</p>
                        </div>
                        <div className="bg-slate-800/50 p-8 rounded-[32px] border border-slate-700 hover:border-indigo-500/50 transition-colors group">
                            <div className="mb-6 group-hover:scale-110 transition-transform duration-300">{ICONS.DATA}</div>
                            <h3 className="text-xl font-bold text-white mb-3">Dữ Liệu Siêu Lớn</h3>
                            <p className="text-slate-400 leading-relaxed">Cập nhật hàng ngày từ hơn 50 nguồn dữ liệu uy tín: Chính phủ, sàn giao dịch và mạng xã hội.</p>
                        </div>
                        <div className="bg-slate-800/50 p-8 rounded-[32px] border border-slate-700 hover:border-rose-500/50 transition-colors group">
                            <div className="mb-6 group-hover:scale-110 transition-transform duration-300">{ICONS.LOCK}</div>
                            <h3 className="text-xl font-bold text-white mb-3">Bảo Mật Ngân Hàng</h3>
                            <p className="text-slate-400 leading-relaxed">Dữ liệu định giá của bạn được mã hóa và bảo mật tuyệt đối. Chúng tôi không chia sẻ với bên thứ ba.</p>
                        </div>
                    </div>
                </section>
            )}
        </div>
        {createPortal(
            toast ? (
                <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-enter border ${toast.type === 'error' ? 'bg-rose-900/95 border-rose-500 text-white' : 'bg-emerald-900/95 border-emerald-500 text-white'}`}>
                    <span className="font-bold text-sm">{toast.msg}</span>
                </div>
            ) : null,
            document.body
        )}
        {showHistoryModal && createPortal(
            <div className="fixed inset-0 z-[350] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHistoryModal(false)}>
                <div
                    className="max-w-2xl w-full bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                        <h2 className="font-bold text-white text-base">Lịch sử định giá ({historyItems.length} lần)</h2>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { clearHistory(); setHistoryItems([]); setShowHistoryModal(false); }}
                                className="text-slate-500 hover:text-rose-400 text-xs transition-colors"
                            >
                                Xoá lịch sử
                            </button>
                            <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white">
                                {ICONS.X}
                            </button>
                        </div>
                    </div>
                    <div className="overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-900">
                                <tr className="border-b border-slate-700">
                                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-bold uppercase tracking-wider">Thời gian</th>
                                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-bold uppercase tracking-wider">Địa chỉ</th>
                                    <th className="px-4 py-3 text-right text-xs text-slate-500 font-bold uppercase tracking-wider">Giá ước tính</th>
                                    <th className="px-4 py-3 text-right text-xs text-slate-500 font-bold uppercase tracking-wider">Tin cậy</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {historyItems.map(h => (
                                    <tr key={h.id} className="hover:bg-slate-700/30">
                                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{h.date}</td>
                                        <td className="px-4 py-3 text-slate-200 max-w-[200px] truncate" title={h.address}>{h.address}</td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-400 whitespace-nowrap">{formatVND(h.totalPrice)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${h.confidence >= 80 ? 'text-[#3B6D11] bg-[#EAF3DE]' : h.confidence >= 70 ? 'text-[#854F0B] bg-[#FAEEDA]' : 'text-[#A32D2D] bg-[#FCEBEB]'}`}>
                                                {h.confidence}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>,
            document.body
        )}
        {showGuestGate && createPortal(
            <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGuestGate(false)}>
                <div
                    className="max-w-sm w-full bg-slate-800 border border-slate-700 rounded-2xl p-7 flex flex-col items-center gap-5 text-center shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>

                    <div>
                        <h2 className="text-lg font-bold text-white">Bạn đã dùng {GUEST_DAILY_LIMIT} lượt miễn phí hôm nay</h2>
                        <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                            Tạo tài khoản miễn phí để định giá không giới hạn và truy cập đầy đủ tính năng.
                        </p>
                    </div>

                    {/* Benefits list */}
                    <ul className="w-full text-left space-y-2">
                        {[
                            'Định giá không giới hạn mỗi ngày',
                            'Lưu lịch sử định giá vĩnh viễn',
                            'So sánh comps từ DB nội bộ',
                            'Xuất báo cáo định giá PDF',
                            'Truy cập SGS CRM bất động sản',
                        ].map(b => (
                            <li key={b} className="flex items-center gap-2 text-xs text-slate-300">
                                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                {b}
                            </li>
                        ))}
                    </ul>

                    <div className="flex flex-col gap-2.5 w-full">
                        <button
                            onClick={() => { window.location.hash = `#/${ROUTES.LOGIN}`; }}
                            className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                        >
                            Đăng nhập / Đăng ký miễn phí →
                        </button>
                        <button
                            onClick={() => setShowGuestGate(false)}
                            className="w-full py-2.5 bg-slate-700/50 text-slate-400 text-sm rounded-xl hover:bg-slate-700 transition-colors"
                        >
                            Đóng — thử lại ngày mai
                        </button>
                    </div>
                    <p className="text-xs text-slate-600">Lượt định giá khách reset mỗi ngày lúc 00:00</p>
                </div>
            </div>,
            document.body
        )}
        </>
    );
};

export default AiValuation;
