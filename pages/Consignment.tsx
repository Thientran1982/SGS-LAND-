import React, { useState, useEffect, useRef } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { useTranslation } from '../services/i18n';
import { db } from '../services/dbApi';
import { User } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
    name: string;
    phone: string;
    email: string;
    propertyType: string;
    transaction: 'SELL' | 'RENT';
    address: string;
    area: string;
    price: string;
    notes: string;
    agreed: boolean;
}

const INITIAL_FORM: FormData = {
    name: '', phone: '', email: '',
    propertyType: '', transaction: 'SELL',
    address: '', area: '', price: '',
    notes: '', agreed: false,
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROCESS_STEPS = [
    {
        num: '01',
        icon: '📋',
        title: 'Tiếp nhận hồ sơ',
        desc: 'Điền form đăng ký ký gửi. Chuyên viên SGS LAND liên hệ trong vòng 4 giờ làm việc để xác nhận thông tin và thu thập hồ sơ pháp lý ban đầu.',
        detail: 'Giấy chứng nhận quyền sử dụng đất, CMND/CCCD chủ sở hữu, giấy phép xây dựng (nếu có)',
    },
    {
        num: '02',
        icon: '⚖️',
        title: 'Thẩm định pháp lý',
        desc: 'Đội ngũ pháp lý SGS LAND kiểm tra tính hợp lệ của hồ sơ: tình trạng tranh chấp, quy hoạch, nghĩa vụ tài chính còn lại.',
        detail: 'Hoàn thành trong 1–3 ngày làm việc. Kết quả thẩm định được thông báo bằng văn bản.',
    },
    {
        num: '03',
        icon: '📝',
        title: 'Ký kết hợp đồng ký gửi',
        desc: 'Hai bên ký Hợp đồng Ký gửi Bất động sản xác định rõ mức hoa hồng, thời hạn ký gửi, quyền và nghĩa vụ từng bên. Hợp đồng có giá trị pháp lý đầy đủ.',
        detail: 'Căn cứ: Điều 41–42 Luật KDBĐS 2023 & Nghị định 96/2024/NĐ-CP.',
    },
    {
        num: '04',
        icon: '📣',
        title: 'Định giá & Triển khai marketing',
        desc: 'Định giá bằng AI (AVM) kết hợp thẩm định thực tế. Đăng tin trên SGS LAND, sàn giao dịch đối tác, mạng xã hội và kênh môi giới nội bộ.',
        detail: 'Bộ ảnh chuyên nghiệp, video thực tế, mô tả chuẩn SEO — tất cả miễn phí khi ký gửi.',
    },
    {
        num: '05',
        icon: '🤝',
        title: 'Kết nối khách & Đàm phán',
        desc: 'Môi giới SGS LAND dẫn dắt toàn bộ quá trình xem nhà, đàm phán giá, điều khoản hợp đồng mua bán / thuê — chủ sở hữu không cần trực tiếp gặp gỡ.',
        detail: 'Chủ sở hữu được cập nhật tiến độ định kỳ qua app hoặc email.',
    },
    {
        num: '06',
        icon: '💰',
        title: 'Ký kết & Thu hoa hồng',
        desc: 'Sau khi hợp đồng mua bán / thuê được ký kết hợp lệ và tiền cọc hoặc tiền mua được chuyển vào tài khoản của chủ sở hữu, hoa hồng của SGS LAND được thanh toán theo hợp đồng ký gửi.',
        detail: 'Hoa hồng chỉ phát sinh khi giao dịch thành công — không thu phí nếu không giao dịch.',
    },
];

const COMMISSION_TABLE = [
    {
        type: 'Mua bán bất động sản',
        rate: '1% – 2%',
        base: 'Giá trị hợp đồng mua bán',
        min: '30.000.000 VNĐ',
        note: 'Thu khi hợp đồng công chứng & tiền cọc / đặt cọc được thanh toán',
    },
    {
        type: 'Cho thuê (≥ 12 tháng)',
        rate: '1 tháng tiền thuê',
        base: 'Giá thuê tháng đầu tiên',
        min: '5.000.000 VNĐ',
        note: 'Thu khi hợp đồng thuê ký kết và tiền cọc được chuyển cho chủ nhà',
    },
    {
        type: 'Cho thuê (< 12 tháng)',
        rate: '50% tháng thuê',
        base: 'Giá thuê tháng đầu tiên',
        min: '2.000.000 VNĐ',
        note: 'Thu khi hợp đồng thuê ký kết và tiền thuê tháng đầu được thanh toán',
    },
];

const BENEFITS = [
    {
        icon: '📡',
        title: 'Phủ sóng marketing tối đa',
        desc: 'Tài sản của bạn được đăng trên hệ sinh thái SGS LAND, 50+ sàn đối tác, và kênh môi giới nội bộ hơn 5.000 môi giới đang hoạt động.',
    },
    {
        icon: '⚖️',
        title: 'Hoa hồng được bảo vệ bằng HĐ',
        desc: 'Hợp đồng ký gửi xác định rõ ràng mức hoa hồng, điều kiện phát sinh, thời hạn — không tranh cãi, không mờ ám. SGS LAND tuân thủ Luật KDBĐS 2023.',
    },
    {
        icon: '🤖',
        title: 'Định giá AI chính xác',
        desc: 'Mô hình định giá AVM của SGS LAND phân tích hàng ngàn điểm dữ liệu giúp chủ sở hữu có mức giá cạnh tranh — bán / cho thuê nhanh hơn.',
    },
    {
        icon: '🔒',
        title: 'An toàn thông tin',
        desc: 'Thông tin tài sản và thông tin cá nhân được bảo mật theo NĐ 13/2023/NĐ-CP. Chỉ chia sẻ với khách mua / thuê sau khi có sự đồng ý của chủ sở hữu.',
    },
    {
        icon: '📊',
        title: 'Báo cáo định kỳ',
        desc: 'Chủ sở hữu nhận báo cáo hàng tuần: số lượt xem, phản hồi thị trường, khách tiềm năng — minh bạch 100% qua dashboard hoặc email.',
    },
    {
        icon: '🆓',
        title: 'Không phí ký gửi ban đầu',
        desc: 'Hoàn toàn miễn phí khi đăng ký ký gửi. Chi phí marketing (ảnh, video, quảng cáo) do SGS LAND chi trả. Hoa hồng chỉ thu khi giao dịch thành công.',
    },
];

const FAQ_ITEMS = [
    {
        q: 'Ký gửi bất động sản là gì?',
        a: 'Ký gửi bất động sản là việc chủ sở hữu ủy quyền cho SGS LAND thực hiện toàn bộ hoạt động marketing, môi giới và hỗ trợ pháp lý để mua bán hoặc cho thuê tài sản. Hai bên ký Hợp đồng Ký gửi theo quy định Luật KDBĐS 2023.',
    },
    {
        q: 'Hoa hồng được tính như thế nào và khi nào phải trả?',
        a: 'Hoa hồng chỉ phát sinh khi giao dịch thành công: (1) Mua bán: 1–2% giá trị hợp đồng, thu khi hợp đồng công chứng; (2) Cho thuê ≥12 tháng: 1 tháng tiền thuê; (3) Cho thuê <12 tháng: 50% tháng thuê. Không có bất kỳ khoản phí nào nếu không giao dịch.',
    },
    {
        q: 'Tôi có cần đặt cọc hay trả phí trước không?',
        a: 'Hoàn toàn không. SGS LAND không thu bất kỳ khoản phí nào trước khi giao dịch thành công. Toàn bộ chi phí marketing — ảnh, video, quảng cáo — do SGS LAND chi trả.',
    },
    {
        q: 'Thời hạn hợp đồng ký gửi là bao lâu?',
        a: 'Thông thường 3–6 tháng, có thể gia hạn theo thỏa thuận. Trong thời hạn hợp đồng, chủ sở hữu không ký giao dịch độc lập với khách hàng do SGS LAND giới thiệu để tránh tranh chấp hoa hồng.',
    },
    {
        q: 'Tôi có thể tự bán trong thời gian ký gửi không?',
        a: 'Có thể — nếu khách mua là người chủ sở hữu tự tìm, không qua SGS LAND. Tuy nhiên, nếu khách mua đã từng được SGS LAND giới thiệu, hoa hồng vẫn phát sinh theo hợp đồng ký gửi (điều khoản bảo lưu khách hàng thường 90 ngày).',
    },
    {
        q: 'SGS LAND có đảm bảo bán được không?',
        a: 'SGS LAND cam kết nỗ lực tiếp thị tối đa, nhưng kết quả giao dịch phụ thuộc vào thị trường và giá kỳ vọng của chủ sở hữu. Chúng tôi tư vấn định giá thực tế để tối ưu khả năng giao dịch nhanh.',
    },
    {
        q: 'Tài liệu pháp lý cần chuẩn bị gồm những gì?',
        a: 'Tối thiểu: (1) Sổ đỏ / Sổ hồng (Giấy CNQSDĐ) bản gốc hoặc photo công chứng; (2) CMND/CCCD của chủ sở hữu; (3) Giấy phép xây dựng (nếu nhà ở). Đội ngũ SGS LAND sẽ hướng dẫn chi tiết sau khi tiếp nhận yêu cầu.',
    },
    {
        q: 'Vùng địa lý SGS LAND đang hoạt động?',
        a: 'SGS LAND hiện hoạt động tập trung tại TP. Hồ Chí Minh và các tỉnh lân cận (Bình Dương, Đồng Nai, Long An). Đang mở rộng sang Hà Nội và Đà Nẵng. Liên hệ để kiểm tra khả năng ký gửi tại khu vực của bạn.',
    },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const StepCard: React.FC<typeof PROCESS_STEPS[0]> = ({ num, icon, title, desc, detail }) => (
    <div className="relative flex gap-4 md:gap-6">
        <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-lg flex-shrink-0">
                {num}
            </div>
            <div className="w-0.5 flex-1 bg-gradient-to-b from-indigo-300 to-transparent mt-2" />
        </div>
        <div className="pb-10 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{icon}</span>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
            </div>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-2">{desc}</p>
            <div className="text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg inline-block">
                💡 {detail}
            </div>
        </div>
    </div>
);

const FaqItem: React.FC<{ q: string; a: string; defaultOpen?: boolean }> = ({ q, a, defaultOpen }) => {
    const [open, setOpen] = useState(defaultOpen ?? false);
    return (
        <div className="border-b border-[var(--glass-border)] last:border-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-start justify-between gap-4 py-5 text-left group"
                aria-expanded={open}
            >
                <span className="font-semibold text-[var(--text-primary)] text-sm md:text-base group-hover:text-indigo-600 transition-colors">{q}</span>
                <span className={`text-indigo-500 mt-0.5 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </span>
            </button>
            {open && (
                <div className="pb-5 text-sm text-[var(--text-secondary)] leading-relaxed animate-enter">{a}</div>
            )}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const Consignment: React.FC = () => {
    const { t } = useTranslation();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [form, setForm] = useState<FormData>(INITIAL_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const formRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        db.getCurrentUser().then(setCurrentUser);

        // SEO meta injection
        document.title = 'Ký Gửi Bất Động Sản | SGS LAND – Miễn Phí, Pháp Lý Bảo Đảm';
        const setMeta = (name: string, content: string, prop = false) => {
            const attr = prop ? 'property' : 'name';
            let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
            if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
            el.content = content;
        };
        const desc = 'Ký gửi bất động sản tại SGS LAND – Miễn phí 100%, marketing AI, pháp lý hợp đồng chuẩn Luật KDBĐS 2023. Hoa hồng chỉ thu khi giao dịch thành công. Liên hệ ngay!';
        setMeta('description', desc);
        setMeta('og:title', 'Ký Gửi Bất Động Sản | SGS LAND – Miễn Phí, Pháp Lý Bảo Đảm', true);
        setMeta('og:description', desc, true);
        setMeta('og:url', 'https://sgsland.vn/ky-gui-bat-dong-san', true);
        setMeta('og:type', 'website', true);
        setMeta('twitter:title', 'Ký Gửi Bất Động Sản | SGS LAND – Miễn Phí, Pháp Lý Bảo Đảm');
        setMeta('twitter:description', desc);

        // HowTo + FAQPage structured data
        const howToSchema = {
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            'name': 'Quy trình ký gửi bất động sản tại SGS LAND',
            'description': 'Hướng dẫn từng bước quy trình ký gửi bất động sản để mua bán hoặc cho thuê qua sàn giao dịch SGS LAND.',
            'totalTime': 'P7D',
            'step': PROCESS_STEPS.map((s, i) => ({
                '@type': 'HowToStep',
                'position': i + 1,
                'name': s.title,
                'text': s.desc,
            })),
        };
        const faqSchema = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            'mainEntity': FAQ_ITEMS.map(item => ({
                '@type': 'Question',
                'name': item.q,
                'acceptedAnswer': { '@type': 'Answer', 'text': item.a },
            })),
        };
        const addSchema = (schema: object, id: string) => {
            document.getElementById(id)?.remove();
            const s = document.createElement('script');
            s.type = 'application/ld+json';
            s.id = id;
            s.text = JSON.stringify(schema);
            document.head.appendChild(s);
        };
        addSchema(howToSchema, 'schema-howto-consignment');
        addSchema(faqSchema, 'schema-faq-consignment');

        return () => {
            document.getElementById('schema-howto-consignment')?.remove();
            document.getElementById('schema-faq-consignment')?.remove();
        };
    }, []);

    const navigate = (path: string) => {
        window.history.pushState(null, '', `/${path}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
        setError('');
    };

    const scrollToForm = () => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
            setError('Vui lòng điền đầy đủ các trường bắt buộc: Họ tên, Số điện thoại, Địa chỉ bất động sản.');
            return;
        }
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            setError('Địa chỉ email không hợp lệ.');
            return;
        }
        if (!form.agreed) {
            setError('Vui lòng xác nhận đồng ý với điều khoản ký gửi.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const res = await fetch('/api/public/consignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Lỗi hệ thống');
            }
            setSubmitted(true);
            setForm(INITIAL_FORM);
        } catch (err: any) {
            setError(err.message || 'Không thể gửi yêu cầu. Vui lòng thử lại hoặc liên hệ info@sgsland.vn.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--glass-surface)] font-sans text-[var(--text-primary)] overflow-y-auto h-[100dvh] no-scrollbar">

            {/* ── Header ── */}
            <div className="sticky top-0 bg-[var(--bg-surface)]/80 backdrop-blur-md z-50 border-b border-[var(--glass-border)]">
                <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between gap-4">
                    <button onClick={() => navigate(ROUTES.LANDING)} className="flex items-center gap-2 font-black text-indigo-600 hover:opacity-80 transition-opacity min-h-[44px]">
                        <Logo className="w-6 h-6" />
                        <span className="text-base md:text-lg hidden sm:inline">SGS LAND</span>
                    </button>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-secondary)]">
                        <button onClick={() => navigate(ROUTES.SEARCH)} className="hover:text-indigo-600 transition-colors">Tìm BĐS</button>
                        <button onClick={() => navigate(ROUTES.CONTACT)} className="hover:text-indigo-600 transition-colors">Liên hệ</button>
                    </nav>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={scrollToForm}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg active:scale-95 min-h-[44px]"
                        >
                            Đăng ký ký gửi
                        </button>
                        <button
                            onClick={() => navigate(currentUser ? ROUTES.DASHBOARD : ROUTES.LOGIN)}
                            className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors min-h-[44px] hidden sm:flex items-center"
                        >
                            {currentUser ? 'Dashboard' : 'Đăng nhập'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Hero ── */}
            <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 text-white py-20 md:py-32 px-6">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-400 rounded-full blur-3xl" />
                    <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-400 rounded-full blur-3xl" />
                </div>
                <div className="relative max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-indigo-200 text-xs font-bold px-4 py-2 rounded-full mb-6 border border-white/20">
                        🏆 Nền tảng ký gửi BĐS uy tín số 1 TP. Hồ Chí Minh
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6 tracking-tight">
                        Ký Gửi Bất Động Sản
                        <br />
                        <span className="text-indigo-300">Miễn Phí · An Toàn · Hiệu Quả</span>
                    </h1>
                    <p className="text-lg md:text-xl text-indigo-100 max-w-2xl mx-auto leading-relaxed mb-10">
                        Chủ sở hữu ủy quyền — SGS LAND lo toàn bộ: Marketing AI, pháp lý hợp đồng, kết nối khách mua/thuê.
                        Hoa hồng chỉ thu khi giao dịch thành công. Không phí nếu không giao dịch.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <button
                            onClick={scrollToForm}
                            className="px-8 py-4 bg-white text-indigo-700 font-black rounded-2xl hover:bg-indigo-50 transition-all shadow-xl active:scale-95 text-lg"
                        >
                            Đăng ký ký gửi ngay →
                        </button>
                        <a
                            href="tel:+84info"
                            className="px-8 py-4 border-2 border-white/30 text-white font-bold rounded-2xl hover:border-white/60 transition-all text-lg"
                        >
                            Gọi tư vấn miễn phí
                        </a>
                    </div>
                    <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto">
                        {[['5.000+', 'Môi giới'], ['10.000+', 'Giao dịch'], ['98%', 'Hài lòng']].map(([val, label]) => (
                            <div key={label} className="text-center">
                                <div className="text-2xl md:text-3xl font-black text-white">{val}</div>
                                <div className="text-xs text-indigo-300 mt-1">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Benefits ── */}
            <section className="py-16 md:py-24 px-6 bg-[var(--bg-surface)]">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">Tại Sao Chọn SGS LAND?</h2>
                        <p className="text-[var(--text-secondary)] max-w-xl mx-auto">Mô hình ký gửi hiện đại, minh bạch và bảo vệ chủ sở hữu 100% bằng hợp đồng pháp lý</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {BENEFITS.map((b) => (
                            <div key={b.title} className="bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-2xl p-6 hover:shadow-md transition-shadow">
                                <div className="text-3xl mb-4">{b.icon}</div>
                                <h3 className="font-bold text-[var(--text-primary)] mb-2">{b.title}</h3>
                                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{b.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Commission Table ── */}
            <section className="py-16 md:py-24 px-6 bg-[var(--glass-surface)]">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">Biểu Phí Hoa Hồng</h2>
                        <p className="text-[var(--text-secondary)] max-w-xl mx-auto">Minh bạch, không phát sinh thêm. Hoa hồng chỉ thu khi giao dịch thành công và được xác nhận bằng văn bản trong hợp đồng ký gửi.</p>
                    </div>

                    {/* Important legal notice */}
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-8 text-sm text-amber-800 dark:text-amber-300">
                        <strong>⚖️ Căn cứ pháp lý:</strong> Biểu phí hoa hồng này được xác lập trong Hợp đồng Ký gửi Bất động sản, có giá trị pháp lý đầy đủ theo Điều 41–42 Luật Kinh doanh Bất động sản 2023 (Luật số 29/2023/QH15, có hiệu lực từ 01/01/2025) và Nghị định 96/2024/NĐ-CP. <strong>Hoa hồng phát sinh khi và chỉ khi giao dịch thành công</strong> — được xác định là thời điểm hợp đồng mua bán hoặc hợp đồng thuê được ký kết và tiền đặt cọc / tiền thuê tháng đầu được thanh toán hợp lệ cho chủ sở hữu.
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-sm">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead>
                                <tr className="bg-indigo-600 text-white">
                                    <th className="px-5 py-4 text-left font-bold">Loại giao dịch</th>
                                    <th className="px-5 py-4 text-center font-bold">Mức hoa hồng</th>
                                    <th className="px-5 py-4 text-left font-bold">Cơ sở tính</th>
                                    <th className="px-5 py-4 text-right font-bold">Tối thiểu</th>
                                </tr>
                            </thead>
                            <tbody>
                                {COMMISSION_TABLE.map((row, i) => (
                                    <tr key={row.type} className={i % 2 === 0 ? 'bg-[var(--bg-surface)]' : 'bg-[var(--glass-surface)]'}>
                                        <td className="px-5 py-4 font-semibold text-[var(--text-primary)]">{row.type}</td>
                                        <td className="px-5 py-4 text-center">
                                            <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-black px-3 py-1 rounded-full text-sm">{row.rate}</span>
                                        </td>
                                        <td className="px-5 py-4 text-[var(--text-secondary)]">{row.base}</td>
                                        <td className="px-5 py-4 text-right font-bold text-[var(--text-primary)]">{row.min}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-4 text-center">
                        * Mức hoa hồng cụ thể được thống nhất và ghi rõ trong Hợp đồng Ký gửi. Mức trên là khung tham chiếu tiêu chuẩn.
                    </p>
                </div>
            </section>

            {/* ── Process ── */}
            <section className="py-16 md:py-24 px-6 bg-[var(--bg-surface)]">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">Quy Trình Ký Gửi</h2>
                        <p className="text-[var(--text-secondary)]">6 bước đơn giản — SGS LAND xử lý toàn bộ, chủ sở hữu chỉ cần xác nhận</p>
                    </div>
                    <div>
                        {PROCESS_STEPS.map((step) => (
                            <StepCard key={step.num} {...step} />
                        ))}
                    </div>
                    <div className="mt-4 text-center">
                        <button
                            onClick={scrollToForm}
                            className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg active:scale-95 text-lg"
                        >
                            Bắt đầu ngay →
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Legal Commitment Box ── */}
            <section className="py-12 px-6 bg-indigo-950 text-white">
                <div className="max-w-4xl mx-auto">
                    <div className="border border-indigo-700 rounded-2xl p-8 md:p-10">
                        <div className="flex gap-4 items-start">
                            <span className="text-4xl flex-shrink-0">🔏</span>
                            <div>
                                <h2 className="text-xl md:text-2xl font-black mb-4 text-white">Cam Kết Pháp Lý Về Hoa Hồng</h2>
                                <div className="space-y-3 text-sm text-indigo-200 leading-relaxed">
                                    <p>
                                        <strong className="text-white">1. Hợp đồng ký gửi có giá trị pháp lý:</strong> Ngay sau khi hai bên ký kết Hợp đồng Ký gửi Bất động sản, SGS LAND có đầy đủ căn cứ pháp lý để yêu cầu thanh toán hoa hồng theo Điều 41 Luật KDBĐS 2023 khi giao dịch thành công — kể cả trường hợp chủ sở hữu tự ý hủy hợp đồng mua bán sau khi đã có sự giới thiệu của SGS LAND.
                                    </p>
                                    <p>
                                        <strong className="text-white">2. Điều kiện phát sinh hoa hồng:</strong> Hoa hồng phát sinh khi (a) hợp đồng mua bán được công chứng hợp lệ <strong>hoặc</strong> hợp đồng thuê được ký bởi cả hai bên; <strong>và</strong> (b) tiền đặt cọc hoặc tiền thuê tháng đầu tiên được chuyển vào tài khoản của chủ sở hữu.
                                    </p>
                                    <p>
                                        <strong className="text-white">3. Bảo lưu khách hàng:</strong> Trong thời hạn 90 ngày kể từ ngày hết hạn hợp đồng ký gửi, nếu chủ sở hữu tự ký giao dịch với khách hàng đã được SGS LAND giới thiệu trước đó, hoa hồng vẫn phát sinh theo giá trị hợp đồng.
                                    </p>
                                    <p>
                                        <strong className="text-white">4. Giải quyết tranh chấp:</strong> Mọi tranh chấp về hoa hồng được giải quyết theo hợp đồng ký gửi, tại Tòa án có thẩm quyền tại TP. Hồ Chí Minh, theo pháp luật Việt Nam hiện hành.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="py-16 md:py-24 px-6 bg-[var(--glass-surface)]">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">Câu Hỏi Thường Gặp</h2>
                        <p className="text-[var(--text-secondary)]">Giải đáp mọi thắc mắc về quy trình ký gửi bất động sản</p>
                    </div>
                    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--glass-border)] px-6 shadow-sm">
                        {FAQ_ITEMS.map((item, i) => (
                            <FaqItem key={i} {...item} defaultOpen={i === 0} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Registration Form ── */}
            <section ref={formRef} id="form-ky-gui" className="py-16 md:py-24 px-6 bg-[var(--bg-surface)]">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-black mb-4">Đăng Ký Ký Gửi</h2>
                        <p className="text-[var(--text-secondary)]">Điền thông tin — chuyên viên SGS LAND liên hệ trong <strong>4 giờ làm việc</strong></p>
                    </div>

                    {submitted ? (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-10 text-center animate-enter">
                            <div className="text-5xl mb-4">✅</div>
                            <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mb-3">Đăng ký thành công!</h3>
                            <p className="text-[var(--text-secondary)] mb-2">Chúng tôi đã nhận được yêu cầu ký gửi của bạn.</p>
                            <p className="text-[var(--text-secondary)] mb-6">Chuyên viên SGS LAND sẽ liên hệ qua số điện thoại bạn đã cung cấp trong vòng <strong>4 giờ làm việc</strong>.</p>
                            <p className="text-xs text-[var(--text-tertiary)]">Bạn cũng sẽ nhận được email xác nhận (nếu đã cung cấp) từ <strong>info@sgsland.vn</strong></p>
                            <button
                                onClick={() => setSubmitted(false)}
                                className="mt-8 px-6 py-2.5 border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-secondary)] hover:text-indigo-600 transition-colors"
                            >
                                Đăng ký ký gửi thêm bất động sản
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="bg-[var(--glass-surface)] border border-[var(--glass-border)] rounded-2xl p-8 shadow-sm space-y-5">

                            {/* Personal info */}
                            <div className="pb-2 border-b border-[var(--glass-border)]">
                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4">Thông tin chủ sở hữu</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
                                        <input
                                            type="text" name="name" value={form.name} onChange={handleChange} required
                                            placeholder="Nguyễn Văn A"
                                            className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Số điện thoại <span className="text-red-500">*</span></label>
                                        <input
                                            type="tel" name="phone" value={form.phone} onChange={handleChange} required
                                            placeholder="0901 234 567"
                                            className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Email</label>
                                    <input
                                        type="email" name="email" value={form.email} onChange={handleChange}
                                        placeholder="email@cua-ban.com (nhận xác nhận và báo cáo)"
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Property info */}
                            <div className="pb-2 border-b border-[var(--glass-border)]">
                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4">Thông tin bất động sản</p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Loại bất động sản</label>
                                        <select
                                            name="propertyType" value={form.propertyType} onChange={handleChange}
                                            className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">-- Chọn loại --</option>
                                            <option value="Nhà phố">Nhà phố</option>
                                            <option value="Căn hộ chung cư">Căn hộ chung cư</option>
                                            <option value="Đất nền">Đất nền</option>
                                            <option value="Biệt thự / Villa">Biệt thự / Villa</option>
                                            <option value="Nhà mặt tiền thương mại">Nhà mặt tiền thương mại</option>
                                            <option value="Văn phòng / Mặt bằng">Văn phòng / Mặt bằng</option>
                                            <option value="Kho / Xưởng">Kho / Xưởng</option>
                                            <option value="Khác">Khác</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Mục đích giao dịch</label>
                                        <div className="flex gap-3 mt-2">
                                            {(['SELL', 'RENT'] as const).map(v => (
                                                <label key={v} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio" name="transaction" value={v}
                                                        checked={form.transaction === v}
                                                        onChange={handleChange}
                                                        className="accent-indigo-600"
                                                    />
                                                    <span className="text-sm font-medium text-[var(--text-primary)]">{v === 'SELL' ? '🏷 Bán' : '🔑 Cho thuê'}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Địa chỉ bất động sản <span className="text-red-500">*</span></label>
                                    <input
                                        type="text" name="address" value={form.address} onChange={handleChange} required
                                        placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                                        className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Diện tích (m²)</label>
                                        <input
                                            type="number" name="area" value={form.area} onChange={handleChange}
                                            placeholder="Ví dụ: 80"
                                            min="1"
                                            className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Mức giá kỳ vọng</label>
                                        <input
                                            type="text" name="price" value={form.price} onChange={handleChange}
                                            placeholder="Ví dụ: 5 tỷ hoặc 15 triệu/tháng"
                                            className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Thông tin thêm</label>
                                <textarea
                                    name="notes" value={form.notes} onChange={handleChange} rows={3}
                                    placeholder="Tình trạng pháp lý, tiện ích, đặc điểm nổi bật, yêu cầu đặc biệt..."
                                    className="w-full px-4 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                            </div>

                            {/* Agreement */}
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox" name="agreed" checked={form.agreed} onChange={handleChange}
                                    className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0"
                                />
                                <span className="text-xs text-[var(--text-secondary)] leading-relaxed group-hover:text-[var(--text-primary)] transition-colors">
                                    Tôi đồng ý để SGS LAND liên hệ tư vấn và xử lý thông tin cá nhân theo{' '}
                                    <button type="button" onClick={() => navigate(ROUTES.PRIVACY)} className="text-indigo-600 underline">Chính sách bảo mật</button>.
                                    Tôi hiểu rằng hoa hồng chỉ phát sinh khi giao dịch thành công và được xác lập trong hợp đồng ký gửi. <span className="text-red-500">*</span>
                                </span>
                            </label>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className={`w-full py-4 rounded-2xl font-black text-white text-base transition-all shadow-lg ${
                                    submitting
                                        ? 'bg-indigo-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
                                }`}
                            >
                                {submitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        Đang gửi...
                                    </span>
                                ) : 'Gửi yêu cầu ký gửi →'}
                            </button>

                            <p className="text-center text-xs text-[var(--text-tertiary)]">
                                Hoặc liên hệ trực tiếp:{' '}
                                <a href="mailto:info@sgsland.vn" className="text-indigo-600 font-semibold">info@sgsland.vn</a>
                            </p>
                        </form>
                    )}
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="py-10 px-6 border-t border-[var(--glass-border)] bg-[var(--bg-surface)]">
                <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-4 text-sm text-[var(--text-secondary)] mb-6">
                    <button onClick={() => navigate(ROUTES.LANDING)} className="hover:text-indigo-600 transition-colors">Trang chủ</button>
                    <span>·</span>
                    <button onClick={() => navigate(ROUTES.SEARCH)} className="hover:text-indigo-600 transition-colors">Tìm BĐS</button>
                    <span>·</span>
                    <button onClick={() => navigate(ROUTES.CONTACT)} className="hover:text-indigo-600 transition-colors">Liên hệ</button>
                    <span>·</span>
                    <button onClick={() => navigate(ROUTES.PRIVACY)} className="hover:text-indigo-600 transition-colors">Chính sách bảo mật</button>
                    <span>·</span>
                    <button onClick={() => navigate(ROUTES.TERMS)} className="hover:text-indigo-600 transition-colors">Điều khoản dịch vụ</button>
                </div>
                <p className="text-center text-xs text-[var(--text-tertiary)]">
                    SGS Land Corp · MST: 0312960439 · TP. Hồ Chí Minh, Việt Nam<br />
                    <a href="mailto:info@sgsland.vn" className="hover:text-indigo-600 transition-colors">info@sgsland.vn</a>
                </p>
            </footer>
        </div>
    );
};

export default Consignment;
