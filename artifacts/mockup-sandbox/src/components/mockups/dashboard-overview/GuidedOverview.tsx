import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  Activity, ArrowUpRight, Bell, Bot, CheckCircle2, ChevronRight, CircleHelp, FileCheck2, FileText, Globe2, Home,
  LayoutDashboard, ListChecks, MapPin, MessageCircle, MoreHorizontal, PanelLeftClose, PanelLeftOpen, RefreshCw,
  Search, Settings2, Sparkles, Sun, Moon, Target, UserRound, Users, ChevronDown, X, ArrowRight,
} from 'lucide-react';
import './_group.css';
import sgslandLogo from './sgsland-logo.svg';

type Language = 'en' | 'vn';
type ViewMode = 'overview' | 'source';

const labels = {
  en: {
    overview: 'Overview', company: 'Company workspace', greeting: 'Good morning, Minh',
    intro: 'Your operating view for today. Start with the work that needs a decision, then read the signals behind it.',
    range: 'Last 30 days', export: 'Export report', priority: 'Priority attention',
    prioritySub: '2 items need your attention now', priorityBody: 'A high-intent lead is waiting for a reply · 3 contracts are ready for review',
    review: 'Review queue', quick: 'Quick actions', addLead: 'Add lead', addListing: 'Add listing', createContract: 'Create contract',
    queue: 'Tasks & approvals', queueSub: 'What needs a next step', contracts: 'Contracts to handle', approvals: 'Pending approvals', followups: 'Leads to follow up',
    guide: 'Getting started with SGS LAND', guideSub: 'You have the essentials in place. Follow the next three steps to make this workspace useful from day one.', guideAction: 'Open setup guide',
    revenue: 'Revenue', pipeline: 'Open pipeline', aiRate: 'AI deflection rate', velocity: 'Sales velocity', previous: 'vs previous period', target: 'of monthly target', targetUnset: 'Target not set',
    leads: 'Lead pipeline', leadsSub: 'New leads and qualification signals', trend: 'Overview', source: 'By source', totalLeads: 'Total leads', conversion: 'Conversion',
    activity: 'Recent activity', activitySub: 'Latest changes across the workspace', viewAll: 'View all',
    market: 'Market pulse', marketSub: 'Demand signals by area and price', locations: 'Locations', project: 'Project breakdown',
    leaderboard: 'Team performance', individual: 'Individual', team: 'Team', closeRate: 'Close rate', sla: 'SLA score', deals: 'deals closed',
    advisor: 'AI Advisor', suggestions: 'Suggestions today', anomalies: 'Anomaly alerts', suggestionOne: 'Follow up with 4 high-intent leads before noon.', suggestionTwo: 'Riverside demand is up 18% this period.', suggestionThree: 'One listing has views but no enquiries.',
    inventory: 'Property inventory', active: 'Active', sold: 'Sold', rented: 'Rented', expired: 'Expired', pending: 'Pending approval', topViewed: 'Most viewed this week',
    inbox: 'Omnichannel inbox', response: 'Average response', unread: 'unread conversations',
    searchBehavior: 'On-site search behavior', viewed: 'Top viewed properties', keywords: 'Top search keywords', categories: 'Top searches by category',
    visitors: 'Viewer behavior funnel', visitorsSub: 'Reading quality and buying signals', allListings: 'All listings', allSources: 'All sources', engaged: 'Engaged sessions', avgView: 'Avg. view time', exit: 'Exit rate', cta: 'CTA interactions', returning: 'Returning visitors', propertyViews: 'Property views', sessions: 'Sessions', scroll: 'Scrolled 50%',
    geo: 'Visitor geography', geoSub: 'Where visits are coming from', totalVisits: 'Total visits', uniqueIps: 'Unique IPs', coverage: 'Geo coverage', countries: 'Top countries', cities: 'Top cities',
    realtime: 'Realtime traffic', live: 'Live now', activePages: 'Active pages', topPage: 'Top page', direct: 'Direct / unknown',
    demand: 'Demand by area', demandSub: 'Search and enquiry interest by location', updated: 'Updated just now', focus: 'Focus mode', focused: 'Focus mode on',
     lightMode: 'Light mode', darkMode: 'Dark mode',
     assistant: 'Guidance assistant', assistantIntro: 'Ask for help understanding this workspace or deciding what to do next.', assistantAction: 'Show me what needs attention',
  },
  vn: {
    overview: 'Tổng quan', company: 'Không gian công ty', greeting: 'Chào buổi sáng, Minh',
    intro: 'Toàn cảnh vận hành hôm nay. Xử lý việc cần quyết định trước, rồi đọc các tín hiệu phía sau.',
    range: '30 ngày qua', export: 'Xuất báo cáo', priority: 'Việc cần chú ý',
    prioritySub: '2 việc cần bạn chú ý ngay', priorityBody: 'Một khách hàng nhu cầu cao đang chờ phản hồi · 3 hợp đồng sẵn sàng duyệt',
    review: 'Xem hàng đợi', quick: 'Thao tác nhanh', addLead: 'Thêm khách hàng', addListing: 'Đăng tin BĐS', createContract: 'Tạo hợp đồng',
    queue: 'Việc cần làm & phê duyệt', queueSub: 'Bước tiếp theo cần xử lý', contracts: 'Hợp đồng cần xử lý', approvals: 'Yêu cầu chờ duyệt', followups: 'Khách cần follow-up',
    guide: 'Bắt đầu với SGS LAND', guideSub: 'Bạn đã có những phần cần thiết. Hoàn thành ba bước tiếp theo để workspace hữu ích ngay từ ngày đầu.', guideAction: 'Mở hướng dẫn',
    revenue: 'Doanh thu', pipeline: 'Giá trị pipeline', aiRate: 'Tỷ lệ AI xử lý', velocity: 'Tốc độ bán hàng', previous: 'so với kỳ trước', target: 'trên mục tiêu tháng', targetUnset: 'Chưa thiết lập mục tiêu',
    leads: 'Pipeline khách hàng', leadsSub: 'Khách mới và tín hiệu đủ điều kiện', trend: 'Tổng quan', source: 'Theo nguồn', totalLeads: 'Tổng khách hàng', conversion: 'Chuyển đổi',
    activity: 'Hoạt động gần đây', activitySub: 'Thay đổi mới nhất trong workspace', viewAll: 'Xem tất cả',
    market: 'Tín hiệu thị trường', marketSub: 'Nhu cầu theo khu vực và mức giá', locations: 'Khu vực', project: 'Theo dự án',
    leaderboard: 'Hiệu suất team', individual: 'Cá nhân', team: 'Team', closeRate: 'Tỷ lệ chốt', sla: 'Điểm SLA', deals: 'giao dịch đã chốt',
    advisor: 'Cố vấn AI', suggestions: 'Gợi ý trong ngày', anomalies: 'Cảnh báo bất thường', suggestionOne: 'Theo dõi 4 khách hàng nhu cầu cao trước buổi trưa.', suggestionTwo: 'Nhu cầu Riverside tăng 18% trong kỳ này.', suggestionThree: 'Một tin đăng có lượt xem nhưng chưa có hỏi đáp.',
    inventory: 'Kho bất động sản', active: 'Đang hoạt động', sold: 'Đã bán', rented: 'Đã cho thuê', expired: 'Hết hạn', pending: 'Tin chờ duyệt', topViewed: 'Xem nhiều tuần này',
    inbox: 'Hộp thư đa kênh', response: 'Phản hồi trung bình', unread: 'hội thoại chưa đọc',
    searchBehavior: 'Hành vi tìm kiếm trên trang', viewed: 'Top BĐS được xem', keywords: 'Top từ khóa tìm kiếm', categories: 'Top tìm kiếm theo danh mục',
    visitors: 'Funnel hành vi người xem', visitorsSub: 'Chất lượng phiên đọc và tín hiệu mua hàng', allListings: 'Tất cả tin', allSources: 'Tất cả nguồn', engaged: 'Phiên đọc sâu', avgView: 'Thời gian xem TB', exit: 'Tỷ lệ rời trang', cta: 'Tương tác CTA', returning: 'Khách quay lại', propertyViews: 'Lượt xem tin', sessions: 'Phiên truy cập', scroll: 'Cuộn 50%',
    geo: 'Địa lý người xem', geoSub: 'Lượt truy cập đến từ đâu', totalVisits: 'Tổng lượt truy cập', uniqueIps: 'IP duy nhất', coverage: 'Độ phủ địa lý', countries: 'Quốc gia nổi bật', cities: 'Thành phố nổi bật',
    realtime: 'Lưu lượng thời gian thực', live: 'Đang online', activePages: 'Trang đang xem', topPage: 'Trang nổi bật', direct: 'Trực tiếp / chưa rõ',
    demand: 'Nhu cầu theo khu vực', demandSub: 'Mức độ quan tâm từ tìm kiếm và hỏi đáp', updated: 'Vừa cập nhật', focus: 'Chế độ tập trung', focused: 'Đã bật tập trung',
     lightMode: 'Chế độ sáng', darkMode: 'Chế độ tối',
     assistant: 'Trợ lý hướng dẫn', assistantIntro: 'Hỏi để hiểu workspace hoặc biết việc nên làm tiếp theo.', assistantAction: 'Cho tôi biết việc cần chú ý',
  },
};

const navItems = [
  ['Overview', 'Tổng quan', LayoutDashboard], ['Leads', 'Khách hàng', Users], ['Listings', 'Kho BĐS', Home],
  ['Contracts', 'Hợp đồng', FileText], ['Market valuation', 'Định giá thị trường', Target],
  ['AI guidance', 'Hướng dẫn AI', Bot], ['Visitor analytics', 'Phân tích truy cập', Activity],
] as const;

const activities = [
  ['Nguyễn An', 'moved to Qualified', '8 min ago'], ['Landmark Riverside', 'new listing published', '34 min ago'],
  ['Trần Hà', 'received an AI reply', '1 hr ago'], ['Horizon Villas', 'contract draft updated', '2 hrs ago'],
];
const leaderboard = [
  ['Minh Nguyễn', '12', '38%', '94'], ['Linh Phạm', '9', '31%', '91'], ['Huy Trần', '7', '28%', '88'],
];
const individualLeaderboard = [
  ['Minh Nguyễn', '12', '38%', '94'], ['Linh Phạm', '9', '31%', '91'], ['Huy Trần', '7', '28%', '88'],
];
const teamLeaderboard = [
  ['North team', '21', '34%', '93'], ['Central team', '14', '29%', '90'], ['South team', '11', '25%', '87'],
];
const chartValues = [38, 52, 44, 61, 48, 68, 58, 77, 63, 86, 72, 92];
const sourceValues = [['Facebook', '42%', '20'], ['Website', '30%', '14'], ['Referral', '19%', '9'], ['Other', '9%', '4']];
const listings = [['The Marq District 1', '186 views'], ['Landmark Riverside', '142 views'], ['Horizon Villas', '119 views']];
const keywords = [['villa thao dien', '84'], ['can ho quan 2', '61'], ['nha pho district 1', '47']];
const categorySearches = [['Apartment · 2 bedrooms', '56'], ['Villa · Riverside', '39'], ['Townhouse · District 1', '27']];
const demand = [['Thao Dien', '86'], ['District 1', '74'], ['Thu Duc', '63'], ['Binh Thanh', '51'], ['Phu Nhuan', '38'], ['District 7', '31']];
const smartSearchItems = [
  { type: 'Listing', label: 'The Marq District 1', detail: '186 views' },
  { type: 'Listing', label: 'Landmark Riverside', detail: '142 views' },
  { type: 'Lead', label: 'Nguyễn An', detail: 'Qualified · 8 min ago' },
  { type: 'Lead', label: 'Trần Hà', detail: 'AI reply · 1 hr ago' },
  { type: 'Area', label: 'Thao Dien', detail: 'Demand score 86' },
  { type: 'Area', label: 'District 1', detail: 'Demand score 74' },
  { type: 'Action', label: 'Open lead pipeline', detail: 'View qualification signals' },
  { type: 'Action', label: 'Review pending approvals', detail: '2 items need attention' },
];

function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`g-panel ${className}`}><div className="g-panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}

type DropdownOption = { value: string; label: string };

function Dropdown({ value, options, onChange, ariaLabel }: { value: string; options: DropdownOption[]; onChange: (value: string) => void; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value) ?? options[0];

  return <div className={`g-dropdown ${open ? 'open' : ''}`}>
    <button type="button" className="g-dropdown-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>{selected.label}</span><ChevronDown size={12} />
    </button>
    {open && <div className="g-dropdown-menu" role="listbox" aria-label={ariaLabel}>
      {options.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'selected' : ''} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}
    </div>}
  </div>;
}

export function GuidedOverview() {
  const [language, setLanguage] = useState<Language>('en');
  const [range, setRange] = useState('30d');
  const [listingFilter, setListingFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState('Overview');
  const [leadMode, setLeadMode] = useState<ViewMode>('overview');
  const [leaderMode, setLeaderMode] = useState<'individual' | 'team'>('individual');
  const [focusMode, setFocusMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPosition, setAssistantPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const [toast, setToast] = useState('');
  const t = labels[language];

  useEffect(() => {
    setAssistantPosition({ x: Math.max(16, window.innerWidth - 72), y: Math.max(16, window.innerHeight - 78) });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchOpen(false);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };
  const act = (message: string) => {
    if (message === 'Open search' || message === 'Mở tìm kiếm') setSearchOpen(true);
    notify(language === 'vn' ? `${message} · bản thử nghiệm` : `${message} · mockup action`);
  };
  const bilingual = (en: string, vi: string) => language === 'vn' ? vi : en;
  const filteredSearchItems = smartSearchItems.filter(item => `${item.label} ${item.detail} ${item.type}`.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  return <div className={`guided-overview ${focusMode ? 'g-focused' : ''} ${darkMode ? 'g-dark' : ''}`}>
     <div className="g-shell">
       <aside className={`g-sidebar ${sidebarCollapsed ? 'g-sidebar-collapsed' : ''}`} aria-label="Primary navigation">
         <div className="g-brand"><span className="g-brand-mark"><img src={sgslandLogo} alt="" aria-hidden="true" /></span><strong>SGS LAND</strong></div>
        <div className="g-workspace">{t.company}</div>
        <nav className="g-nav">
          {navItems.map(([en, vi, Icon]) => <button key={en} type="button" className={activeNav === en ? 'active' : ''} onClick={() => { setActiveNav(en); if (en !== 'Overview') act(language === 'vn' ? vi : en); }}><Icon /><span>{language === 'vn' ? vi : en}</span></button>)}
        </nav>
        <div className="g-sidebar-bottom"><button type="button" onClick={() => act(bilingual('Open settings', 'Mở cài đặt'))}><Settings2 size={15} /> <span>{bilingual('Settings', 'Cài đặt')}</span></button><div className="g-profile"><span className="g-avatar">MN</span><div><strong>Minh Nguyễn</strong><small>{bilingual('Team lead', 'Trưởng team')}</small></div></div></div>
      </aside>

      <main className="g-main">
         <header className="g-topbar"><div className="g-topbar-left"><button type="button" className="g-sidebar-toggle" aria-label={sidebarCollapsed ? bilingual('Open sidebar', 'Mở sidebar') : bilingual('Close sidebar', 'Đóng sidebar')} title={sidebarCollapsed ? bilingual('Open sidebar', 'Mở sidebar') : bilingual('Close sidebar', 'Đóng sidebar')} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button><div className="g-crumb">{t.overview}</div></div><div className="g-top-actions"><button type="button" aria-label="Search" title={bilingual('Search', 'Tìm kiếm')} onClick={() => act(bilingual('Open search', 'Mở tìm kiếm'))}><Search /></button><button type="button" aria-label="Notifications" title={bilingual('Notifications', 'Thông báo')} onClick={() => act(bilingual('Open notifications', 'Thông báo'))}><Bell /></button><button type="button" aria-label="Help" title={bilingual('Help', 'Trợ giúp')} onClick={() => act(bilingual('Open help', 'Trợ giúp'))}><CircleHelp /></button><button type="button" aria-label={darkMode ? t.lightMode : t.darkMode} title={darkMode ? t.lightMode : t.darkMode} className="g-theme-toggle" onClick={() => { setDarkMode(!darkMode); act(darkMode ? t.lightMode : t.darkMode); }}>{darkMode ? <Sun /> : <Moon />}<span>{darkMode ? 'Light' : 'Dark'}</span></button><div className="g-lang"><button type="button" onClick={() => setLanguage('en')} className={language === 'en' ? 'selected' : ''}>EN</button><span>/</span><button type="button" onClick={() => setLanguage('vn')} className={language === 'vn' ? 'selected' : ''}>VI</button></div></div></header>
        {searchOpen && <section className="g-smart-search" role="dialog" aria-modal="true" aria-label={bilingual('Smart search', 'Tìm kiếm thông minh')}>
          <div className="g-smart-search-head"><Search size={16} /><input autoFocus value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false); }} placeholder={bilingual('Search leads, listings, areas or actions…', 'Tìm khách hàng, tin đăng, khu vực hoặc thao tác…')} aria-label={bilingual('Search workspace', 'Tìm trong workspace')} /><kbd>ESC</kbd><button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} aria-label={bilingual('Close search', 'Đóng tìm kiếm')}><X size={15} /></button></div>
          <div className="g-smart-search-hint">{bilingual('Search across your workspace', 'Tìm kiếm trong toàn bộ workspace')} <span>⌘ K</span></div>
          <div className="g-smart-search-results">{filteredSearchItems.length ? filteredSearchItems.map(item => <button type="button" className="g-smart-result" key={`${item.type}-${item.label}`} onClick={() => { setSearchOpen(false); setSearchQuery(''); act(item.label); }}><span className={`g-smart-result-icon ${item.type.toLowerCase()}`}><Search size={13} /></span><span><strong>{language === 'vn' && item.type === 'Action' ? item.label.replace('Open', 'Mở') : item.label}</strong><small>{item.detail}</small></span><em>{item.type}<ArrowRight size={12} /></em></button>) : <div className="g-smart-empty">{bilingual('No matching workspace results', 'Không tìm thấy kết quả phù hợp')}<small>{bilingual('Try a name, project, area or action', 'Hãy thử tên, dự án, khu vực hoặc thao tác')}</small></div>}</div>
        </section>}
        <div className="g-content">
           <section className="g-hero"><div><div className="g-eyebrow">{t.company}</div><h1>{t.greeting}</h1><p>{t.intro}</p></div><div className="g-hero-tools"><Dropdown value={range} onChange={value => { setRange(value); act(value === '7d' ? bilingual('Last 7 days', '7 ngày qua') : value === '90d' ? bilingual('Last 90 days', '90 ngày qua') : value === 'all' ? bilingual('All time', 'Tất cả thời gian') : t.range); }} ariaLabel={bilingual('Select time range', 'Chọn khoảng thời gian')} options={[{ value: '7d', label: bilingual('Last 7 days', '7 ngày qua') }, { value: '30d', label: t.range }, { value: '90d', label: bilingual('Last 90 days', '90 ngày qua') }, { value: 'all', label: bilingual('All time', 'Tất cả thời gian') }]} /><button className="g-button secondary" type="button" onClick={() => act(t.export)}><ArrowUpRight size={14} />{t.export}</button></div></section>

          <section className="g-priority"><div className="g-priority-mark"><Bell size={15} /></div><div><strong>{t.prioritySub}</strong><p>{t.priorityBody}</p></div><button type="button" onClick={() => act(t.review)}>{t.review}<ChevronRight size={13} /></button></section>

          <div className="g-section-kicker">{t.quick}</div>
          <div className="g-quick-actions"><button type="button" onClick={() => act(t.addLead)}><Users /><span>{t.addLead}</span><ChevronRight /></button><button type="button" onClick={() => act(t.addListing)}><Home /><span>{t.addListing}</span><ChevronRight /></button><button type="button" onClick={() => act(t.createContract)}><FileCheck2 /><span>{t.createContract}</span><ChevronRight /></button></div>

          <Panel title={t.queue} subtitle={t.queueSub} className="g-queue-panel"><div className="g-queue-grid"><QueueItem icon={<FileText />} label={t.contracts} count="3" detail={bilingual('Contracts need review', 'Hợp đồng cần xem')} onClick={() => act(t.contracts)} /><QueueItem icon={<CheckCircle2 />} label={t.approvals} count="2" detail={bilingual('Listing approvals', 'Tin đăng chờ duyệt')} onClick={() => act(t.approvals)} /><QueueItem icon={<MessageCircle />} label={t.followups} count="4" detail={bilingual('No reply in 48 hours', 'Chưa phản hồi trong 48 giờ')} onClick={() => act(t.followups)} /></div></Panel>

          <section className="g-guide"><div className="g-guide-icon"><ListChecks size={18} /></div><div><strong>{t.guide}</strong><p>{t.guideSub}</p></div><button type="button" onClick={() => act(t.guideAction)}>{t.guideAction}<ChevronRight size={13} /></button></section>

          <div className="g-section-kicker">{t.overview}</div>
          <section className="g-kpis"><Kpi label={t.revenue} value="₫2.84B" note="↑ 12.6%" noteText={t.previous} progress="71%" targetLabel={t.target} color="brand" /><Kpi label={t.pipeline} value="₫14.6B" note="47.2%" noteText={bilingual('win probability', 'xác suất thắng')} progress="54%" targetLabel={t.target} color="accent" /><Kpi label={t.aiRate} value="68.4%" note="↑ 4.8%" noteText={t.previous} targetLabel={t.targetUnset} /><Kpi label={t.velocity} value="21.6 days" note="↓ 3.4 days" noteText={t.previous} progress="63%" targetLabel={t.target} color="success" /></section>

          <div className="g-two-col g-main-grid">
            <Panel title={t.leads} subtitle={`${t.leadsSub} · ${range}`} action={<div className="g-panel-tools"><div className="g-tabs"><button className={leadMode === 'overview' ? 'active' : ''} type="button" onClick={() => setLeadMode('overview')}>{t.trend}</button><button className={leadMode === 'source' ? 'active' : ''} type="button" onClick={() => setLeadMode('source')}>{t.source}</button></div><button className="g-icon-btn" type="button" aria-label="Expand lead pipeline" onClick={() => act(bilingual('Open detailed pipeline', 'Mở pipeline chi tiết'))}><MoreHorizontal size={16} /></button></div>} className="g-lead-panel"><div className="g-lead-summary"><strong>47</strong> {bilingual('new leads', 'khách hàng mới')}<span className="g-positive">↑ 18.4%</span><em>{t.totalLeads}: 186 · {t.conversion}: 12.7%</em></div>{leadMode === 'overview' ? <div className="g-chart">{chartValues.map((value, i) => <div className="g-chart-col" key={i}><i style={{ height: `${value * .78}%` }} /><b>{['01','03','05','07','09','11','13','15','17','19','21','23'][i]}</b></div>)}</div> : <div className="g-source-list">{sourceValues.map(([name, pct, count]) => <div className="g-source-row" key={name}><span>{name}</span><div><i style={{ width: pct }} /></div><strong>{count}</strong></div>)}</div>}<div className="g-chart-legend"><span><i />{bilingual('New leads', 'Khách mới')}</span><span><i className="soft" />{bilingual('Qualified', 'Đủ điều kiện')}</span></div></Panel>
            <Panel title={t.market} subtitle={t.marketSub} action={<button className="g-link-btn" type="button" onClick={() => act(bilingual('Open market analysis', 'Mở phân tích thị trường'))}>{bilingual('Details', 'Chi tiết')} <ArrowUpRight size={12} /></button>}><div className="g-market-map"><div className="g-map-ring ring-one" /><div className="g-map-ring ring-two" /><MapPin className="g-map-pin" size={22} /><span className="g-map-label label-one">Thao Dien</span><span className="g-map-label label-two">District 1</span><span className="g-map-label label-three">Thu Duc</span></div><div className="g-location-chips"><span><i />Thao Dien <b>86</b></span><span><i className="gold" />District 1 <b>74</b></span><span><i className="sage" />Thu Duc <b>63</b></span></div></Panel>
          </div>

          <div className="g-two-col">
            <Panel title={t.activity} subtitle={t.activitySub} action={<button className="g-link-btn" type="button" onClick={() => act(t.viewAll)}>{t.viewAll}<ChevronRight size={12} /></button>}><div className="g-activity-list">{activities.map(([name, change, time]) => <div className="g-activity" key={name}><span className="g-activity-dot" /><div><strong>{name}</strong><p>{change}</p></div><time>{time}</time></div>)}</div></Panel>
            <Panel title={t.project} subtitle={bilingual('Leads and pipeline by project', 'Khách hàng và pipeline theo dự án')} action={<button className="g-link-btn" type="button" onClick={() => act(bilingual('Open projects', 'Mở dự án'))}>{t.viewAll}<ChevronRight size={12} /></button>}><div className="g-project-list">{[['The Marq District 1', '38 leads', '₫5.8B'], ['Landmark Riverside', '26 leads', '₫4.1B'], ['Horizon Villas', '19 leads', '₫2.7B']].map(([name, leads, value]) => <div className="g-project" key={name}><div><strong>{name}</strong><small>{leads}</small></div><b>{value}</b></div>)}</div></Panel>
          </div>

          <div className="g-section-kicker">{bilingual('Signals & performance', 'Tín hiệu & hiệu suất')}</div>
          <div className="g-three-col">
            <Panel title={t.leaderboard} subtitle={bilingual('Close rate and service quality', 'Tỷ lệ chốt và chất lượng dịch vụ')} action={<div className="g-tabs"><button className={leaderMode === 'individual' ? 'active' : ''} type="button" onClick={() => setLeaderMode('individual')}>{t.individual}</button><button className={leaderMode === 'team' ? 'active' : ''} type="button" onClick={() => setLeaderMode('team')}>{t.team}</button></div>}><div className="g-rank-head"><span>{leaderMode === 'individual' ? bilingual('Agent', 'Nhân viên') : t.team}</span><span>{t.closeRate}</span><span>{t.sla}</span></div>{(leaderMode === 'individual' ? individualLeaderboard : teamLeaderboard).map(([name, deal, close, sla], index) => <div className="g-rank" key={name}><span className="g-rank-person"><i>{index + 1}</i><strong>{name}</strong><small>{deal} {t.deals}</small></span><b>{close}</b><b className="g-sla">{sla}/100</b></div>)}</Panel>
            <Panel title={t.advisor} subtitle={bilingual('A daily layer of guidance', 'Lớp hướng dẫn mỗi ngày')} action={<button className="g-link-btn" type="button" onClick={() => act(bilingual('Open AI guidance', 'Mở hướng dẫn AI'))}><Bot size={13} /> AI</button>}><div className="g-advisor-stats"><div><Sparkles /><strong>7</strong><small>{t.suggestions}</small></div><div><Activity /><strong className="g-warning">1</strong><small>{t.anomalies}</small></div></div><div className="g-suggestions"><button type="button" onClick={() => act(t.suggestionOne)}>{t.suggestionOne}<ChevronRight /></button><button type="button" onClick={() => act(t.suggestionTwo)}>{t.suggestionTwo}<ChevronRight /></button><button type="button" onClick={() => act(t.suggestionThree)}>{t.suggestionThree}<ChevronRight /></button></div></Panel>
            <Panel title={t.inventory} subtitle={bilingual('Current listing health', 'Tình trạng tin đăng hiện tại')} action={<button className="g-link-btn" type="button" onClick={() => act(t.active)}>{t.active}<ArrowUpRight size={12} /></button>}><div className="g-inventory-stats">{[['42', t.active], ['18', t.sold], ['7', t.rented], ['3', t.expired]].map(([value, label]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}</div><button className="g-pending" type="button" onClick={() => act(t.pending)}><span>{t.pending}</span><b>5</b><ChevronRight size={13} /></button><div className="g-sub-kicker">{t.topViewed}</div><div className="g-mini-list">{listings.map(([name, views]) => <div key={name}><span>{name}</span><small>{views}</small></div>)}</div></Panel>
          </div>

          <div className="g-two-col">
            <Panel title={t.inbox} subtitle={bilingual('Messages needing a response', 'Tin nhắn cần phản hồi')} action={<button className="g-link-btn" type="button" onClick={() => act('Inbox')}>Inbox<ArrowUpRight size={12} /></button>}><div className="g-channel-grid">{[['Zalo', '12'], ['Facebook', '8'], ['Web chat', '4']].map(([name, count]) => <button type="button" key={name} onClick={() => act(name)}><MessageCircle size={14} /><strong>{count}</strong><small>{name}</small></button>)}</div><div className="g-response"><span>{t.response}</span><strong>14m</strong><small>· 24 {t.unread}</small></div></Panel>
            <Panel title={t.demand} subtitle={t.demandSub} action={<button className="g-link-btn" type="button" onClick={() => act(bilingual('Open demand analysis', 'Mở phân tích nhu cầu'))}>{t.viewAll}<ArrowUpRight size={12} /></button>}><div className="g-demand-list">{demand.slice(0, 4).map(([name, score]) => <div key={name}><span>{name}</span><div><i style={{ width: `${score}%` }} /></div><strong>{score}</strong></div>)}</div></Panel>
          </div>

          <Panel title={t.searchBehavior} subtitle={bilingual('Last 30 days', '30 ngày gần nhất')} className="g-search-panel"><div className="g-search-cols">{[[t.viewed, listings], [t.keywords, keywords], [t.categories, categorySearches]].map(([title, items]) => <div className="g-search-group" key={title as string}><h3>{title as string}</h3>{(items as string[][]).map(([name, value], index) => <div key={name}><span>{index + 1}. {name}</span><strong>{value}{title === t.viewed ? bilingual(' views', ' lượt') : ''}</strong></div>)}</div>)}</div></Panel>

          <Panel title={t.visitors} subtitle={t.visitorsSub} action={<div className="g-filter-row"><Dropdown value={listingFilter} onChange={setListingFilter} ariaLabel={bilingual('Filter by listing', 'Lọc theo tin đăng')} options={[{ value: 'all', label: t.allListings }, { value: 'marq', label: 'The Marq District 1' }, { value: 'landmark', label: 'Landmark Riverside' }]} /><Dropdown value={sourceFilter} onChange={setSourceFilter} ariaLabel={bilingual('Filter by traffic source', 'Lọc theo nguồn truy cập')} options={[{ value: 'all', label: t.allSources }, { value: 'facebook', label: 'Facebook' }, { value: 'website', label: 'Website' }]} /></div>}><div className="g-funnel-metrics">{[[t.engaged, '1,248'], [t.avgView, '1m 42s'], [t.exit, '32%'], [t.cta, '186']].map(([name, value]) => <div key={name}><small>{name}</small><strong>{value}</strong></div>)}</div><div className="g-funnel-body"><div className="g-funnel-bars">{[[t.propertyViews, '4,860', '100%'], [t.sessions, '2,940', '61%'], [t.engaged, '1,248', '42%'], [t.scroll, '842', '29%'], [t.cta, '186', '6%']].map(([name, value, width], index) => <div key={name}><div><span>{name}</span><b>{value}</b></div><i className={`funnel-${index}`} style={{ width }} /></div>)}</div><div className="g-returning"><UserRound size={17} /><small>{t.returning}</small><strong>384</strong><span>{bilingual('within 48 hours', 'trong vòng 48 giờ')}</span></div></div></Panel>

          <div className="g-two-col">
            <Panel title={t.geo} subtitle={t.geoSub}><div className="g-geo-metrics"><div><small>{t.totalVisits}</small><strong>8,642</strong><span>{bilingual('Last 30 days', '30 ngày qua')}</span></div><div><small>{t.uniqueIps}</small><strong>6,918</strong><span>{bilingual('IP source', 'Nguồn IP')}</span></div><div><small>{t.coverage}</small><strong>93%</strong><span>8,042 / 8,642</span></div></div><div className="g-geo-table"><div className="g-geo-head"><span>{t.countries}</span><span>{t.cities}</span></div><div className="g-geo-row"><span><Globe2 size={13} />Vietnam <b>7,988</b></span><span><MapPin size={13} />Ho Chi Minh City <b>4,210</b></span></div><div className="g-geo-row"><span><Globe2 size={13} />Singapore <b>42</b></span><span><MapPin size={13} />Hanoi <b>1,084</b></span></div><div className="g-geo-row"><span><Globe2 size={13} />United States <b>31</b></span><span><MapPin size={13} />Thu Duc <b>728</b></span></div></div></Panel>
            <Panel title={t.realtime} subtitle={bilingual('Live website activity', 'Hoạt động website trực tiếp')} action={<span className="g-live"><i />{t.live}</span>}><div className="g-realtime-number"><strong>18</strong><span>{bilingual('visitors on site', 'người đang truy cập')}</span></div><div className="g-realtime-grid"><div><small>{t.activePages}</small><strong>7</strong></div><div><small>{t.topPage}</small><strong>/landmark-riverside</strong></div><div><small>{t.direct}</small><strong>6</strong></div></div><div className="g-traffic-line"><i /><i /><i /><i /><i /><i /><i /><i /></div></Panel>
          </div>

          <div className="g-footer-note"><span><RefreshCw size={12} /> {t.updated} · {bilingual('Scope: company', 'Phạm vi: công ty')}</span><button type="button" onClick={() => { setFocusMode(!focusMode); notify(focusMode ? t.focus : t.focused); }}><Settings2 size={12} /> {focusMode ? t.focused : t.focus}</button></div>
        </div>
      </main>
    </div>
     <div className="g-assistant-layer">
       {assistantOpen && <section className="g-assistant-panel" style={{ left: Math.max(12, assistantPosition.x - 238), top: Math.max(12, assistantPosition.y - 224) }} aria-label={t.assistant}>
         <div className="g-assistant-head"><span className="g-assistant-icon"><Bot size={15} /></span><div><strong>{t.assistant}</strong><small>{bilingual('Workspace guidance', 'Hướng dẫn workspace')}</small></div><button type="button" aria-label={bilingual('Close assistant', 'Đóng trợ lý')} onClick={() => setAssistantOpen(false)}>×</button></div>
         <p>{t.assistantIntro}</p>
         <button type="button" className="g-assistant-action" onClick={() => act(t.assistantAction)}><Sparkles size={13} />{t.assistantAction}<ChevronRight size={13} /></button>
       </section>}
       <button
         type="button"
         className={`g-assistant-fab ${assistantOpen ? 'active' : ''}`}
         style={{ left: assistantPosition.x, top: assistantPosition.y }}
         aria-label={t.assistant}
         title={t.assistant}
         onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
           event.currentTarget.setPointerCapture(event.pointerId);
           dragRef.current = { startX: event.clientX, startY: event.clientY, originX: assistantPosition.x, originY: assistantPosition.y, moved: false };
         }}
         onPointerMove={(event: PointerEvent<HTMLButtonElement>) => {
           const drag = dragRef.current;
           if (!drag) return;
           const dx = event.clientX - drag.startX;
           const dy = event.clientY - drag.startY;
           if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
           if (drag.moved) setAssistantPosition({ x: Math.min(Math.max(8, drag.originX + dx), window.innerWidth - 54), y: Math.min(Math.max(8, drag.originY + dy), window.innerHeight - 54) });
         }}
         onPointerUp={() => {
           const moved = dragRef.current?.moved;
           dragRef.current = null;
           if (!moved) setAssistantOpen((open) => !open);
         }}
       ><MessageCircle size={20} /></button>
     </div>
     {toast && <div className="g-toast" role="status">{toast}</div>}
  </div>;
}

function QueueItem({ icon, label, count, detail, onClick }: { icon: ReactNode; label: string; count: string; detail: string; onClick: () => void }) {
  return <button className="g-queue-item" type="button" onClick={onClick}><span className="g-queue-icon">{icon}</span><span><strong>{label}</strong><small>{detail}</small></span><b>{count}</b><ChevronRight size={14} /></button>;
}

function Kpi({ label, value, note, noteText, progress, targetLabel, color = 'brand' }: { label: string; value: string; note: string; noteText: string; progress?: string; targetLabel: string; color?: string }) {
  return <div className={`g-kpi ${color}`}><small>{label}</small><strong>{value}</strong><span className="g-kpi-note"><em>{note}</em>{noteText}</span>{progress ? <><div className="g-progress"><i style={{ width: progress }} /></div><span className="g-target">{progress} {targetLabel}</span></> : <span className="g-target muted">{targetLabel}</span>}</div>;
}
