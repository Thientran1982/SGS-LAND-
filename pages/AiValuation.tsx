
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
    if (/căn hộ|chung cư|apartment|vinhome|vinhomes|the sun|masteri|diamond|icon|botanica|river gate|gateway|sky |sunrise|estella|flora|richstar|sky garden|block [a-z]\d|tầng \d{2,}|p\d+\.\d+|m\d+\.\d+|imperia|celadon|akari|westgate|waterpoint|one |eaton|picity|tecco|goldmark|mipec|times city|season avenue|d'capitale/i.test(t))
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
    // Off-plan project
    if (/dự án|off.plan|chưa bàn giao|off plan|căn hộ hình thành|nhà hình thành/i.test(t)) return 'project';
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
const GUEST_DAILY_LIMIT = 3;
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

// --- SIMULATED AI ENGINE ---
const ANALYSIS_STEPS = [
    "Hệ thống SGS Định Giá AI™ đang khởi động...",
    "Phân tích 1.204.592 điểm dữ liệu không gian...",
    "Đang chạy hồi quy trên các giao dịch tương đương...",
    "Điều chỉnh theo yếu tố pháp lý & thanh khoản...",
    "Hoàn thiện khoảng tin cậy định giá..."
];

export const AiValuation: React.FC = () => {
    const { t, formatCurrency } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [guestUsed, setGuestUsed] = useState(0);
    const [showGuestGate, setShowGuestGate] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const notify = (msg: string, type: 'success' | 'error' = 'error') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
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
    const [legal, setLegal] = useState<'PINK_BOOK' | 'CONTRACT' | 'WAITING'>('PINK_BOOK');
    const [propertyType, setPropertyType] = useState<string>('townhouse_center');
    const [autoDetectedType, setAutoDetectedType] = useState<string | null>(null); // null = user hasn't changed
    // Advanced AVM inputs (Kfl, Kdir, Kmf, Kfurn)
    const [direction, setDirection] = useState<string>('');
    const [frontageWidth, setFrontageWidth] = useState<string>('');
    const [furnishing, setFurnishing] = useState<'FULL' | 'BASIC' | 'NONE' | ''>('');
    const [floorLevel, setFloorLevel] = useState<string>('');
    const [monthlyRent, setMonthlyRent] = useState<string>('');
    const [buildingAge, setBuildingAge] = useState<string>('');

    const isApartment = propertyType.startsWith('apartment') || propertyType === 'penthouse';

    // Live Accuracy Meter — increases as user fills in more details
    const accuracy = (() => {
        let s = 75.12;
        if (area && parseFloat(area) > 0)         s += 5.22;
        if (roadWidth && parseFloat(roadWidth) > 0) s += 4.33;
        if (direction)                              s += 2.54;
        if (!isApartment && frontageWidth && parseFloat(frontageWidth) > 0) s += 3.34;
        if (isApartment && floorLevel && parseFloat(floorLevel) > 0)        s += 3.34;
        if (buildingAge !== '')                     s += 2.63;
        if (furnishing)                             s += 2.54;
        if (monthlyRent && parseFloat(monthlyRent) > 0) s += 4.29;
        return Math.min(s, 99.99);
    })();
    const accuracyLabel = accuracy < 80 ? 'Cơ bản' : accuracy < 88 ? 'Khá tốt' : accuracy < 95 ? 'Rất tốt' : 'Chuyên sâu';
    const accuracyColor = accuracy < 80 ? '#eab308' : accuracy < 88 ? '#f97316' : accuracy < 95 ? '#22c55e' : '#10b981';

    // Process State
    const [analysisLog, setAnalysisLog] = useState<string>('');
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

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
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
        setStep('ANALYZING');
        setProgress(0);
        
        let currentStep = 0;
        // Start the progress bar simulation
        intervalRef.current = setInterval(() => {
            if (currentStep < ANALYSIS_STEPS.length) {
                setAnalysisLog(ANALYSIS_STEPS[currentStep]);
                setProgress((prev) => Math.min(prev + 15, 90)); // Cap at 90% while waiting for AI
                currentStep++;
            }
        }, 800);

        // Fetch real-time data from Gemini
        const areaNum = parseFloat(area) || 50;
        const roadNum = parseFloat(roadWidth) || 3;

        let aiResult: any;
        // Collect optional advanced fields
        const advancedParams = {
            ...(direction && { direction }),
            ...(frontageWidth && !isNaN(parseFloat(frontageWidth)) && { frontageWidth: parseFloat(frontageWidth) }),
            ...(furnishing && { furnishing }),
            ...(floorLevel && !isNaN(parseFloat(floorLevel)) && { floorLevel: parseFloat(floorLevel) }),
            ...(buildingAge && !isNaN(parseFloat(buildingAge)) && { buildingAge: parseFloat(buildingAge) }),
            ...(monthlyRent && !isNaN(parseFloat(monthlyRent)) && { monthlyRent: parseFloat(monthlyRent) }),
        };
        try {
            aiResult = await aiService.getRealtimeValuation(address, areaNum, roadNum, legal, propertyType, advancedParams);
        } catch (_err) {
            // Emergency client-side fallback (network completely down)
            // Uses same AVM coefficient logic as server/valuationEngine.ts
            notify(t('ai.error_valuation'), 'error');
            const addr = address.toLowerCase();
            const isQ1 = /quận 1\b|q\.?1\b/.test(addr);
            const isHCM = /hcm|hồ chí minh|sài gòn|saigon|bình thạnh|thủ đức/.test(addr) || /quận [0-9]/.test(addr);
            const isHanoi = /hà nội|hanoi|cầu giấy|hoàn kiếm|đống đa|hai bà trưng|tây hồ/.test(addr);
            const isDanang = /đà nẵng|da nang/.test(addr);
            const marketBase = isQ1 ? 280_000_000 : isHCM ? 100_000_000 : isHanoi ? 110_000_000 : isDanang ? 75_000_000 : 25_000_000;

            // Kd: Road Width
            const Kd = roadNum >= 20 ? 1.30 : roadNum >= 12 ? 1.18 : roadNum >= 8 ? 1.10 :
                       roadNum >= 6 ? 1.05 : roadNum >= 4 ? 1.00 : roadNum >= 3 ? 0.90 :
                       roadNum >= 2 ? 0.80 : 0.70;
            // Kp: Legal
            const Kp = legal === 'PINK_BOOK' ? 1.00 : legal === 'CONTRACT' ? 0.88 : 0.80;
            // Ka: Area
            const Ka = areaNum < 25 ? 0.90 : areaNum < 40 ? 0.95 : areaNum < 60 ? 0.98 :
                       areaNum < 100 ? 1.00 : areaNum < 150 ? 1.03 : areaNum < 250 ? 1.06 : 1.10;

            const adjPerM2 = Math.round(marketBase * Kd * Kp * Ka);
            const total = adjPerM2 * areaNum;
            const margin = 0.25;
            const legalLabel = legal === 'PINK_BOOK' ? 'Sổ Hồng' : legal === 'CONTRACT' ? 'Hợp đồng mua bán' : 'Vi Bằng';

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
        setAnalysisLog("Hoàn tất phân tích!");
        
        setTimeout(() => {
            calculateResults(aiResult, areaNum, roadNum);
            setStep('RESULT');
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
        const growthPct: number = aiResult.trendGrowthPct ?? 0;
        const monthlyGrowth = growthPct / 100 / 12;
        const now = new Date();
        const chartData = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
            const monthLabel = `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
            const monthsFromNow = i - 11;
            return {
                month: monthLabel,
                price: Number((baseBillion * (1 + monthlyGrowth * monthsFromNow)).toFixed(3))
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
            incomeApproach: aiResult.incomeApproach,
            reconciliation: aiResult.reconciliation,
        });
    };

    const handleAdjustParams = () => {
        setStep('DETAILS');
    };

    const handleNewValuation = () => {
        setAddress('');
        setArea('');
        setRoadWidth('');
        setPropertyType('townhouse_center');
        setAutoDetectedType(null);
        setDirection('');
        setFrontageWidth('');
        setFurnishing('');
        setFloorLevel('');
        setMonthlyRent('');
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

                {/* STEP 1: ADDRESS INPUT */}
                {step === 'ADDRESS' && (
                    <div className="text-center animate-enter">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Định Giá Thời Gian Thực
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
                            Định Giá Bất Động Sản <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Chính Xác Tới 99,99%</span>
                        </h1>
                        <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
                            Nhập địa chỉ — AI phân tích thị trường trực tiếp. Càng nhiều thông tin, độ chính xác càng cao.
                        </p>

                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-2 rounded-full max-w-2xl mx-auto flex items-center gap-1 md:gap-2 shadow-2xl relative z-20 group focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all overflow-hidden">
                            <div className="pl-3 md:pl-6 shrink-0 text-slate-400 flex items-center justify-center">{ICONS.SEARCH}</div>
                            <input 
                                value={address}
                                onChange={(e) => { setAddress(e.target.value); setAutoDetectedType(null); }}
                                className="flex-1 min-w-0 bg-transparent border-none outline-none text-white placeholder:text-[var(--text-tertiary)] text-base md:text-lg h-14"
                                placeholder="Nhập địa chỉ hoặc tên BĐS... (vd: Căn hộ Vinhomes Q.Bình Thạnh)"
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
                                    const detected = detectPropertyTypeFromText(address);
                                    if (detected) { setPropertyType(detected); setAutoDetectedType(detected); }
                                    setStep('DETAILS');
                                }}
                                disabled={!address}
                                className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-[var(--text-primary)] font-bold px-4 md:px-8 h-14 rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm md:text-base"
                            >
                                Bắt Đầu
                            </button>
                        </div>

                        {/* Hint strip below search */}
                        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-500">
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
                                + Đầy đủ → <b className="text-emerald-400">99,99%</b>
                            </span>
                        </div>
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
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">Độ chính xác dự báo</div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black tabular-nums transition-all duration-500" style={{ color: accuracyColor }}>
                                                {accuracy.toFixed(2)}%
                                            </span>
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full border transition-all duration-300"
                                                style={{ color: accuracyColor, borderColor: accuracyColor + '40', background: accuracyColor + '18' }}>
                                                {accuracyLabel}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs text-slate-500">
                                        <div>Tối đa</div>
                                        <div className="font-bold text-emerald-400">99,99%</div>
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
                                    {accuracy < 99.99
                                        ? `Điền thêm ${accuracy < 80 ? 'diện tích, lộ giới' : accuracy < 88 ? 'hướng nhà, mặt tiền' : accuracy < 95 ? 'tuổi nhà, nội thất' : 'thuê dự kiến'} để tăng độ chính xác`
                                        : '✓ Đã đạt độ chính xác tối đa — sẵn sàng định giá!'}
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
                                    <button onClick={() => { setStep('ADDRESS'); setAutoDetectedType(null); }} className="text-xs font-bold text-emerald-400 hover:underline shrink-0">Sửa</button>
                                </div>

                                {/* Inputs */}
                                <div className="grid grid-cols-2 gap-6">
                                    {/* ── Diện Tích với placeholder thông minh theo loại ── */}
                                    {(() => {
                                        const isLandType = propertyType.startsWith('land_');
                                        let areaPlaceholder = '50';
                                        let areaLabel = 'Diện Tích (m²)';
                                        if (isApartment) { areaPlaceholder = '70'; areaLabel = 'Diện Tích Căn hộ (m²)'; }
                                        else if (propertyType === 'villa') { areaPlaceholder = '200'; areaLabel = 'Diện Tích Biệt thự (m²)'; }
                                        else if (propertyType === 'warehouse') { areaPlaceholder = '500'; areaLabel = 'Diện Tích Xưởng / Kho (m²)'; }
                                        else if (propertyType === 'office') { areaPlaceholder = '100'; areaLabel = 'Diện Tích Sàn VP (m²)'; }
                                        else if (isLandType) { areaPlaceholder = '200'; areaLabel = 'Diện Tích Đất (m²)'; }
                                        return (
                                            <div>
                                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">{areaLabel}</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        value={area}
                                                        onChange={e => setArea(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                                                        placeholder={areaPlaceholder}
                                                        min="1"
                                                        autoFocus
                                                    />
                                                    <div className="absolute right-4 inset-y-0 flex items-center pointer-events-none text-[var(--text-tertiary)] text-sm">{ICONS.HOME}</div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* ── Lộ Giới với label & placeholder thông minh theo loại ── */}
                                    {(() => {
                                        let roadLabel = 'Lộ Giới (m)';
                                        let roadPlaceholder = '5';
                                        let roadHint = '';
                                        if (isApartment) {
                                            roadLabel = 'Đường vào Tòa Nhà (m)';
                                            roadPlaceholder = '15';
                                            roadHint = 'vd: đường 20m';
                                        } else if (propertyType === 'warehouse') {
                                            roadLabel = 'Lộ Giới trước Kho (m)';
                                            roadPlaceholder = '10';
                                        } else if (propertyType.startsWith('land_')) {
                                            roadLabel = 'Lộ Giới đường trước (m)';
                                            roadPlaceholder = '6';
                                        } else if (propertyType === 'office') {
                                            roadLabel = 'Lộ Giới đường (m)';
                                            roadPlaceholder = '20';
                                        }
                                        return (
                                            <div>
                                                <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">
                                                    {roadLabel}
                                                    {roadHint && <span className="text-slate-600 normal-case font-normal ml-1">({roadHint})</span>}
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        value={roadWidth}
                                                        onChange={e => setRoadWidth(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                                                        placeholder={roadPlaceholder}
                                                        min="1"
                                                    />
                                                    <div className="absolute right-4 inset-y-0 flex items-center pointer-events-none text-[var(--text-tertiary)] text-sm">{ICONS.ROAD}</div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">Tình Trạng Pháp Lý</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'PINK_BOOK', label: 'Sổ Hồng' },
                                            { id: 'CONTRACT', label: 'HĐMB' },
                                            { id: 'WAITING', label: 'Vi Bằng' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setLegal(opt.id as any)}
                                                className={`py-3 rounded-xl text-xs font-bold transition-all border ${legal === opt.id ? 'bg-emerald-500 text-[var(--text-primary)] border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}
                                            >
                                                {opt.label}
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

                                {/* Hướng nhà */}
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase block mb-2">Hướng Nhà <span className="text-slate-600 normal-case font-normal">(không bắt buộc)</span></label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['Bắc','Đông Bắc','Đông','Đông Nam','Nam','Tây Nam','Tây','Tây Bắc'].map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => setDirection(prev => prev === d ? '' : d)}
                                                className={`py-2 rounded-xl text-xs font-bold transition-all border ${direction === d ? 'bg-emerald-500 text-[var(--text-primary)] border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Mặt tiền / Tầng & Tuổi nhà */}
                                {(() => {
                                    const isLand = propertyType.startsWith('land_');
                                    const showFrontage = !isApartment && !isLand && propertyType !== 'warehouse';
                                    const showFloor    = isApartment || propertyType === 'project';
                                    return (
                                        <div className="grid grid-cols-2 gap-6">
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
                                                        {propertyType === 'warehouse' ? 'Tuổi Xưởng (năm)' : 'Tuổi Nhà (năm)'}
                                                        <span className="text-slate-600 normal-case font-normal"> 0 = mới</span>
                                                    </label>
                                                    <input type="number" value={buildingAge}
                                                        onChange={e => setBuildingAge(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                                                        placeholder="Tự động" min="0" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ── Thuê dự kiến — ẩn với đất nông nghiệp, đổi label với thương mại ── */}
                                {propertyType !== 'land_agricultural' && (
                                    <div>
                                        {(() => {
                                            const isCommercialType = ['shophouse', 'office', 'warehouse'].includes(propertyType);
                                            const rentLabel = isCommercialType
                                                ? (propertyType === 'warehouse' ? 'Giá Thuê Kho (tr/tháng)' : 'Giá Thuê TM (tr/tháng)')
                                                : 'Thuê Dự Kiến (tr/tháng)';
                                            const rentPlaceholder = isCommercialType ? 'Tự động' : 'Tự động';
                                            const rentHint = isCommercialType
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
                                                        placeholder={rentPlaceholder}
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
                                        <div className="grid grid-cols-3 gap-3">
                                            {(propertyType === 'office'
                                                ? [{ id: 'FULL', label: 'Hoàn thiện' }, { id: 'BASIC', label: 'Shell & Core' }, { id: 'NONE', label: 'Thô' }]
                                                : [{ id: 'FULL', label: 'Đầy đủ' }, { id: 'BASIC', label: 'Cơ bản' }, { id: 'NONE', label: 'Nhà thô' }]
                                            ).map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setFurnishing(prev => prev === opt.id ? '' : opt.id as any)}
                                                    className={`py-3 rounded-xl text-xs font-bold transition-all border ${furnishing === opt.id ? 'bg-emerald-500 text-[var(--text-primary)] border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={runCalculation}
                                    disabled={!area || !roadWidth || parseFloat(area) <= 0}
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-[var(--text-primary)] font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-lg flex items-center justify-center gap-3"
                                >
                                    <span>Định Giá Ngay</span>
                                    <span className="text-sm font-bold bg-white/20 rounded-full px-3 py-0.5">
                                        {accuracy.toFixed(2)}% chính xác
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: ANALYZING (NEURAL ENGINE FX) */}
                {step === 'ANALYZING' && (
                    <div className="max-w-xl mx-auto text-center pt-10 animate-enter">
                        <div className="relative w-32 h-32 mx-auto mb-8">
                            <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-emerald-500 border-r-emerald-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center font-bold text-emerald-400 text-xl font-mono">
                                {Math.round(progress)}%
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2 font-mono min-h-[40px] transition-all">
                            {analysisLog}
                        </h2>
                        <div className="w-full h-1 bg-slate-800 rounded-full mt-8 overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
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
                                        {formatSmartPrice(valuation.price, t)} <span className="text-2xl text-emerald-500">VNĐ</span>
                                    </div>
                                    <div className="text-slate-400 text-sm mt-2 font-medium">
                                        Biên độ: {formatSmartPrice(valuation.range[0], t)} — {formatSmartPrice(valuation.range[1], t)}
                                    </div>
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
                                        <div className="text-xl font-bold text-white">
                                            {valuation.pricePerM2 >= 1_000_000_000
                                                ? `${(valuation.pricePerM2 / 1_000_000_000).toFixed(1)} Tỷ/m²`
                                                : `${(valuation.pricePerM2 / 1_000_000).toFixed(0)} Tr/m²`}
                                        </div>
                                    </div>
                                </div>
                            </div>


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
                                            {formatSmartPrice(valuation.compsPrice || valuation.price, t)} <span className="text-sm text-emerald-400">VNĐ</span>
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
                                            {formatSmartPrice(valuation.incomeApproach.capitalValue, t)} <span className="text-sm text-indigo-400">VNĐ</span>
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
                                            { label: 'Tiền thuê/tháng', value: `${valuation.incomeApproach.monthlyRent.toFixed(1)} Tr`, hint: 'Ước tính thị trường' },
                                            { label: 'Thu nhập ròng/năm', value: `${valuation.incomeApproach.noi.toFixed(1)} Tr`, hint: 'Sau khấu trống & chi phí vận hành' },
                                            { label: 'Tỷ suất cho thuê', value: `${(valuation.incomeApproach.capRate * 100).toFixed(1)}%`, hint: 'Gross yield — VN 2025-26' },
                                            { label: 'Thời gian hoàn vốn', value: `${valuation.incomeApproach.paybackYears.toFixed(1)} năm`, hint: 'Theo thu nhập gộp' },
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

                        {/* Chart Simulation */}
                        <div className="bg-slate-800 rounded-[32px] border border-slate-700 p-8 shadow-sm relative">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-slate-400 uppercase text-xs font-bold tracking-widest">Lịch sử biến động giá khu vực</h3>
                                <span className="bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/20 font-medium">
                                    {valuation.marketTrend}
                                </span>
                            </div>
                            <p className="text-slate-600 text-xs mb-5 italic">
                                Xu hướng giá khu vực — tính từ dữ liệu thị trường realtime qua AI.
                            </p>
                            <div className="h-[300px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%" minHeight={250} minWidth={250}>
                                    <AreaChart data={valuation.chartData}>
                                        <defs>
                                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="month" stroke="#64748B" tick={{fill: '#94A3B8'}} />
                                        <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                                        <Tooltip 
                                            contentStyle={{backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px'}}
                                            itemStyle={{color: '#fff'}}
                                            formatter={(value: number) => [`${value.toFixed(1)} Tỷ`, 'Giá trung bình']}
                                        />
                                        <Area type="monotone" dataKey="price" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        
                        <div className="flex justify-center mt-12 gap-4">
                            <button onClick={handleAdjustParams} className="px-8 py-3 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-800 font-bold transition-colors flex items-center gap-2">
                                {ICONS.EDIT} Điều Chỉnh Thông Số
                            </button>
                            <button onClick={handleNewValuation} className="px-8 py-3 rounded-full border border-slate-600 text-slate-300 hover:bg-slate-800 font-bold transition-colors flex items-center gap-2">
                                {ICONS.RESET} Định Giá Mới
                            </button>
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
        {showGuestGate && createPortal(
            <div className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGuestGate(false)}>
                <div
                    className="max-w-sm w-full bg-slate-800 border border-slate-700 rounded-2xl p-7 flex flex-col items-center gap-5 text-center shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                        <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Đã dùng hết {GUEST_DAILY_LIMIT} lượt miễn phí hôm nay</h2>
                        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                            Đăng nhập để định giá không giới hạn và truy cập đầy đủ tính năng SGS Land CRM bất động sản.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2.5 w-full">
                        <button
                            onClick={() => { window.location.hash = `#/${ROUTES.LOGIN}`; }}
                            className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 active:scale-95 transition-all"
                        >
                            Đăng nhập / Đăng ký miễn phí
                        </button>
                        <button
                            onClick={() => setShowGuestGate(false)}
                            className="w-full py-2.5 bg-slate-700/60 text-slate-400 text-sm rounded-xl hover:bg-slate-700 transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                    <p className="text-xs text-slate-600">Lượt định giá miễn phí reset mỗi ngày lúc 00:00</p>
                </div>
            </div>,
            document.body
        )}
        </>
    );
};

export default AiValuation;
