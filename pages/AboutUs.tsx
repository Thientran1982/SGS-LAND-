
import React, { memo, useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/mockDb';
import { User } from '../types';

// -----------------------------------------------------------------------------
// ASSETS
// -----------------------------------------------------------------------------
const ASSETS = {
    OFFICE: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2301&auto=format&fit=crop",
    TEAM: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop",
    CEO: "https://ui-avatars.com/api/?name=Tran+Minh+Tuan&background=0D8ABC&color=fff&size=512",
    CTO: "https://ui-avatars.com/api/?name=Nguyen+Hoang+Nam&background=10B981&color=fff&size=512",
    COO: "https://ui-avatars.com/api/?name=Le+Thi+Hoa&background=F59E0B&color=fff&size=512"
};

const ICONS = {
    MISSION: <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    VISION: <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
    VALUES: <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
};

// FIX: Export const instead of default to match App.tsx lazyLoad configuration
export const AboutUs: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            
            {/* Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-200">
                <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={handleHome} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                        {ICONS.BACK} Trang Chủ
                    </button>
                    <div className="flex items-center gap-2">
                        <Logo className="w-6 h-6 text-indigo-600" />
                        <span className="font-bold text-lg">SGS LAND</span>
                    </div>
                    <button onClick={handleLogin} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                        {currentUser ? 'Bảng Điều Khiển' : 'Đăng Nhập'}
                    </button>
                </div>
            </div>

            {/* Hero */}
            <section className="relative py-24 bg-slate-900 text-white overflow-hidden">
                <div className="absolute inset-0 opacity-40">
                    <img src={ASSETS.OFFICE} className="w-full h-full object-cover" alt="Office" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent"></div>
                
                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center animate-enter">
                    <span className="inline-block py-1 px-3 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-6">
                        Về Chúng Tôi
                    </span>
                    <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
                        Kiến Tạo Tương Lai <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Bất Động Sản Số</span>
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                        SGS Land không chỉ là một nền tảng giao dịch. Chúng tôi là hệ điều hành thông minh giúp minh bạch hóa thị trường và tối ưu hóa mọi quyết định đầu tư.
                    </p>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 -mt-24 relative z-20">
                    <div className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100 flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">{ICONS.MISSION}</div>
                        <h3 className="text-xl font-bold text-slate-800 mb-3">Sứ Mệnh</h3>
                        <p className="text-slate-500 leading-relaxed">Minh bạch hóa thông tin, đơn giản hóa giao dịch và mang lại giá trị thực cho cộng đồng.</p>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100 flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">{ICONS.VISION}</div>
                        <h3 className="text-xl font-bold text-slate-800 mb-3">Tầm Nhìn</h3>
                        <p className="text-slate-500 leading-relaxed">Trở thành nền tảng PropTech số 1 Đông Nam Á, tích hợp AI toàn diện vào mọi quy trình.</p>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100 flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
                        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6">{ICONS.VALUES}</div>
                        <h3 className="text-xl font-bold text-slate-800 mb-3">Giá Trị Cốt Lõi</h3>
                        <p className="text-slate-500 leading-relaxed">Trung thực, Sáng tạo, Tận tâm và Công nghệ vị nhân sinh.</p>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-16 bg-white border-y border-slate-100">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    <div>
                        <div className="text-4xl font-black text-indigo-600 mb-2">5+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Năm Kinh Nghiệm</div>
                    </div>
                    <div>
                        <div className="text-4xl font-black text-emerald-600 mb-2">15k+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Môi Giới Tin Dùng</div>
                    </div>
                    <div>
                        <div className="text-4xl font-black text-amber-500 mb-2">45k+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tin Đăng Xác Thực</div>
                    </div>
                    <div>
                        <div className="text-4xl font-black text-rose-500 mb-2">$2B+</div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Giá Trị Giao Dịch</div>
                    </div>
                </div>
            </section>

            {/* Leadership */}
            <section className="py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Đội Ngũ Lãnh Đạo</h2>
                        <p className="text-slate-500 max-w-2xl mx-auto">Những chuyên gia hàng đầu trong lĩnh vực Bất động sản và Công nghệ.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { name: "Trần Minh Tuấn", role: "Founder & CEO", img: ASSETS.CEO, bio: "15 năm kinh nghiệm quản lý đầu tư BĐS và tư vấn pháp lý." },
                            { name: "Nguyễn Hoàng Nam", role: "CTO", img: ASSETS.CTO, bio: "Chuyên gia AI." },
                            { name: "Lê Thị Hoa", role: "COO", img: ASSETS.COO, bio: "Chuyên gia vận hành chuỗi sàn giao dịch." }
                        ].map((leader, i) => (
                            <div key={i} className="bg-white p-6 rounded-[24px] border border-slate-100 text-center group hover:border-indigo-100 transition-colors">
                                <div className="w-32 h-32 mx-auto rounded-full overflow-hidden mb-6 border-4 border-slate-50 shadow-lg group-hover:scale-105 transition-transform">
                                    <img src={leader.img} className="w-full h-full object-cover" alt={leader.name} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">{leader.name}</h3>
                                <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4">{leader.role}</div>
                                <p className="text-sm text-slate-500 leading-relaxed">{leader.bio}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <section className="py-24 bg-slate-900 text-center px-6">
                <h2 className="text-3xl font-bold text-white mb-6">Sẵn sàng hợp tác cùng chúng tôi?</h2>
                <button 
                    onClick={() => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`}
                    className="px-8 py-4 bg-white text-slate-900 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                >
                    {currentUser ? 'Đến Bảng Điều Khiển' : 'Liên Hệ Ngay'}
                </button>
            </section>
        </div>
    );
};
