
import React, { useState, useEffect } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { User } from '../types';

const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    ROCKET: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    LOCATION: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    CLOCK: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    MONEY: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    ARROW: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
};

const JOBS = [
    {
        id: 1,
        title: "Senior Full-stack Engineer",
        dept: "Engineering",
        location: "TP. Hồ Chí Minh",
        type: "Full-time",
        salary: "$2,500 - $4,000",
        tags: ["React", "Node.js", "AI"]
    },
    {
        id: 2,
        title: "AI Research Scientist",
        dept: "Data Science",
        location: "Remote / Hybrid",
        type: "Full-time",
        salary: "Thỏa thuận",
        tags: ["Python", "LLM", "TensorFlow"]
    },
    {
        id: 3,
        title: "Trưởng Phòng Kinh Doanh B2B",
        dept: "Sales",
        location: "Hà Nội",
        type: "Full-time",
        salary: "$1,500 + Commission",
        tags: ["B2B", "Real Estate", "SaaS"]
    },
    {
        id: 4,
        title: "Product Designer (UI/UX)",
        dept: "Product",
        location: "TP. Hồ Chí Minh",
        type: "Full-time",
        salary: "$1,200 - $2,000",
        tags: ["Figma", "Design System"]
    }
];

export const Careers: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;

    const handleApply = (jobTitle: string) => {
        alert(`Cảm ơn bạn đã quan tâm vị trí ${jobTitle}. Vui lòng gửi CV về careers@sgsland.vn`);
    };

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 pb-20 overflow-y-auto h-[100dvh] no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-200">
                <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={handleHome} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                        {ICONS.BACK} Trang Chủ
                    </button>
                    <div className="flex items-center gap-2">
                        <Logo className="w-6 h-6 text-indigo-600" />
                        <span className="font-bold text-lg">TUYỂN DỤNG</span>
                    </div>
                    <button onClick={handleLogin} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-sm">
                        {currentUser ? 'Bảng Điều Khiển' : 'Đăng Nhập'}
                    </button>
                </div>
            </div>

            {/* Hero */}
            <section className="py-24 px-6 text-center bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900"></div>
                <div className="relative z-10 max-w-4xl mx-auto animate-enter">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-widest mb-8">
                        Đang tuyển dụng
                    </div>
                    <h1 className="text-4xl md:text-7xl font-extrabold mb-8 tracking-tight leading-tight">
                        Cùng Kiến Tạo <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Tương Lai PropTech</span>
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed">
                        Gia nhập đội ngũ những người tiên phong, đam mê công nghệ và khát khao thay đổi thị trường bất động sản Việt Nam.
                    </p>
                    <button onClick={() => document.getElementById('jobs')?.scrollIntoView({behavior: 'smooth'})} className="px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl">
                        Xem Vị Trí Đang Tuyển
                    </button>
                </div>
            </section>

            {/* Values */}
            <section className="py-24 bg-slate-50 border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-xl">1</div>
                            <h3 className="text-2xl font-bold text-slate-900">Đổi Mới Không Ngừng</h3>
                            <p className="text-slate-500 leading-relaxed">Chúng tôi không làm theo lối mòn. Tại SGS, bạn được khuyến khích thử nghiệm, sai và học hỏi từ những công nghệ mới nhất.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-xl">2</div>
                            <h3 className="text-2xl font-bold text-slate-900">Con Người Là Trung Tâm</h3>
                            <p className="text-slate-500 leading-relaxed">Môi trường làm việc cởi mở, tôn trọng sự khác biệt. Phúc lợi toàn diện cho bạn và gia đình.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center font-bold text-xl">3</div>
                            <h3 className="text-2xl font-bold text-slate-900">Tác Động Thực Tế</h3>
                            <p className="text-slate-500 leading-relaxed">Mỗi dòng code, mỗi chiến dịch của bạn đều góp phần minh bạch hóa thị trường BĐS hàng tỷ đô la.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Job Listings */}
            <section id="jobs" className="py-24 px-6 bg-white">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl font-bold text-slate-900 mb-12 text-center">Vị Trí Đang Tuyển</h2>
                    <div className="space-y-6">
                        {JOBS.map(job => (
                            <div key={job.id} className="group bg-white border border-slate-200 rounded-[24px] p-6 hover:border-indigo-200 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-wide">{job.dept}</span>
                                            {job.tags.map(tag => (
                                                <span key={tag} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">{tag}</span>
                                            ))}
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{job.title}</h3>
                                        <div className="flex items-center gap-4 text-sm text-slate-500">
                                            <span className="flex items-center gap-1.5">{ICONS.LOCATION} {job.location}</span>
                                            <span className="flex items-center gap-1.5">{ICONS.CLOCK} {job.type}</span>
                                            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">{ICONS.MONEY} {job.salary}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleApply(job.title)}
                                        className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg group-hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        Ứng Tuyển Ngay {ICONS.ARROW}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};
