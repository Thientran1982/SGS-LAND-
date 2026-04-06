
import React, { useState, useEffect, useMemo } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { User } from '../types';

const ICONS = {
    BACK: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
    SEARCH: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    X: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    CHEVRON_DOWN: <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
    HOME: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    ACCOUNT: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    LEGAL: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    SECURITY: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
};

type Article = { id: number; q: string; a: string; cat: string };

const ARTICLES: Article[] = [
    {
        id: 1,
        cat: 'mua-ban',
        q: 'Quy trình mua bất động sản qua SGS LAND như thế nào?',
        a: 'Quy trình mua bất động sản qua SGS LAND gồm 5 bước: (1) Tìm kiếm và lọc sản phẩm phù hợp theo nhu cầu. (2) Liên hệ tư vấn viên SGS LAND để được tư vấn miễn phí. (3) Khảo sát thực tế và ký hợp đồng đặt cọc. (4) Hoàn thiện thủ tục pháp lý và thanh toán. (5) Bàn giao sản phẩm. Đội ngũ pháp lý SGS LAND hỗ trợ toàn bộ quy trình từ A đến Z.',
    },
    {
        id: 2,
        cat: 'mua-ban',
        q: 'Tôi cần những giấy tờ gì để mua căn hộ/đất nền?',
        a: 'Để mua bất động sản tại Việt Nam, bạn cần chuẩn bị: (1) CCCD/CMND còn hiệu lực của người mua. (2) Giấy xác nhận tình trạng hôn nhân (nếu đã kết hôn, cần giấy tờ của cả hai vợ chồng). (3) Chứng từ tài chính nếu vay ngân hàng (sao kê lương, hợp đồng lao động). (4) Đối với người nước ngoài: hộ chiếu, thị thực cư trú hợp lệ. SGS LAND sẽ hỗ trợ kiểm tra và hoàn thiện hồ sơ cho bạn.',
    },
    {
        id: 3,
        cat: 'mua-ban',
        q: 'Tôi có thể vay ngân hàng mua bất động sản qua SGS LAND không?',
        a: 'Có. SGS LAND là đối tác chiến lược với hơn 15 ngân hàng thương mại lớn tại Việt Nam (Vietcombank, BIDV, Techcombank, MB Bank, VPBank…). Chúng tôi hỗ trợ tư vấn và kết nối vay vốn với lãi suất ưu đãi, thủ tục nhanh chóng. Tỷ lệ vay tối đa thường đạt 70–80% giá trị bất động sản, thời hạn lên đến 25 năm. Liên hệ info@sgsland.vn để được tư vấn miễn phí.',
    },
    {
        id: 4,
        cat: 'tai-khoan',
        q: 'Làm thế nào để đăng ký tài khoản SGS LAND?',
        a: 'Đăng ký tài khoản SGS LAND rất đơn giản: (1) Nhấn "Đăng Nhập / Đăng Ký" trên trang chủ. (2) Chọn "Tạo tài khoản mới". (3) Điền họ tên, email và mật khẩu. (4) Xác nhận email qua đường link được gửi về hộp thư. (5) Đăng nhập và bắt đầu tìm kiếm bất động sản. Tài khoản hoàn toàn miễn phí với người dùng cá nhân.',
    },
    {
        id: 5,
        cat: 'tai-khoan',
        q: 'Tôi quên mật khẩu, làm sao lấy lại?',
        a: 'Để lấy lại mật khẩu: (1) Vào trang Đăng Nhập, nhấn "Quên mật khẩu?". (2) Nhập địa chỉ email đã đăng ký. (3) Kiểm tra email và nhấn vào đường link đặt lại mật khẩu (có hiệu lực trong 30 phút). (4) Tạo mật khẩu mới và đăng nhập. Nếu không nhận được email, kiểm tra thư mục Spam hoặc liên hệ info@sgsland.vn.',
    },
    {
        id: 6,
        cat: 'tai-khoan',
        q: 'Tôi có thể đăng tin bất động sản trên SGS LAND không?',
        a: 'Có. Để đăng tin bất động sản, bạn cần: (1) Đăng nhập tài khoản. (2) Vào Dashboard → Đăng Tin Mới. (3) Điền đầy đủ thông tin: loại bất động sản, địa chỉ, giá, diện tích, ảnh (tối thiểu 5 ảnh chất lượng cao). (4) Xác minh thông tin pháp lý. (5) Tin được duyệt trong vòng 24 giờ làm việc. Lưu ý: chỉ được đăng tin bất động sản thuộc quyền sở hữu hợp pháp hoặc được ủy quyền bán.',
    },
    {
        id: 7,
        cat: 'phap-ly',
        q: 'Sổ hồng và Sổ đỏ khác nhau như thế nào?',
        a: 'Đây là câu hỏi rất phổ biến: Sổ đỏ (Giấy chứng nhận quyền sử dụng đất) cấp cho đất ở, đất nông nghiệp và các loại đất khác. Sổ hồng (Giấy chứng nhận quyền sở hữu nhà ở và quyền sử dụng đất ở) cấp cho nhà ở riêng lẻ và căn hộ chung cư. Từ năm 2009, hai loại này được hợp nhất thành một mẫu Giấy chứng nhận duy nhất theo Luật Đất đai 2013. Tuy nhiên người dân vẫn thường gọi theo màu sắc cũ. SGS LAND kiểm tra pháp lý toàn bộ trước khi đăng tin.',
    },
    {
        id: 8,
        cat: 'phap-ly',
        q: 'Người nước ngoài có được mua nhà tại Việt Nam không?',
        a: 'Theo Luật Nhà ở 2014 (sửa đổi 2023), người nước ngoài được phép mua và sở hữu nhà ở tại Việt Nam với điều kiện: (1) Có thị thực nhập cảnh hợp lệ vào Việt Nam. (2) Tổng số căn hộ ngoại kiều không vượt quá 30% trong mỗi tòa nhà chung cư, hoặc 250 căn trong một phường. (3) Thời hạn sở hữu 50 năm và có thể gia hạn. Không được sở hữu nhà ở khu vực an ninh quốc phòng. Liên hệ SGS LAND để được tư vấn chi tiết.',
    },
    {
        id: 9,
        cat: 'bao-mat',
        q: 'SGS LAND bảo vệ thông tin cá nhân của tôi như thế nào?',
        a: 'SGS LAND tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Thông tin của bạn được: (1) Mã hóa SSL/TLS toàn bộ dữ liệu truyền tải. (2) Lưu trữ trên máy chủ bảo mật cao tại Việt Nam. (3) Không chia sẻ với bên thứ ba khi chưa có sự đồng ý của bạn. (4) Bạn có quyền yêu cầu xem, sửa hoặc xóa dữ liệu bất kỳ lúc nào bằng cách gửi email đến info@sgsland.vn.',
    },
    {
        id: 10,
        cat: 'bao-mat',
        q: 'Chính sách bảo mật và điều khoản sử dụng của SGS LAND?',
        a: 'SGS LAND cam kết: (1) Chỉ thu thập dữ liệu cần thiết cho mục đích cung cấp dịch vụ. (2) Không bán hoặc cho thuê dữ liệu cá nhân. (3) Thông báo người dùng trong vòng 72 giờ nếu có sự cố rò rỉ dữ liệu. (4) Cho phép người dùng tải xuống toàn bộ dữ liệu của mình. Để xem đầy đủ Chính sách Bảo mật và Điều khoản Dịch vụ, vui lòng truy cập trang Pháp Lý hoặc liên hệ info@sgsland.vn.',
    },
];

const CATEGORIES = [
    { id: 'mua-ban',  label: 'Mua Bán BĐS',     color: 'bg-indigo-50 text-indigo-600',  icon: ICONS.HOME },
    { id: 'tai-khoan', label: 'Tài Khoản',        color: 'bg-blue-50 text-blue-600',      icon: ICONS.ACCOUNT },
    { id: 'phap-ly',  label: 'Pháp Lý',           color: 'bg-emerald-50 text-emerald-600', icon: ICONS.LEGAL },
    { id: 'bao-mat',  label: 'Bảo Mật & Dữ Liệu', color: 'bg-rose-50 text-rose-600',     icon: ICONS.SECURITY },
];

export const HelpCenter: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [openArticleId, setOpenArticleId] = useState<number | null>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);
    }, []);

    const handleHome    = () => window.location.hash = `#/${ROUTES.LANDING}`;
    const handleLogin   = () => window.location.hash = currentUser ? `#/${ROUTES.DASHBOARD}` : `#/${ROUTES.LOGIN}`;
    const handleContact = () => window.location.hash = `#/${ROUTES.CONTACT}`;

    const filtered = useMemo(() => {
        let list = ARTICLES;
        if (activeCategory) list = list.filter(a => a.cat === activeCategory);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(a => a.q.toLowerCase().includes(q) || a.a.toLowerCase().includes(q));
        }
        return list;
    }, [searchQuery, activeCategory]);

    const toggleArticle = (id: number) =>
        setOpenArticleId(prev => (prev === id ? null : id));

    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] pb-20 overflow-y-auto h-[100dvh] no-scrollbar">

            {/* Header */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-2">
                    <button onClick={handleHome} className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-secondary)] hover:text-indigo-600 transition-colors min-h-[44px] shrink-0">
                        {ICONS.BACK} <span className="hidden sm:inline">Trang Chủ</span>
                    </button>
                    <div className="flex items-center gap-2 min-w-0">
                        <Logo className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 shrink-0" />
                        <span className="font-bold text-base sm:text-lg hidden sm:inline truncate">TRUNG TÂM HỖ TRỢ</span>
                    </div>
                    <button onClick={handleLogin} className="px-3 sm:px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg active:scale-95 text-xs sm:text-sm min-h-[44px] shrink-0 whitespace-nowrap">
                        {currentUser ? 'Dashboard' : 'Đăng Nhập'}
                    </button>
                </div>
            </div>

            {/* Hero Search */}
            <section className="bg-slate-900 py-20 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-slate-900" />
                <div className="relative z-10 max-w-2xl mx-auto animate-enter">
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Chúng tôi có thể giúp gì?</h1>
                    <p className="text-base text-slate-300 mb-8">Tìm câu trả lời nhanh về mua bán bất động sản, tài khoản và pháp lý.</p>
                    <div className="relative group">
                        <div className="absolute left-5 inset-y-0 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
                            {ICONS.SEARCH}
                        </div>
                        <input
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setOpenArticleId(null); }}
                            className="w-full h-14 pl-14 pr-12 rounded-2xl bg-white/10 text-white text-base shadow-2xl focus:ring-4 focus:ring-indigo-500/40 outline-none transition-all placeholder:text-slate-400 border border-white/10 focus:border-indigo-400 focus:bg-white/15"
                            placeholder="Tìm kiếm: sổ hồng, vay ngân hàng, đăng ký tài khoản…"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-4 inset-y-0 flex items-center text-slate-400 hover:text-white transition-colors">
                                {ICONS.X}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* User Guide Banner */}
            <div className="bg-gradient-to-r from-emerald-900/60 to-slate-900 border-b border-emerald-800/40">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Mới dùng SGS LAND lần đầu?</p>
                            <p className="text-xs text-slate-400">Xem hướng dẫn chi tiết 12 tính năng — từ định giá AI đến quản lý lead và hợp đồng.</p>
                        </div>
                    </div>
                    <a
                        href={`/#/huong-dan-su-dung`}
                        className="shrink-0 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                        Xem hướng dẫn →
                    </a>
                </div>
            </div>

            {/* Categories */}
            <div className="max-w-5xl mx-auto px-6 pt-8 relative z-20">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => { setActiveCategory(prev => prev === cat.id ? null : cat.id); setOpenArticleId(null); }}
                            className={`bg-[var(--bg-surface)] p-5 rounded-2xl shadow-xl border transition-all text-left group hover:-translate-y-0.5 ${activeCategory === cat.id ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-[var(--glass-border)]'}`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${cat.color} group-hover:scale-110 transition-transform`}>
                                {cat.icon}
                            </div>
                            <p className={`font-bold text-sm ${activeCategory === cat.id ? 'text-indigo-600' : 'text-[var(--text-primary)]'}`}>{cat.label}</p>
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{ARTICLES.filter(a => a.cat === cat.id).length} bài viết</p>
                        </button>
                    ))}
                </div>

                {/* Articles accordion */}
                <div className="bg-[var(--bg-surface)] rounded-[28px] border border-[var(--glass-border)] shadow-sm overflow-hidden mb-12">
                    <div className="px-8 py-6 border-b border-[var(--glass-border)] flex items-center justify-between">
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">
                            {activeCategory
                                ? `${CATEGORIES.find(c => c.id === activeCategory)?.label} — Câu hỏi thường gặp`
                                : 'Bài viết phổ biến'}
                        </h2>
                        {(activeCategory || searchQuery) && (
                            <button
                                onClick={() => { setActiveCategory(null); setSearchQuery(''); setOpenArticleId(null); }}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                            >
                                {ICONS.X} Xóa lọc
                            </button>
                        )}
                    </div>

                    {filtered.length > 0 ? (
                        <div className="divide-y divide-[var(--glass-border)]">
                            {filtered.map(article => (
                                <div key={article.id}>
                                    <button
                                        onClick={() => toggleArticle(article.id)}
                                        className="w-full flex items-center justify-between px-8 py-5 text-left hover:bg-[var(--glass-surface)] transition-colors group"
                                    >
                                        <span className={`font-medium text-sm md:text-base pr-4 transition-colors ${openArticleId === article.id ? 'text-indigo-600' : 'text-[var(--text-secondary)] group-hover:text-indigo-600'}`}>
                                            {article.q}
                                        </span>
                                        <span className={`shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${openArticleId === article.id ? 'rotate-180 text-indigo-500' : ''}`}>
                                            {ICONS.CHEVRON_DOWN}
                                        </span>
                                    </button>
                                    {openArticleId === article.id && (
                                        <div className="px-8 pb-6">
                                            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                                                {article.a}
                                            </div>
                                            <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                                                Cần hỗ trợ thêm?{' '}
                                                <button onClick={handleContact} className="text-indigo-600 font-bold hover:underline">Liên hệ đội ngũ SGS LAND</button>
                                                {' '}hoặc gửi email đến <strong>info@sgsland.vn</strong>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 px-6">
                            <p className="text-[var(--text-tertiary)] text-base">Không tìm thấy kết quả nào cho <strong>"{searchQuery}"</strong></p>
                            <button onClick={handleContact} className="mt-4 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                                Gửi câu hỏi đến đội ngũ hỗ trợ
                            </button>
                        </div>
                    )}
                </div>

                {/* CTA */}
                <div className="text-center mb-6">
                    <p className="text-[var(--text-tertiary)] mb-4 text-sm">Không tìm thấy nội dung bạn cần?</p>
                    <button
                        onClick={handleContact}
                        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                    >
                        Liên Hệ Hỗ Trợ Trực Tiếp
                    </button>
                </div>
            </div>
        </div>
    );
};
