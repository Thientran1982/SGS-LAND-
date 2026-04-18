import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ROUTES } from '../config/routes';
import { Logo } from '../components/Logo';
import { db } from '../services/dbApi';
import { Listing, ListingStatus, PropertyType, User } from '../types'; 
import { useTranslation } from '../services/i18n';
import { useTheme } from '../services/theme';
import { ListingCard } from '../components/ListingCard'; 
import { Hero3D } from '../components/Hero3D';
import { ArrowRight, Search, Sparkles, BarChart3, Globe2, Zap, Sun, Moon, ChevronRight, X, Phone, MapPin, Scale, Building2 } from 'lucide-react';
import { motion } from 'motion/react';

// -----------------------------------------------------------------------------
// ASSETS & CONFIGURATION
// -----------------------------------------------------------------------------

const PARTNERS = [
    "AQUA CITY NOVALAND", "THE GLOBAL CITY MASTERISE", "IZUMI CITY NAM LONG",
    "VINHOMES CẦN GIỜ", "VINHOMES GRAND PARK", "MASTERISE HOMES",
    "GRAND MARINA SAIGON", "WATERPOINT NAM LONG", "THE PRIVIA KHANG ĐIỀN",
    "VINHOMES CENTRAL PARK", "SƠN KIM LAND",
];

const FEATURED_PROJECTS: FeaturedProject[] = [
    {
        slug: 'aqua-city',
        name: 'Aqua City Novaland',
        dev: 'Novaland',
        loc: 'Biên Hòa, Đồng Nai',
        scale: '1.000 ha',
        priceFrom: 'Từ 6,5 tỷ',
        type: 'Đại Đô Thị Sinh Thái',
        badge: 'Đang bàn giao',
        badgeColor: 'emerald',
        img: '/images/projects/aqua-city.png',
    },
    {
        slug: 'the-global-city',
        name: 'The Global City',
        dev: 'Masterise Homes',
        loc: 'An Phú, TP Thủ Đức',
        scale: '117 ha',
        priceFrom: 'Từ 15 tỷ',
        type: 'Đại Đô Thị Thương Mại',
        badge: 'Đang mở bán',
        badgeColor: 'indigo',
        img: '/images/projects/the-global-city.png',
    },
    {
        slug: 'izumi-city',
        name: 'Izumi City Nam Long',
        dev: 'Nam Long Group',
        loc: 'Biên Hòa, Đồng Nai',
        scale: '170 ha',
        priceFrom: 'Từ 8,4 tỷ',
        type: 'Đô Thị Chuẩn Nhật',
        badge: 'Đang mở bán',
        badgeColor: 'indigo',
        img: '/images/projects/izumi-city.png',
    },
    {
        slug: 'vinhomes-can-gio',
        name: 'Vinhomes Cần Giờ',
        dev: 'Vinhomes',
        loc: 'Cần Giờ, TP.HCM',
        scale: '2.870 ha',
        priceFrom: 'Từ 12 tỷ',
        type: 'Siêu Đô Thị Lấn Biển',
        badge: 'Đang bán',
        badgeColor: 'indigo',
        img: '/images/projects/vinhomes-can-gio.png',
    },
    {
        slug: 'masterise-homes',
        name: 'Masterise Homes',
        dev: 'Masterise Group',
        loc: 'TP.HCM (Quận 1, Q.2, Bình Thạnh)',
        scale: 'Hệ Sinh Thái Branded',
        priceFrom: 'Từ 7,5 tỷ',
        type: 'Branded Residence',
        badge: 'Đang bán',
        badgeColor: 'indigo',
        img: '/images/projects/masterise-homes.png',
    },
    {
        slug: 'vinhomes-grand-park',
        name: 'Vinhomes Grand Park',
        dev: 'Vinhomes',
        loc: 'TP Thủ Đức, TP.HCM',
        scale: '271 ha',
        priceFrom: 'Từ 3 tỷ',
        type: 'Siêu Đô Thị Tích Hợp',
        badge: 'Đang bàn giao',
        badgeColor: 'emerald',
        img: '/images/projects/vinhomes-grand-park.png',
    },
];

const HOME_FAQ = [
    {
        q: 'SGS LAND là gì? SGS LAND phân phối những dự án nào?',
        a: 'SGS LAND là đại lý phân phối bất động sản tại TP.HCM, chuyên các dự án lớn: Aqua City Novaland (1.000ha, Biên Hòa, Đồng Nai), The Global City Masterise Homes (117ha, Thủ Đức), Izumi City Nam Long (170ha, Biên Hòa), Vinhomes Cần Giờ (2.870ha), Masterise Homes (Masteri, Lumière, Grand Marina), Vinhomes Grand Park (271ha, Thủ Đức). Tư vấn miễn phí tại sgsland.vn hoặc hotline 0971 132 378.',
    },
    {
        q: 'Mua bất động sản qua SGS LAND có mất phí môi giới không?',
        a: 'Không. SGS LAND không thu phí môi giới từ người mua. Doanh thu của SGS LAND đến từ hoa hồng do chủ đầu tư trả theo hợp đồng phân phối. Khách hàng được tư vấn pháp lý, kiểm tra hợp đồng và hỗ trợ hồ sơ vay vốn hoàn toàn miễn phí.',
    },
    {
        q: 'Công cụ định giá AI của SGS LAND hoạt động như thế nào?',
        a: 'Hệ thống định giá AI (AVM) của SGS LAND phân tích dữ liệu giao dịch thực tế, quy hoạch đô thị, hạ tầng và xu hướng thị trường để cho ra giá ước tính với sai số ±5%. Người dùng nhập địa chỉ, diện tích và loại hình tài sản — hệ thống trả kết quả trong vài giây, không cần đăng nhập.',
    },
    {
        q: 'Dự án nào đang mở bán và có thể đặt chỗ ưu tiên qua SGS LAND?',
        a: 'Tính đến tháng 4/2026: Aqua City Novaland (Biên Hòa, Đồng Nai) đang bàn giao nhiều phân khu, có sổ hồng riêng, giá từ 6,5 tỷ. Izumi City Nam Long mở giai đoạn mới từ 8,4 tỷ. The Global City Masterise đang nhận đặt cọc từ 15 tỷ. Vinhomes Cần Giờ đã mở bán từ 12 tỷ. Liên hệ 0971 132 378 để nhận bảng giá và tiến độ mới nhất.',
    },
    {
        q: 'SGS LAND hỗ trợ vay vốn ngân hàng như thế nào?',
        a: 'SGS LAND kết nối khách hàng với các ngân hàng đối tác: Vietcombank, BIDV, Techcombank, VPBank — hỗ trợ vay tối đa 70% giá trị căn, kỳ hạn 20–25 năm, lãi suất ưu đãi 12–24 tháng đầu. Đội ngũ pháp lý kiểm tra hợp đồng mua bán và hồ sơ vay miễn phí trước khi ký.',
    },
    {
        q: 'Bất động sản Đồng Nai có tiềm năng đầu tư không?',
        a: 'Theo CBRE Vietnam và Savills Vietnam, bất động sản vùng ven TP.HCM — đặc biệt Đồng Nai (Nhơn Trạch, Biên Hòa) — tăng giá trung bình 12–18%/năm trong giai đoạn 2022–2024 nhờ hạ tầng Vành đai 3, cầu Nhơn Trạch và sân bay Long Thành. Aqua City Novaland và Izumi City Nam Long là hai dự án quy mô lớn SGS LAND đang phân phối tại khu vực này.',
    },
    {
        q: 'Giá bất động sản TP.HCM năm 2026 như thế nào?',
        a: 'Giá tham khảo năm 2026 tại TP.HCM: căn hộ trung cấp TP Thủ Đức 50–80 triệu/m², nhà phố Bình Thạnh 150–300 triệu/m², biệt thự ven đô Nhơn Trạch 20–50 triệu/m². SGS LAND cung cấp công cụ định giá AI miễn phí tại sgsland.vn/ai-valuation — dữ liệu cập nhật hàng ngày từ giao dịch thực tế.',
    },
    {
        q: 'Chủ đầu tư muốn tìm đơn vị phân phối dự án, SGS LAND có hỗ trợ không?',
        a: 'Có. SGS LAND hợp tác phân phối với các chủ đầu tư tại TP.HCM, Đồng Nai, Bình Dương và Long An. Mạng lưới của SGS LAND hỗ trợ CRM tracking real-time, chiến dịch marketing digital và team pháp lý chuyên trách. Liên hệ info@sgsland.vn để nhận đề xuất hợp tác.',
    },
];

const ICONS = {
    ARROW_RIGHT: <ArrowRight className="w-4 h-4" />,
    SEARCH: <Search className="w-5 h-5" />,
    AI_SPARK: <Sparkles className="w-6 h-6" />,
    CHART: <BarChart3 className="w-6 h-6" />,
    GLOBE: <Globe2 className="w-6 h-6" />,
    BOLT: <Zap className="w-6 h-6" />,
    SUN: <Sun className="w-4 h-4" />,
    MOON: <Moon className="w-4 h-4" />,
    X: <X className="w-4 h-4" />
};

// --- HOOKS ---

const useCountUp = (end: number, duration: number = 2000, start: boolean = false) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!start) return;

        let animId: number;
        let startTime: number | null = null;
        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = currentTime - startTime;
            const percentage = Math.min(progress / duration, 1);

            // Easing function (easeOutExpo)
            const ease = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);

            // Preserve decimal places for fractional `end` values
            const raw = ease * end;
            setCount(Number.isInteger(end) ? Math.floor(raw) : Math.round(raw * 100) / 100);

            if (progress < duration) {
                animId = requestAnimationFrame(animate);
            }
        };
        animId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animId);
    }, [end, duration, start]);

    return count;
};

const NavPill = ({ children, onClick }: { children?: React.ReactNode, onClick?: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className="px-2.5 lg:px-4 py-1 lg:py-1.5 rounded-full text-xs2 lg:text-xs font-bold transition-all duration-300 border bg-[var(--bg-surface)] dark:bg-slate-800 text-[var(--text-secondary)] dark:text-slate-300 border-[var(--glass-border)] dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-md cursor-pointer hover:-translate-y-0.5 select-none whitespace-nowrap min-h-[36px]"
    >
        {children}
    </button>
);

// Enhanced Stat Card with Intersection Observer for Animation
const StatCard = ({ label, value, suffix, trend, prefix = "" }: { label: string, value: number, suffix: string, trend: string, prefix?: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const count = useCountUp(value, 2000, isVisible);
    const { language } = useTranslation();

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.2 }
        );
        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <motion.div 
            ref={cardRef} 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col p-6 md:p-8 rounded-[24px] md:rounded-[32px] bg-[var(--bg-surface)] dark:bg-slate-800 border border-[var(--glass-border)] dark:border-slate-700 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] transition-all group h-full justify-center items-center text-center transform hover:-translate-y-1"
        >
            <span className="text-xs2 md:text-xs text-[var(--text-tertiary)] dark:text-slate-400 font-bold uppercase tracking-widest mb-3 md:mb-4">{label}</span>
            <div className="flex flex-col items-center gap-2 md:gap-3">
                <span className="text-3xl md:text-5xl font-extrabold text-[var(--text-primary)] dark:text-white tracking-tight group-hover:scale-105 transition-transform">
                    {prefix}{Number.isInteger(value) ? count.toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US') : count.toFixed(2)}{suffix}
                </span>
                <span className="text-xs2 md:text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800 whitespace-nowrap">{trend}</span>
            </div>
        </motion.div>
    );
};

const FeatureBento = ({ title, desc, icon, className = "", iconBg = "bg-[var(--glass-surface-hover)] dark:bg-slate-700", onClick, ctaLabel, delay = 0 }: any) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5, delay }}
        onClick={onClick}
        className={`relative p-6 md:p-8 rounded-[32px] overflow-hidden group border border-[var(--glass-border)] dark:border-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-500 bg-[var(--bg-surface)] dark:bg-slate-800 flex flex-col justify-between cursor-pointer ${className}`}
    >
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl pointer-events-none transition-opacity opacity-0 group-hover:opacity-100"></div>
        
        <div>
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                {icon}
            </div>
            <h3 className="text-lg md:text-xl font-bold text-[var(--text-primary)] dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{title}</h3>
            <p className="text-xs md:text-sm text-[var(--text-tertiary)] dark:text-slate-400 leading-relaxed max-w-[95%] font-medium">{desc}</p>
        </div>
        <div className="pt-8 flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] dark:text-white opacity-60 group-hover:opacity-100 transition-opacity group/btn">
            <span>{ctaLabel}</span>
            <span className="group-hover/btn:translate-x-1 transition-transform">{ICONS.ARROW_RIGHT}</span>
        </div>
    </motion.div>
);

type FeaturedProject = {
    slug: string;
    name: string;
    dev: string;
    loc: string;
    scale: string;
    priceFrom: string;
    type: string;
    badge: string;
    badgeColor: string;
    img: string;
};

const badgeStyles: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800',
    indigo:  'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800',
    amber:   'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800',
};

const ProjectCard = ({ project, onClick }: { project: FeaturedProject; onClick: () => void }) => (
    <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        onClick={onClick}
        className="relative rounded-[24px] border border-[var(--glass-border)] dark:border-slate-700 bg-[var(--bg-surface)] dark:bg-slate-800 hover:shadow-xl dark:hover:shadow-black/30 transition-all duration-300 cursor-pointer group hover:-translate-y-1 flex flex-col overflow-hidden"
    >
        {/* Project image */}
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-slate-100 dark:bg-slate-700">
            <img
                src={project.img}
                alt={`${project.name} - ${project.type} ${project.loc}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap leading-none backdrop-blur-sm ${badgeStyles[project.badgeColor] ?? badgeStyles.indigo}`}>
                {project.badge}
            </span>
        </div>
        {/* Card body */}
        <div className="p-5 flex flex-col flex-1">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 leading-none mb-3 self-start">
                {project.type}
            </span>
            <h3 className="text-lg font-bold text-[var(--text-primary)] dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                {project.name}
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] dark:text-slate-400 mb-3">{project.dev} &middot; {project.loc}</p>
            <div className="flex items-center gap-1 text-sm mb-4">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                <span className="font-medium text-[var(--text-secondary)] dark:text-slate-300">{project.scale}</span>
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--glass-border)] dark:border-slate-700 flex items-center justify-between">
                <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{project.priceFrom}</span>
                <span className="flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)] dark:text-slate-300 opacity-60 group-hover:opacity-100 transition-opacity">
                    Xem thông tin dự án <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
            </div>
        </div>
    </motion.article>
);

const HomeFAQAccordion = ({ items }: { items: { q: string; a: string }[] }) => {
    const [open, setOpen] = useState<number | null>(0);
    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i} className="border border-[var(--glass-border)] dark:border-slate-700 rounded-2xl overflow-hidden bg-[var(--bg-surface)] dark:bg-slate-800">
                    <button
                        type="button"
                        onClick={() => setOpen(open === i ? null : i)}
                        className="w-full flex items-center justify-between gap-4 p-5 text-left font-bold text-[var(--text-primary)] dark:text-white text-sm md:text-base leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        aria-expanded={open === i}
                    >
                        <span role="heading" aria-level={3}>{item.q}</span>
                        <ChevronRight className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open === i ? 'rotate-90' : ''}`} />
                    </button>
                    {open === i && (
                        <p className="px-5 pb-5 text-sm md:text-base text-[var(--text-secondary)] dark:text-slate-300 leading-relaxed border-t border-[var(--glass-border)] dark:border-slate-700 pt-4">
                            {item.a}
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
};

export const Landing: React.FC = () => {
    const { formatCurrency, language, setLanguage, t } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    
    const [scrolled, setScrolled] = useState(false);
    const [allListings, setAllListings] = useState<Listing[]>([]);
    const [activeCategory, setActiveCategory] = useState<'ALL' | 'PROJECT' | 'UNIT'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [favorites, setFavorites] = useState<Set<string>>(new Set());
    
    // Typewriter effect
    const [text, setText] = useState('');
    
    useEffect(() => {
        db.getCurrentUser().then(user => {
            setCurrentUser(user);
            if (user) {
                db.getFavorites(1, 1000)
                    .then(res => setFavorites(new Set(res.data.map((f: any) => f.id))))
                    .catch(() => {});
            } else {
                try { setFavorites(new Set(JSON.parse(localStorage.getItem('sgs_favorites') || '[]'))); } catch {}
            }
        }).catch(() => {});

        const onLogout = () => { setCurrentUser(null); setFavorites(new Set()); };
        window.addEventListener('auth:logout', onLogout);
        return () => window.removeEventListener('auth:logout', onLogout);
    }, []);

    useEffect(() => {
        const heroTitle = t('landing.hero_title');
        document.title = `SGS LAND | ${heroTitle}`;
        // Update meta description dynamically for SPA SEO
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', t('landing.hero_desc'));
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', `SGS LAND | ${heroTitle}`);
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', t('landing.hero_desc'));
        const twTitle = document.querySelector('meta[name="twitter:title"]');
        if (twTitle) twTitle.setAttribute('content', `SGS LAND | ${heroTitle}`);
        const twDesc = document.querySelector('meta[name="twitter:description"]');
        if (twDesc) twDesc.setAttribute('content', t('landing.hero_desc'));
    }, [t, language]);

    useEffect(() => {
        const fullText = t('landing.typewriter');
        let idx = 0;
        setText('');
        
        const interval = setInterval(() => {
            setText(fullText.slice(0, idx));
            idx++;
            if (idx > fullText.length) clearInterval(interval);
        }, 40);
        return () => clearInterval(interval);
    }, [language, t]); 

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        
        db.getPublicListings(1, 200).then(res => {
            if (res.data) {
                const validListings = res.data.filter(l =>
                    l.status === ListingStatus.AVAILABLE ||
                    l.status === ListingStatus.OPENING ||
                    l.status === ListingStatus.BOOKING
                );
                setAllListings(validListings.sort((a, b) => b.price - a.price));
            }
        }).catch(() => { /* silent — listings fallback to empty */ });
        
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navigateTo = (route: string) => {
        window.location.hash = `#/${route}`;
        window.scrollTo(0, 0); 
    };

    const handleSearch = () => {
        // Navigate to search page with query parameter if present
        const route = searchQuery.trim() 
            ? `${ROUTES.SEARCH}?q=${encodeURIComponent(searchQuery.trim())}` 
            : ROUTES.SEARCH;
        navigateTo(route);
    };

    const handleToggleFavorite = async (id: string) => {
        if (!currentUser) { navigateTo(ROUTES.LOGIN); return; }
        const isFav = favorites.has(id);
        const newSet = new Set(favorites);
        if (isFav) newSet.delete(id); else newSet.add(id);
        setFavorites(newSet);
        try { await db.toggleFavorite(id); } catch { setFavorites(favorites); }
    };

    const displayedListings = useMemo(() => {
        let filtered = allListings;
        if (activeCategory === 'PROJECT') {
            filtered = allListings.filter(l => l.type === PropertyType.PROJECT);
        } else if (activeCategory === 'UNIT') {
            filtered = allListings.filter(l => l.type !== PropertyType.PROJECT);
        }
        // Show top 6
        return filtered.slice(0, 6);
    }, [allListings, activeCategory]);

    const FooterLink = ({ label, route }: { label: string, route: string }) => (
        <li>
            <button 
                onClick={() => navigateTo(route)} 
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left text-[var(--text-tertiary)] dark:text-slate-400 hover:translate-x-1 duration-200 inline-block"
            >
                {label}
            </button>
        </li>
    );

    return (
        <div className="bg-[var(--bg-surface)] dark:bg-slate-900 text-[var(--text-primary)] dark:text-white font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-clip min-h-[100dvh] transition-colors duration-300">
            
            {/* NAVBAR — only shown for guests (when logged in, Layout's CommandCenter handles navigation) */}
            {!currentUser && (
                <nav className="fixed top-3 md:top-4 left-1/2 -translate-x-1/2 z-50 w-full px-4 flex justify-center pointer-events-none">
                    <div className={`pointer-events-auto relative transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] flex items-center justify-between p-1.5 rounded-full border ${scrolled ? 'bg-[var(--bg-surface)]/90 dark:bg-slate-900/90 backdrop-blur-xl border-[var(--glass-border)]/50 dark:border-white/10 shadow-2xl w-full max-w-5xl' : 'bg-transparent border-transparent w-full max-w-7xl'}`}>
                        
                        <div className="flex items-center gap-1.5 md:gap-2 pl-1.5 cursor-pointer group z-10 flex-none md:flex-1" onClick={() => navigateTo('')}>
                            <div className="bg-[var(--bg-surface)] dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-[var(--glass-border)] dark:border-slate-700 group-hover:scale-105 transition-transform">
                                <Logo className="w-4 h-4 md:w-5 md:h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <span className={`font-bold text-sm md:text-base tracking-tight transition-opacity text-[var(--text-primary)] dark:text-white`}>SGS<span className="text-slate-400">LAND</span></span>
                        </div>

                        <div className="hidden md:flex items-center gap-0.5 bg-[var(--glass-surface-hover)]/80 dark:bg-slate-800/80 p-0.5 rounded-full border border-[var(--glass-border)]/50 dark:border-slate-700 backdrop-blur-md shadow-sm pointer-events-auto flex-none 
                            md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-20">
                            <NavPill onClick={() => navigateTo(ROUTES.SEARCH)}>{t('nav.public_market')}</NavPill>
                            <NavPill onClick={() => navigateTo(ROUTES.AI_VALUATION)}>{t('footer.link_valuation')}</NavPill>
                            <NavPill onClick={() => navigateTo(ROUTES.CRM_SOLUTION)}>{t('footer.link_crm')}</NavPill>
                        </div>

                        <div className="flex items-center gap-1 md:gap-1.5 pr-0.5 z-10 flex-none ml-auto md:flex-1 md:justify-end">
                            <button
                                onClick={toggleTheme}
                                className="p-1.5 rounded-full text-[var(--text-secondary)] dark:text-slate-300 hover:bg-[var(--glass-surface-hover)]/60 dark:hover:bg-slate-800/60 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {theme === 'dark' ? ICONS.SUN : ICONS.MOON}
                            </button>
                            <button onClick={() => navigateTo(ROUTES.LOGIN)} className="px-3 lg:px-4 py-1.5 lg:py-2 text-xs2 lg:text-xs font-bold text-[var(--text-secondary)] dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hidden lg:flex min-h-[36px] items-center">
                                {t('auth.btn_login')}
                            </button>
                            <button onClick={() => navigateTo(ROUTES.LOGIN)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 lg:px-5 py-2 rounded-full text-xs2 lg:text-xs font-bold hover:bg-slate-700 dark:hover:bg-slate-100 transition-all shadow-lg shadow-slate-900/20 dark:shadow-white/10 active:scale-95 flex items-center gap-1.5 whitespace-nowrap min-h-[36px]">
                                {t('landing.cta_btn_register')} <span className="hidden sm:inline">{ICONS.ARROW_RIGHT}</span>
                            </button>
                        </div>
                    </div>
                </nav>
            )}

            {/* HERO SECTION */}
            <section className={`relative ${currentUser ? 'pt-8 md:pt-12' : 'pt-32 md:pt-40'} pb-20 md:pb-32 px-6 overflow-hidden min-h-[90svh] flex flex-col justify-center items-center`}>
                {/* Background Decor */}
                <motion.div 
                    animate={{ 
                        scale: [1, 1.05, 1],
                        opacity: [0.4, 0.6, 0.4]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] md:w-[1200px] h-[600px] md:h-[800px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent dark:from-indigo-900/20 rounded-full blur-3xl -z-10 pointer-events-none"
                ></motion.div>
                
                <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
                    {/* Left Column: Text & Search */}
                    <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-indigo-50/80 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-500/30 shadow-sm mb-6 md:mb-8 backdrop-blur-sm"
                        >
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600 dark:bg-indigo-400"></span>
                            </span>
                            <span className="text-2xs md:text-xs2 font-bold text-indigo-700 dark:text-indigo-300 tracking-widest uppercase">{t('landing.badge_tech')}</span>
                        </motion.div>

                        <motion.h1 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-[var(--text-primary)] dark:text-white tracking-tight mb-6 md:mb-8 leading-[1.1] drop-shadow-sm"
                        >
                            {text}<span className="animate-blink text-indigo-500">|</span>
                        </motion.h1>

                        <motion.p 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="text-base md:text-xl text-[var(--text-secondary)] dark:text-slate-300 max-w-2xl mb-10 md:mb-12 font-medium leading-relaxed"
                        >
                            {t('landing.hero_desc')}
                        </motion.p>

                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="w-full max-w-xl relative group z-20"
                        >
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 dark:from-indigo-800 dark:via-purple-800 dark:to-pink-800 rounded-full opacity-40 blur-lg group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative bg-[var(--bg-surface)] dark:bg-slate-800 rounded-full p-1.5 md:p-2 flex items-center shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-[var(--glass-border)] dark:border-slate-700">
                                <div className="pl-3 md:pl-6 pr-2 md:pr-4 text-slate-400 group-hover:text-indigo-600 transition-colors flex items-center justify-center">{ICONS.SEARCH}</div>
                                <input 
                                    className="flex-1 bg-transparent border-none outline-none text-[var(--text-primary)] dark:text-white text-sm md:text-lg placeholder:text-[var(--text-muted)] h-12 md:h-12 font-medium truncate w-full"
                                    placeholder={t('landing.search_placeholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="text-slate-400 hover:text-[var(--text-secondary)] dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-[var(--glass-surface-hover)] dark:hover:bg-slate-700 mr-2 flex items-center justify-center"
                                        title={t('common.clear_search')}
                                    >
                                        {ICONS.X}
                                    </button>
                                )}
                                <button onClick={handleSearch} className="bg-slate-900 dark:bg-indigo-600 text-white px-4 md:px-8 py-2.5 md:py-3 rounded-full font-bold text-xs md:text-sm hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors active:scale-95 shadow-lg shrink-0 ml-1 min-h-[44px]">
                                    {t('common.search')}
                                </button>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column: 3D SVG */}
                    <div className="w-full flex justify-center items-center lg:justify-end">
                        <Hero3D />
                    </div>
                </div>

                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="mt-16 md:mt-24 pt-8 w-full max-w-5xl mx-auto text-center"
                >
                    <p className="text-xs2 md:text-xs font-bold text-[var(--text-tertiary)] dark:text-slate-400 uppercase tracking-[0.3em] mb-6 md:mb-8">{t('landing.trust_badge')}</p>
                    
                    {/* TICKER ANIMATION CONTAINER */}
                    <div className="relative overflow-hidden w-full max-w-4xl mx-auto mask-linear-fade">
                        <div className="flex gap-12 md:gap-20 opacity-60 grayscale hover:grayscale-0 transition-all duration-700 animate-scroll-x">
                            {[...PARTNERS, ...PARTNERS].map((p, i) => (
                                <span key={i} className="text-sm md:text-lg font-bold font-display text-[var(--text-primary)] dark:text-slate-300 tracking-tight cursor-default whitespace-nowrap">{p}</span>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* METRICS (ENTERPRISE GRADE) */}
            <section className="py-16 md:py-20 px-6 bg-[var(--glass-surface)]/50 dark:bg-slate-900/50 border-y border-[var(--glass-border)] dark:border-slate-800 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <StatCard label={t('landing.stat_value_label')} value={11} suffix="+" trend={t('landing.trend_ytd')} />
                        <StatCard label={t('landing.stat_data_label')} value={95} suffix="%" trend={t('landing.trend_daily')} />
                        <StatCard label={t('landing.stat_latency_label')} value={5} suffix=" Tỉnh" trend={t('landing.trend_multi_region')} />
                        <StatCard label={t('landing.stat_uptime_label')} value={24} suffix="/7" trend={t('landing.trend_enterprise')} />
                    </div>
                </div>
            </section>

            {/* FEATURED PROJECTS */}
            <section className="py-20 md:py-32 px-6 bg-[var(--bg-surface)] dark:bg-slate-900">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mb-12 md:mb-16"
                    >
                        <span className="text-xs font-bold tracking-[0.25em] uppercase text-indigo-600 dark:text-indigo-400 mb-3 block">11+ DỰ ÁN LỚN</span>
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-[var(--text-primary)] dark:text-white mb-4 tracking-tight">
                            Dự Án SGS LAND <br className="hidden md:block" /><span className="text-indigo-600 dark:text-indigo-400">Đang Phân Phối</span>
                        </h2>
                        <p className="text-lg md:text-xl text-[var(--text-tertiary)] dark:text-slate-400 max-w-2xl leading-relaxed">
                            SGS LAND phân phối các dự án quy mô lớn tại TP.HCM, Đồng Nai và Bình Dương — tổng diện tích hơn 4.500ha, giá từ 2 tỷ đến hàng trăm tỷ đồng/căn.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(FEATURED_PROJECTS as unknown as FeaturedProject[]).map((p) => (
                            <ProjectCard
                                key={p.slug}
                                project={p}
                                onClick={() => navigateTo(`/du-an/${p.slug}`)}
                            />
                        ))}
                    </div>

                    <div className="mt-12 text-center">
                        <button
                            onClick={() => navigateTo(ROUTES.SEARCH)}
                            className="group inline-flex items-center gap-2 text-[var(--text-primary)] dark:text-white font-bold border-b-2 border-[var(--glass-border)] dark:border-slate-700 pb-1 hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all text-sm md:text-base"
                        >
                            Xem tất cả sản phẩm đang rao bán
                            <span className="group-hover:translate-x-1 transition-transform">{ICONS.ARROW_RIGHT}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* CORE INTELLIGENCE */}
            <section className="py-20 md:py-32 px-6 relative bg-[var(--bg-surface)] dark:bg-slate-900">
                <div className="max-w-7xl mx-auto">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mb-12 md:mb-20 text-center md:text-left"
                    >
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-[var(--text-primary)] dark:text-white mb-4 md:mb-6 tracking-tight">{t('landing.core_title_prefix')} <br className="hidden md:block"/> <span className="text-indigo-600 dark:text-indigo-400">{t('landing.core_title_suffix')}</span></h2>
                        <p className="text-lg md:text-xl text-[var(--text-tertiary)] dark:text-slate-400 max-w-2xl leading-relaxed">{t('landing.core_section_desc')}</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6">
                        
                        <FeatureBento 
                            title={t('landing.feature_ai_title')}
                            desc={t('landing.feature_ai_desc')}
                            icon={ICONS.AI_SPARK}
                            className="md:col-span-3 lg:col-span-8 bg-[var(--glass-surface)] dark:bg-slate-800/50 min-h-[280px]"
                            iconBg="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                            onClick={() => navigateTo(ROUTES.AI_VALUATION)}
                            ctaLabel={t('common.learn_more')}
                            delay={0.1}
                        />

                        <FeatureBento 
                            title={t('landing.feature_data_title')}
                            desc={t('landing.feature_data_desc')}
                            icon={ICONS.CHART}
                            className="md:col-span-3 lg:col-span-4 bg-[var(--glass-surface)] dark:bg-slate-800/50 min-h-[280px]"
                            iconBg="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                            onClick={() => navigateTo(ROUTES.SEARCH)}
                            ctaLabel={t('common.learn_more')}
                            delay={0.2}
                        />

                        <FeatureBento 
                            title={t('landing.feature_crm_title')}
                            desc={t('landing.feature_crm_desc')}
                            icon={ICONS.BOLT}
                            className="md:col-span-3 lg:col-span-4 bg-[var(--glass-surface)] dark:bg-slate-800/50 min-h-[280px]"
                            iconBg="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                            onClick={() => navigateTo(ROUTES.CRM_SOLUTION)}
                            ctaLabel={t('common.learn_more')}
                            delay={0.3}
                        />

                        <FeatureBento 
                            title={t('landing.feature_comm_title')}
                            desc={t('landing.feature_comm_desc')}
                            icon={ICONS.GLOBE}
                            className="md:col-span-3 lg:col-span-8 bg-[var(--glass-surface)] dark:bg-slate-800/50 min-h-[280px]"
                            iconBg="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
                            onClick={() => navigateTo(ROUTES.SEARCH)}
                            ctaLabel={t('common.learn_more')}
                            delay={0.4}
                        />
                    </div>
                </div>
            </section>

            {/* LIVE MARKET (PREMIUM FIRST) */}
            <section className="py-20 md:py-32 bg-[var(--glass-surface)] dark:bg-slate-900/50 border-t border-[var(--glass-border)] dark:border-slate-800">
                <div className="max-w-[1600px] mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 md:mb-12 gap-6">
                        <div>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold tracking-widest text-xs uppercase mb-2 block">{t('landing.market_subtitle')}</span>
                            <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] dark:text-white">{t('landing.market_title')}</h2>
                        </div>
                        
                        <div className="flex bg-[var(--bg-surface)] dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-[var(--glass-border)] dark:border-slate-700">
                            {[
                                { id: 'ALL', label: t('dash.filter_all') },
                                { id: 'PROJECT', label: t('property.PROJECT') },
                                { id: 'UNIT', label: t('landing.category_unit') || t('inventory.label_type') }
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id as any)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        activeCategory === cat.id 
                                        ? 'bg-slate-900 dark:bg-[var(--bg-surface)] text-white dark:text-[var(--text-primary)] shadow-md' 
                                        : 'text-[var(--text-tertiary)] dark:text-slate-400 hover:text-[var(--text-primary)] dark:hover:text-white'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {allListings.length === 0 ? (
                            /* Initial loading — data not yet fetched */
                            [1,2,3].map(i => (
                                <div key={i} className="bg-[var(--bg-surface)] dark:bg-slate-800 rounded-[24px] border border-[var(--glass-border)] dark:border-slate-700 overflow-hidden animate-pulse">
                                    <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-700 w-full" />
                                    <div className="p-5 space-y-3">
                                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full w-3/4" />
                                        <div className="h-3 bg-slate-100 dark:bg-slate-600 rounded-full w-1/2" />
                                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-2/5 mt-2" />
                                    </div>
                                </div>
                            ))
                        ) : displayedListings.length > 0 ? displayedListings.map((item, index) => (
                            <motion.div
                                key={item.id}
                                className="min-h-full"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, delay: Math.min(index, 5) * 0.1 }}
                            >
                                <ListingCard
                                    item={{ ...item, isFavorite: favorites.has(item.id) }}
                                    t={t}
                                    formatCurrency={formatCurrency}
                                    onToggleFavorite={(id) => handleToggleFavorite(id)}
                                    onEdit={() => {}}
                                    onDelete={() => {}}
                                    onClick={() => navigateTo(`${ROUTES.LISTING}/${item.id}`)}
                                    showActions={false}
                                />
                            </motion.div>
                        )) : (
                            /* Data loaded but category filter returns 0 results */
                            <div className="col-span-3 text-center py-20">
                                <p className="text-slate-400 font-medium">{t('common.no_results')}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-12 text-center">
                        <button onClick={() => navigateTo(ROUTES.SEARCH)} className="group inline-flex items-center gap-2 text-[var(--text-primary)] dark:text-white font-bold border-b-2 border-[var(--glass-border)] dark:border-slate-700 pb-1 hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all text-sm md:text-base">
                            {t('landing.market_view_all')} <span className="group-hover:translate-x-1 transition-transform">{ICONS.ARROW_RIGHT}</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* GEO FAQ */}
            <section className="py-20 md:py-32 px-6 bg-[var(--glass-surface)]/50 dark:bg-slate-900/50 border-t border-[var(--glass-border)] dark:border-slate-800">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mb-12 md:mb-16"
                    >
                        <span className="text-xs font-bold tracking-[0.25em] uppercase text-indigo-600 dark:text-indigo-400 mb-3 block">HỎI & ĐÁP</span>
                        <h2 className="text-3xl md:text-5xl font-black text-[var(--text-primary)] dark:text-white mb-4 tracking-tight">
                            Câu Hỏi <span className="text-indigo-600 dark:text-indigo-400">Thường Gặp</span>
                        </h2>
                        <p className="text-lg text-[var(--text-tertiary)] dark:text-slate-400 max-w-2xl leading-relaxed">
                            Giải đáp thắc mắc về bất động sản TP.HCM, các dự án lớn và dịch vụ của SGS LAND.
                        </p>
                    </motion.div>

                    <HomeFAQAccordion items={HOME_FAQ} />

                    <p className="text-xs text-[var(--text-muted)] dark:text-slate-500 mt-8 text-center">
                        Nội dung được biên soạn bởi đội ngũ chuyên gia SGS LAND. Cập nhật lần cuối:{' '}
                        <time dateTime="2026-04-18">04/2026</time>. Tham khảo: CBRE Vietnam, Savills Vietnam, Bộ Xây Dựng.
                    </p>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 md:py-32 px-6 text-center relative overflow-hidden bg-slate-900">
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 right-0 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen"
                ></motion.div>
                <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-0 left-0 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen"
                ></motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="relative z-10 max-w-4xl mx-auto"
                >
                    <h2 className="text-4xl md:text-5xl lg:text-7xl font-black text-white mb-6 md:mb-8 tracking-tighter">{t('landing.cta_title')}</h2>
                    <p className="text-lg md:text-xl text-slate-300 mb-10 md:mb-12 max-w-2xl mx-auto">
                        {t('landing.cta_desc')}
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        {currentUser ? (
                            <button onClick={() => navigateTo(ROUTES.DASHBOARD)} className="px-8 md:px-10 py-3 md:py-4 bg-white text-slate-900 rounded-full font-bold text-base md:text-lg hover:bg-slate-100 hover:scale-105 transition-all shadow-2xl">
                                {t('menu.dashboard')}
                            </button>
                        ) : (
                            <button onClick={() => navigateTo(ROUTES.LOGIN)} className="px-8 md:px-10 py-3 md:py-4 bg-white text-slate-900 rounded-full font-bold text-base md:text-lg hover:bg-slate-100 hover:scale-105 transition-all shadow-2xl">
                                {t('landing.cta_btn_register')}
                            </button>
                        )}
                        <a
                            href="tel:+84971132378"
                            className="px-8 md:px-10 py-3 md:py-4 bg-transparent border border-white/20 text-white rounded-full font-bold text-base md:text-lg hover:bg-white/10 transition-colors backdrop-blur-sm inline-flex items-center gap-2"
                        >
                            <Phone className="w-4 h-4" />
                            {t('landing.cta_btn_sales')}
                        </a>
                    </div>
                </motion.div>
            </section>

            {/* ZALO FLOAT — all screens */}
            <a
                href="https://zalo.me/0971132378"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat Zalo với SGS LAND"
                className="fixed bottom-24 md:bottom-8 right-4 md:right-6 z-50 w-14 h-14 bg-[#0068FF] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform select-none"
            >
                <span className="text-xl font-black leading-none">Z</span>
            </a>

            {/* STICKY MOBILE BOTTOM BAR — md:hidden */}
            <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--bg-surface)]/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-[var(--glass-border)] dark:border-slate-800 px-3 py-2 flex gap-2 shadow-2xl">
                <a
                    href="tel:+84971132378"
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-sm font-bold transition-all"
                >
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>Gọi ngay</span>
                </a>
                <a
                    href="https://zalo.me/0971132378"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-[#0068FF] hover:bg-[#0057d6] active:scale-95 text-white rounded-xl text-sm font-bold transition-all"
                >
                    <span className="text-base font-black leading-none">Z</span>
                    <span>Zalo</span>
                </a>
                <button
                    onClick={() => navigateTo(ROUTES.CONTACT)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-[var(--glass-surface-hover)] dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 text-[var(--text-primary)] dark:text-white rounded-xl text-sm font-bold border border-[var(--glass-border)] dark:border-slate-600 transition-all"
                >
                    <Scale className="w-4 h-4 shrink-0" />
                    <span>Tư vấn</span>
                </button>
            </div>

            {/* FOOTER */}
            <footer className="bg-[var(--bg-surface)] dark:bg-slate-900 text-sm py-16 md:py-20 px-6 border-t border-[var(--glass-border)] dark:border-slate-800 pb-safe-footer pb-28 md:pb-20">
                <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 md:gap-12">
                    <div className="col-span-2">
                        <div className="flex items-center gap-2 mb-4 md:mb-6">
                            <Logo className="w-5 h-5 md:w-6 md:h-6 text-[var(--text-primary)] dark:text-white" />
                            <span className="font-bold text-lg text-[var(--text-primary)] dark:text-white tracking-tight">SGS LAND</span>
                        </div>
                        <p className="text-[var(--text-tertiary)] dark:text-slate-400 mb-8 max-w-xs leading-relaxed text-xs md:text-sm">
                            {t('footer.brand_desc')}
                        </p>
                    </div>
                    
                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-xs2 md:text-xs">{t('footer.col_product')}</h4>
                        <ul className="space-y-3 md:space-y-4 text-[var(--text-tertiary)] dark:text-slate-400 font-medium text-xs md:text-sm">
                            <FooterLink label={t('footer.link_marketplace')} route={ROUTES.SEARCH} />
                            <FooterLink label={t('footer.link_valuation')} route={ROUTES.AI_VALUATION} />
                            <FooterLink label={t('footer.link_crm')} route={ROUTES.CRM_SOLUTION} />
                            <FooterLink label={t('footer.link_consignment')} route={ROUTES.KY_GUI} />
                            <li><a href="/lai-suat-vay-ngan-hang" className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">{t('footer.link_bank_rates')}</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-xs2 md:text-xs">{t('footer.col_locations')}</h4>
                        <ul className="space-y-3 md:space-y-4 font-medium text-xs md:text-sm">
                            <li><a href={`/${ROUTES.BDS_DONG_NAI}`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">{t('footer.link_dong_nai')}</a></li>
                            <li><a href={`/${ROUTES.BDS_LONG_THANH}`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">{t('footer.link_long_thanh')}</a></li>
                            <li><a href={`/${ROUTES.BDS_THU_DUC}`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">BĐS Thủ Đức</a></li>
                            <li><a href={`/${ROUTES.BDS_BINH_DUONG}`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">BĐS Bình Dương</a></li>
                            <li><a href={`/${ROUTES.BDS_QUAN_7}`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">BĐS Quận 7</a></li>
                            <li><a href={`/${ROUTES.BDS_PHU_NHUAN}`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">BĐS Phú Nhuận</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-xs2 md:text-xs">Dự Án</h4>
                        <ul className="space-y-3 md:space-y-4 font-medium text-xs md:text-sm">
                            <li><a href={`/${ROUTES.DU_AN}/aqua-city`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">{t('footer.link_aqua_city')}</a></li>
                            <li><a href={`/${ROUTES.DU_AN}/the-global-city`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">The Global City</a></li>
                            <li><a href={`/${ROUTES.DU_AN}/izumi-city`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">Izumi City</a></li>
                            <li><a href={`/${ROUTES.DU_AN}/vinhomes-can-gio`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">Vinhomes Cần Giờ</a></li>
                            <li><a href={`/${ROUTES.DU_AN}/masterise-homes`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">Masterise Homes</a></li>
                            <li><a href={`/${ROUTES.DU_AN}/vinhomes-grand-park`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">Vinhomes Grand Park</a></li>
                            <li><a href={`/${ROUTES.DU_AN}/vinhomes-central-park`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">Vinhomes Central Park</a></li>
                            <li><a href={`/${ROUTES.DU_AN}/son-kim-land`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">Sơn Kim Land</a></li>
                            <li><a href={`/${ROUTES.DU_AN}`} className="text-[var(--text-tertiary)] dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1 duration-200 inline-block transition-all">Xem tất cả →</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-xs2 md:text-xs">{t('footer.col_company')}</h4>
                        <ul className="space-y-3 md:space-y-4 text-[var(--text-tertiary)] dark:text-slate-400 font-medium text-xs md:text-sm">
                            <FooterLink label={t('footer.link_about')} route={ROUTES.ABOUT} />
                            <FooterLink label={t('footer.link_careers')} route={ROUTES.CAREERS} />
                            <FooterLink label={t('footer.link_news')} route={ROUTES.NEWS} />
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-xs2 md:text-xs">{t('footer.col_legal')}</h4>
                        <ul className="space-y-3 md:space-y-4 text-[var(--text-tertiary)] dark:text-slate-400 font-medium text-xs md:text-sm">
                            <FooterLink label={t('footer.link_help')} route={ROUTES.HELP_CENTER} />
                            <FooterLink label={t('footer.link_user_guide')} route={ROUTES.USER_GUIDE} />
                            <li>
                                <button
                                    onClick={() => navigateTo(currentUser ? ROUTES.API_DOCS : ROUTES.LOGIN)}
                                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left text-[var(--text-tertiary)] dark:text-slate-400 hover:translate-x-1 duration-200 inline-block"
                                >
                                    {t('footer.link_api')}
                                </button>
                            </li>
                            <li>
                                <button
                                    onClick={() => navigateTo(currentUser ? ROUTES.STATUS_PUBLIC : ROUTES.LOGIN)}
                                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left text-[var(--text-tertiary)] dark:text-slate-400 hover:translate-x-1 duration-200 inline-block"
                                >
                                    {t('footer.system_status')}
                                </button>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-[var(--text-primary)] dark:text-white mb-4 md:mb-6 uppercase tracking-wider text-xs2 md:text-xs">{t('footer.col_terms')}</h4>
                        <ul className="space-y-3 md:space-y-4 text-[var(--text-tertiary)] dark:text-slate-400 font-medium text-xs md:text-sm">
                            <FooterLink label={t('footer.link_privacy')} route={ROUTES.PRIVACY} />
                            <FooterLink label={t('footer.link_terms')} route={ROUTES.TERMS} />
                        </ul>
                    </div>
                </div>
                <div className="max-w-[1400px] mx-auto mt-16 md:mt-20 pt-8 border-t border-[var(--glass-border)] dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <span className="text-slate-400 text-xs2 md:text-xs">
                        {t('footer.copyright', { year: new Date().getFullYear() })}
                    </span>
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className="flex items-center gap-2 border-r border-[var(--glass-border)] dark:border-slate-700 pr-4 md:pr-6">
                            <button
                                onClick={toggleTheme}
                                className="hidden p-2 rounded-full text-[var(--text-tertiary)] dark:text-slate-400 hover:bg-[var(--glass-surface-hover)] dark:hover:bg-slate-800 transition-colors items-center justify-center min-w-[44px] min-h-[44px]"
                                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {theme === 'dark' ? ICONS.SUN : ICONS.MOON}
                            </button>

                            <button
                                onClick={() => setLanguage(language === 'vn' ? 'en' : 'vn')}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-xs2 font-bold text-[var(--text-secondary)] dark:text-slate-300 hover:bg-[var(--glass-surface-hover)] dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-[var(--glass-border)] dark:hover:border-slate-700"
                                title={t('nav.lang_switch')}
                                aria-label={t('nav.lang_switch')}
                            >
                                {language.toUpperCase()}
                            </button>
                        </div>
                        <div className="flex gap-4 md:gap-6">
                            <a href="https://www.facebook.com/sgslandvn" target="_blank" rel="noreferrer" className="w-10 h-10 md:w-8 md:h-8 bg-[var(--glass-surface-hover)] dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center text-slate-400 hover:text-[var(--text-secondary)] dark:hover:text-slate-300">
                                <span className="sr-only">Facebook</span>
                                <svg className="w-4 h-4 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                            </a>
                            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="w-10 h-10 md:w-8 md:h-8 bg-[var(--glass-surface-hover)] dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-center text-slate-400 hover:text-[var(--text-secondary)] dark:hover:text-slate-300">
                                <span className="sr-only">LinkedIn</span>
                                <svg className="w-4 h-4 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;