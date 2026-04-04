import React, { useState, useEffect, useRef } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { User } from '../types';

// ─── SVG Icon helper ──────────────────────────────────────────────────────────

function Ico({ d, d2, cls = 'w-6 h-6' }: { d: string; d2?: string; cls?: string }) {
    return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d={d} />
            {d2 && <path strokeLinecap="round" strokeLinejoin="round" d={d2} />}
        </svg>
    );
}

const P = {
    clipboard:   'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    scale:       'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
    docCheck:    'M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12',
    megaphone:   'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46',
    users:       'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
    currency:    'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    globe:       'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418',
    shieldCheck: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    cpuChip:     'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z',
    lock:        'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
    chartBar:    'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    gift:        'M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1019.5 7.125c0 1.088-.293 2.109-.809 2.981m-13.882 0a2.624 2.624 0 01-.809-2.981A2.625 2.625 0 014.5 7.125 2.625 2.625 0 017.125 4.5c.884 0 1.67.383 2.218.996m5.25 4.504H3.75',
    star:        'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
    lightBulb:   'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
    checkCircle: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    tag:         'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z',
    tagDot:      'M6 6h.008v.008H6V6z',
    key:         'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.169.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
};

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
        icon: <Ico d={P.clipboard} cls="w-6 h-6" />,
        title: 'Tiếp nhận hồ sơ',
        desc: 'Điền form đăng ký ký gửi. Chuyên viên SGS LAND liên hệ trong vòng 4 giờ làm việc để xác nhận thông tin và thu thập hồ sơ pháp lý ban đầu.',
        detail: 'Giấy chứng nhận quyền sử dụng đất, CMND/CCCD chủ sở hữu, giấy phép xây dựng (nếu có)',
    },
    {
        num: '02',
        icon: <Ico d={P.scale} cls="w-6 h-6" />,
        title: 'Thẩm định pháp lý',
        desc: 'Đội ngũ pháp lý SGS LAND kiểm tra tính hợp lệ của hồ sơ: tình trạng tranh chấp, quy hoạch, nghĩa vụ tài chính còn lại.',
        detail: 'Hoàn thành trong 1–3 ngày làm việc. Kết quả thẩm định được thông báo bằng văn bản.',
    },
    {
        num: '03',
        icon: <Ico d={P.docCheck} cls="w-6 h-6" />,
        title: 'Ký kết hợp đồng ký gửi',
        desc: 'Hai bên ký Hợp đồng Ký gửi Bất động sản xác định rõ mức hoa hồng, thời hạn ký gửi, quyền và nghĩa vụ từng bên. Hợp đồng có giá trị pháp lý đầy đủ.',
        detail: 'Căn cứ: Điều 41–42 Luật KDBĐS 2023 & Nghị định 96/2024/NĐ-CP.',
    },
    {
        num: '04',
        icon: <Ico d={P.megaphone} cls="w-6 h-6" />,
        title: 'Định giá & Triển khai marketing',
        desc: 'Định giá bằng AI (AVM) kết hợp thẩm định thực tế. Đăng tin trên SGS LAND, sàn giao dịch đối tác, mạng xã hội và kênh môi giới nội bộ.',
        detail: 'Bộ ảnh chuyên nghiệp, video thực tế, mô tả chuẩn SEO — tất cả miễn phí khi ký gửi.',
    },
    {
        num: '05',
        icon: <Ico d={P.users} cls="w-6 h-6" />,
        title: 'Kết nối khách & Đàm phán',
        desc: 'Môi giới SGS LAND dẫn dắt toàn bộ quá trình xem nhà, đàm phán giá, điều khoản hợp đồng mua bán / thuê — chủ sở hữu không cần trực tiếp gặp gỡ.',
        detail: 'Chủ sở hữu được cập nhật tiến độ định kỳ qua app hoặc email.',
    },
    {
        num: '06',
        icon: <Ico d={P.currency} cls="w-6 h-6" />,
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
        icon: <Ico d={P.globe} cls="w-7 h-7" />,
        title: 'Phủ sóng marketing tối đa',
        desc: 'Tài sản của bạn được đăng trên hệ sinh thái SGS LAND, 50+ sàn đối tác, và kênh môi giới nội bộ hơn 5.000 môi giới đang hoạt động.',
    },
    {
        icon: <Ico d={P.shieldCheck} cls="w-7 h-7" />,
        title: 'Hoa hồng được bảo vệ bằng HĐ',
        desc: 'Hợp đồng ký gửi xác định rõ ràng mức hoa hồng, điều kiện phát sinh, thời hạn — không tranh cãi, không mờ ám. SGS LAND tuân thủ Luật KDBĐS 2023.',
    },
    {
        icon: <Ico d={P.cpuChip} cls="w-7 h-7" />,
        title: 'Định giá AI chính xác',
        desc: 'Mô hình định giá AVM của SGS LAND phân tích hàng ngàn điểm dữ liệu giúp chủ sở hữu có mức giá cạnh tranh — bán / cho thuê nhanh hơn.',
    },
    {
        icon: <Ico d={P.lock} cls="w-7 h-7" />,
        title: 'An toàn thông tin',
        desc: 'Thông tin tài sản và thông tin cá nhân được bảo mật theo NĐ 13/2023/NĐ-CP. Chỉ chia sẻ với khách mua / thuê sau khi có sự đồng ý của chủ sở hữu.',
    },
    {
        icon: <Ico d={P.chartBar} cls="w-7 h-7" />,
        title: 'Báo cáo định kỳ',
        desc: 'Chủ sở hữu nhận báo cáo hàng tuần: số lượt xem, phản hồi thị trường, khách tiềm năng — minh bạch 100% qua dashboard hoặc email.',
    },
    {
        icon: <Ico d={P.gift} cls="w-7 h-7" />,
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
                <span className="text-indigo-600 flex-shrink-0">{icon}</span>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
            </div>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-2">{desc}</p>
            <div className="flex items-start gap-1.5 text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg inline-flex">
                <Ico d={P.lightBulb} cls="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{detail}
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
                        <Ico d={P.star} cls="w-4 h-4 text-yellow-400" /> Nền tảng ký gửi BĐS uy tín số 1 TP. Hồ Chí Minh
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
                        <button
                            onClick={() => navigate(ROUTES.CONTACT)}
                            className="px-8 py-4 border-2 border-white/30 text-white font-bold rounded-2xl hover:border-white/60 transition-all text-lg"
                        >
                            Liên hệ tư vấn miễn phí
                        </button>
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
                                <div className="mb-4 text-indigo-600">{b.icon}</div>
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
                        <strong className="inline-flex items-center gap-1"><Ico d={P.scale} cls="w-4 h-4" /> Căn cứ pháp lý:</strong> Biểu phí hoa hồng này được xác lập trong Hợp đồng Ký gửi Bất động sản, có giá trị pháp lý đầy đủ theo Điều 41–42 Luật Kinh doanh Bất động sản 2023 (Luật số 29/2023/QH15, có hiệu lực từ 01/01/2025) và Nghị định 96/2024/NĐ-CP. <strong>Hoa hồng phát sinh khi và chỉ khi giao dịch thành công</strong> — được xác định là thời điểm hợp đồng mua bán hoặc hợp đồng thuê được ký kết và tiền đặt cọc / tiền thuê tháng đầu được thanh toán hợp lệ cho chủ sở hữu.
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-sm">
                        <table className="w-full text-sm min-w-[900px]">
                            <thead>
                                <tr className="bg-indigo-600 text-white">
                                    <th className="px-5 py-4 text-left font-bold">Loại giao dịch</th>
                                    <th className="px-5 py-4 text-center font-bold">Mức hoa hồng</th>
                                    <th className="px-5 py-4 text-left font-bold">Cơ sở tính</th>
                                    <th className="px-5 py-4 text-right font-bold">Tối thiểu</th>
                                    <th className="px-5 py-4 text-left font-bold">Điều kiện thu</th>
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
                                        <td className="px-5 py-4 text-right font-bold text-[var(--text-primary)] whitespace-nowrap">{row.min}</td>
                                        <td className="px-5 py-4 text-xs text-[var(--text-secondary)] italic">{row.note}</td>
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
                            <span className="flex-shrink-0 text-indigo-300"><Ico d={P.lock} cls="w-10 h-10" /></span>
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
                            <div className="mb-4 flex justify-center text-emerald-500"><Ico d={P.checkCircle} cls="w-14 h-14" /></div>
                            <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mb-3">Đăng ký thành công!</h3>
                            <p className="text-[var(--text-secondary)] mb-2">Chúng tôi đã nhận được yêu cầu ký gửi của bạn.</p>
                            <p className="text-[var(--text-secondary)] mb-6">Chuyên viên SGS LAND sẽ liên hệ qua số điện thoại bạn đã cung cấp trong vòng <strong>4 giờ làm việc</strong>.</p>
                            <p className="text-xs text-[var(--text-tertiary)]">Mọi thắc mắc vui lòng liên hệ trực tiếp: <a href="mailto:info@sgsland.vn" className="text-indigo-600 font-semibold">info@sgsland.vn</a></p>
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
                                                    <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-primary)]">
                                                        {v === 'SELL'
                                                            ? <><Ico d={P.tag} d2={P.tagDot} cls="w-4 h-4" /> Bán</>
                                                            : <><Ico d={P.key} cls="w-4 h-4" /> Cho thuê</>}
                                                    </span>
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
