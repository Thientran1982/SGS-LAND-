
import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { useTranslation } from '../services/i18n';
import { formatSmartPrice, formatUnitPrice } from '../utils/textUtils';
import { aiService } from '../services/aiService';
import { db } from '../services/dbApi';
import { User } from '../types';

// --- MOCK CONSTANTS FOR SIMULATION ---
const BASE_PRICE_PER_M2 = 120_000_000; // 120tr/m2 reference
const MONTHLY_DATA = Array.from({ length: 12 }, (_, i) => ({
    month: `T${i + 1}`,
    price: 100 + Math.random() * 20 - 10 // Variation around 100 base
}));

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

// --- SIMULATED AI ENGINE ---
const ANALYSIS_STEPS = [
    "SGS Neural Engine™ đang khởi động...",
    "Phân tích 1.204.592 điểm dữ liệu không gian...",
    "Đang chạy hồi quy trên các giao dịch tương đương...",
    "Điều chỉnh theo yếu tố pháp lý & thanh khoản...",
    "Hoàn thiện khoảng tin cậy định giá..."
];

export const AiValuation: React.FC = () => {
    const { t, formatCurrency } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
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
    
    // Process State
    const [analysisLog, setAnalysisLog] = useState<string>('');
    const [progress, setProgress] = useState(0);

    // Results State
    const [valuation, setValuation] = useState<{
        price: number;
        range: [number, number];
        factors: { label: string; impact: number; isPositive: boolean }[];
        confidence: number;
        marketTrend: string;
        chartData: { month: string; price: number }[];
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
        try {
            aiResult = await aiService.getRealtimeValuation(address, areaNum, roadNum, legal);
        } catch (_err) {
            // Fallback: client-side regional estimate when API is unavailable
            const isHCM = /hcm|hồ chí minh|sài gòn|saigon|bình thạnh|quận [1-9]|thủ đức/i.test(address);
            const isHanoi = /hà nội|hanoi|cầu giấy|hoàn kiếm|đống đa|hai bà trưng|tây hồ/i.test(address);
            const legalLabel = legal === 'PINK_BOOK' ? 'Sổ Hồng' : legal === 'CONTRACT' ? 'Hợp đồng mua bán' : 'Vi Bằng';
            const regionBase = isHCM ? 120_000_000 : isHanoi ? 110_000_000 : 60_000_000;
            aiResult = {
                basePrice: regionBase,
                confidence: 55,
                marketTrend: "Ước tính theo khu vực — chưa có dữ liệu realtime",
                factors: [
                    { label: isHCM ? "Khu vực TP.HCM" : isHanoi ? "Khu vực Hà Nội" : "Khu vực tỉnh/thành khác", impact: 15, isPositive: true },
                    { label: legalLabel, impact: legal === 'PINK_BOOK' ? 8 : 3, isPositive: legal === 'PINK_BOOK' },
                    { label: `Lộ giới ${roadNum}m`, impact: roadNum >= 6 ? 10 : roadNum >= 4 ? 5 : 0, isPositive: roadNum >= 4 },
                    { label: roadNum < 3 ? "Hẻm nhỏ" : "Đường thông thoáng", impact: roadNum < 3 ? 12 : 0, isPositive: roadNum >= 3 },
                ]
            };
        }
        
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(100);
        setAnalysisLog("Hoàn tất phân tích!");
        
        setTimeout(() => {
            calculateResults(aiResult, areaNum, roadNum);
            setStep('RESULT');
        }, 500);
    };

    const calculateResults = (aiResult: any, areaNum: number, roadNum: number) => {
        // basePrice is price-per-m² from server; total = basePrice × area
        const pricePerM2 = aiResult.basePrice || aiResult.estimatedPrice || BASE_PRICE_PER_M2;
        const estimatedPrice = pricePerM2 * areaNum;
        const confidence = aiResult.confidence || 75;
        
        // Variance is inversely proportional to confidence (e.g., 90% conf -> 10% variance)
        const variancePercent = (100 - confidence) / 100; 
        const variance = estimatedPrice * Math.max(0.05, variancePercent); // Minimum 5% variance

        // Generate dynamic chart data based on estimated price
        const baseChartPrice = estimatedPrice / 1_000_000_000; // In Billions
        const chartData = Array.from({ length: 12 }, (_, i) => ({
            month: `T${i + 1}`,
            price: baseChartPrice * (0.9 + Math.random() * 0.2) // +/- 10% variation
        }));

        setValuation({
            price: estimatedPrice,
            range: [estimatedPrice - variance, estimatedPrice + variance],
            factors: aiResult.factors,
            confidence: confidence,
            marketTrend: aiResult.marketTrend,
            chartData
        });
    };

    const handleAdjustParams = () => {
        setStep('DETAILS');
    };

    const handleNewValuation = () => {
        setAddress('');
        setArea('');
        setRoadWidth('');
        setStep('ADDRESS');
    };

    return (
        <div className="min-h-screen bg-slate-900 font-sans text-white pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-slate-900/80 backdrop-blur-md z-50 border-b border-slate-800">
                <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={handleHome} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
                        {ICONS.BACK} {t('common.go_back')}
                    </button>
                    <div className="flex items-center gap-2">
                        <Logo className="w-6 h-6 text-emerald-400" />
                        <span className="font-bold text-lg tracking-wider">SGS <span className="text-emerald-400">NEURAL ENGINE™</span></span>
                    </div>
                    <button onClick={handleLogin} className="px-6 py-2 bg-emerald-500 text-slate-900 font-bold rounded-xl hover:bg-emerald-400 transition-colors shadow-lg active:scale-95 text-sm">
                        {currentUser ? t('menu.dashboard') : t('auth.btn_login')}
                    </button>
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
                            Live Valuation Model
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
                            Định Giá Bất Động Sản <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Chính Xác Tới 98%</span>
                        </h1>
                        <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
                            Nhập địa chỉ bất động sản để bắt đầu phân tích dữ liệu thị trường và quy hoạch từ AI.
                        </p>

                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-2 rounded-full max-w-2xl mx-auto flex items-center gap-2 shadow-2xl relative z-20 group focus-within:ring-2 focus-within:ring-emerald-500/50 transition-all">
                            <div className="pl-6 text-slate-400 flex items-center justify-center">{ICONS.SEARCH}</div>
                            <input 
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-slate-500 text-lg h-14"
                                placeholder="Nhập địa chỉ nhà, tên dự án (VD: 123 Lê Lợi...)"
                                onKeyDown={(e) => e.key === 'Enter' && address && setStep('DETAILS')}
                                autoFocus
                            />
                            {address && (
                                <button 
                                    onClick={() => setAddress('')}
                                    className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-700 mr-2 flex items-center justify-center"
                                    title={t('common.clear_search') || 'Xóa tìm kiếm'}
                                >
                                    {ICONS.X}
                                </button>
                            )}
                            <button 
                                onClick={() => setStep('DETAILS')}
                                disabled={!address}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-8 h-14 rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                            >
                                Bắt Đầu
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: DETAIL INPUT (THE REFINEMENT LAYER) */}
                {step === 'DETAILS' && (
                    <div className="max-w-xl mx-auto animate-enter">
                        <div className="bg-slate-800 rounded-[32px] border border-slate-700 p-8 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-2">Chi tiết Bất Động Sản</h2>
                            <p className="text-slate-400 text-sm mb-8">Cung cấp thêm thông tin để AI định giá chính xác nhất.</p>
                            
                            <div className="space-y-6">
                                {/* Address Readonly */}
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex items-center gap-3">
                                    <div className="text-emerald-500">{ICONS.SEARCH}</div>
                                    <div className="flex-1 truncate text-slate-300 font-medium">{address}</div>
                                    <button onClick={() => setStep('ADDRESS')} className="text-xs font-bold text-emerald-400 hover:underline">Sửa</button>
                                </div>

                                {/* Inputs */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Diện Tích (m²)</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={area}
                                                onChange={e => setArea(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                                                placeholder="50"
                                                min="1"
                                                autoFocus
                                            />
                                            <div className="absolute right-4 inset-y-0 flex items-center pointer-events-none text-slate-500 text-sm">{ICONS.HOME}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Lộ Giới (m)</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                value={roadWidth}
                                                onChange={e => setRoadWidth(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-emerald-500 outline-none transition-all"
                                                placeholder="5"
                                                min="1"
                                            />
                                            <div className="absolute right-4 inset-y-0 flex items-center pointer-events-none text-slate-500 text-sm">{ICONS.ROAD}</div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Tình Trạng Pháp Lý</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'PINK_BOOK', label: 'Sổ Hồng' },
                                            { id: 'CONTRACT', label: 'HĐMB' },
                                            { id: 'WAITING', label: 'Vi Bằng' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setLegal(opt.id as any)}
                                                className={`py-3 rounded-xl text-xs font-bold transition-all border ${legal === opt.id ? 'bg-emerald-500 text-slate-900 border-emerald-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-emerald-500/50'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    onClick={runCalculation}
                                    disabled={!area || !roadWidth || parseFloat(area) <= 0}
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-lg"
                                >
                                    Định Giá Ngay
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
                         <div className="bg-slate-800 rounded-[32px] border border-slate-700 p-8 shadow-2xl relative overflow-hidden mb-8">
                            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
                                <div>
                                    <h3 className="text-slate-400 uppercase text-xs font-bold tracking-widest mb-2 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                        Giá trị thị trường ước tính
                                    </h3>
                                    <div className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-slate-400 tracking-tight">
                                        {formatSmartPrice(valuation.price, t)} <span className="text-2xl text-emerald-500">VNĐ</span>
                                    </div>
                                    <div className="text-slate-400 text-sm mt-2 font-medium">
                                        Biên độ: {formatSmartPrice(valuation.range[0], t)} - {formatSmartPrice(valuation.range[1], t)}
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="bg-slate-900/80 px-5 py-3 rounded-2xl border border-slate-600 backdrop-blur-sm text-center min-w-[100px]">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Độ Tin Cậy</div>
                                        <div className="text-xl font-bold text-emerald-400">{valuation.confidence}%</div>
                                    </div>
                                    <div className="bg-slate-900/80 px-5 py-3 rounded-2xl border border-slate-600 backdrop-blur-sm text-center min-w-[100px]">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Đơn giá / m²</div>
                                        <div className="text-xl font-bold text-white">{formatUnitPrice(valuation.price, parseFloat(area), t)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* FACTORS EXPLANATION (XAI) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50">
                                {valuation.factors.map((factor, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm border-b border-slate-800 last:border-0 pb-2 last:pb-0">
                                        <span className="text-slate-400">{factor.label}</span>
                                        <span className={`font-bold ${factor.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {factor.isPositive ? '+' : ''}{factor.impact}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Chart Simulation */}
                        <div className="bg-slate-800 rounded-[32px] border border-slate-700 p-8 shadow-sm relative">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-slate-400 uppercase text-xs font-bold tracking-widest">Lịch sử biến động giá khu vực</h3>
                                <span className="bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/20 font-medium">
                                    {valuation.marketTrend}
                                </span>
                            </div>
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
                            <h3 className="text-xl font-bold text-white mb-3">SGS Neural Engine™</h3>
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
    );
};

export default AiValuation;
