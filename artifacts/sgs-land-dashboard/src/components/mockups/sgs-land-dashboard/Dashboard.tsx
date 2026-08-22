import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Command,
  Download,
  FileCheck2,
  FilePlus2,
  Filter,
  FolderKanban,
  Languages,
  LayoutDashboard,
  ListChecks,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import './_group.css';

type Language = 'en' | 'vn';
type Range = '7d' | '30d' | '90d';
type PipelineMode = 'overview' | 'source';
type TeamMode = 'individual' | 'team';

const navItems = [
  ['Overview', 'Tổng quan', LayoutDashboard],
  ['Listings', 'Giỏ hàng', Building2],
  ['Leads', 'Khách hàng', Users],
  ['Projects', 'Dự án', FolderKanban],
  ['Reports', 'Báo cáo', BarChart3],
] as const;

const searchItems = [
  { label: 'Riverside District — Phase 2', detail: 'Project · Thu Duc City', type: 'project', icon: Building2 },
  { label: 'Lead queue', detail: '12 conversations need attention', type: 'queue', icon: Users },
  { label: 'March performance report', detail: 'Report · prepared 2 hours ago', type: 'report', icon: BarChart3 },
  { label: 'Pricing approvals', detail: '4 items awaiting review', type: 'approval', icon: ClipboardCheck },
  { label: 'Listings with no follow-up', detail: '8 properties · needs an owner', type: 'listing', icon: AlertCircle },
];

const copy = {
  en: {
    workspace: 'Sales workspace',
    overview: 'Overview',
    hello: 'Good morning,',
    name: 'Minh.',
    intro: 'Here is the pulse of your land portfolio.',
    demo: 'Preview · illustrative data',
    demoNote: 'A directional workspace mockup. Values shown are illustrative and not production-verified.',
    attention: '4 items need your attention',
    attentionDetail: 'Two approvals and two warm leads are waiting for a next step.',
    review: 'Review queue',
    quick: 'Quick actions',
    addListing: 'Add a listing',
    addListingSub: 'Bring a new parcel into view',
    importLeads: 'Import leads',
    importLeadsSub: 'From your latest campaign',
    report: 'Build a report',
    reportSub: 'Share a focused snapshot',
    tasks: 'My tasks',
    approvals: 'Approvals',
    due: 'due today',
    proposed: 'proposed',
    guide: 'Make this workspace yours',
    guideText: 'Three small moves to get a clear view of your next land deal.',
    kpis: ['Active listings', 'Qualified leads', 'Site visits', 'Conversion rate'],
    pipeline: 'Pipeline movement',
    pipelineSub: 'Qualified opportunities by week',
    sources: 'Lead sources',
    sourcesSub: 'Where this month’s conversations started',
    team: 'Team pulse',
    teamSub: 'Owner activity this period',
    health: 'Portfolio health',
    healthSub: 'Signals worth keeping close',
    activity: 'Recent activity',
    focus: 'Focus mode',
    search: 'Search workspace',
  },
  vn: {
    workspace: 'Không gian bán hàng',
    overview: 'Tổng quan',
    hello: 'Chào buổi sáng,',
    name: 'Minh.',
    intro: 'Đây là nhịp chuyển động của danh mục đất.',
    demo: 'Bản xem trước · dữ liệu minh hoạ',
    demoNote: 'Mockup định hướng. Các giá trị chỉ mang tính minh hoạ, chưa được xác minh trên production.',
    attention: '4 việc cần bạn xử lý',
    attentionDetail: 'Hai phê duyệt và hai khách hàng tiềm năng đang chờ bước tiếp theo.',
    review: 'Xem hàng đợi',
    quick: 'Thao tác nhanh',
    addListing: 'Thêm sản phẩm',
    addListingSub: 'Đưa một lô đất mới vào hệ thống',
    importLeads: 'Nhập khách hàng',
    importLeadsSub: 'Từ chiến dịch gần nhất',
    report: 'Tạo báo cáo',
    reportSub: 'Chia sẻ một lát cắt tập trung',
    tasks: 'Việc của tôi',
    approvals: 'Phê duyệt',
    due: 'hôm nay',
    proposed: 'đề xuất',
    guide: 'Cá nhân hoá không gian này',
    guideText: 'Ba bước nhỏ để nhìn rõ cơ hội đất tiếp theo.',
    kpis: ['Sản phẩm đang bán', 'Khách đủ điều kiện', 'Lượt đi xem', 'Tỷ lệ chuyển đổi'],
    pipeline: 'Dòng cơ hội',
    pipelineSub: 'Cơ hội đủ điều kiện theo tuần',
    sources: 'Nguồn khách hàng',
    sourcesSub: 'Cuộc trò chuyện tháng này bắt đầu từ đâu',
    team: 'Nhịp đội ngũ',
    teamSub: 'Hoạt động của chủ sở hữu trong kỳ',
    health: 'Sức khoẻ danh mục',
    healthSub: 'Các tín hiệu cần lưu ý',
    activity: 'Hoạt động gần đây',
    focus: 'Chế độ tập trung',
    search: 'Tìm kiếm không gian',
  },
};

function IconButton({ label, onClick, children, className = '' }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return <button type="button" className={`sgs-top-button ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function QueueItem({ icon: Icon, label, detail, badge, onClick }: { icon: typeof Clock3; label: string; detail: string; badge: string; onClick: () => void }) {
  return (
    <button type="button" className="sgs-queue-item" onClick={onClick}>
      <span className="sgs-queue-icon"><Icon /></span>
      <span className="sgs-queue-copy"><strong>{label}</strong><small>{detail}</small></span>
      <span className="sgs-queue-status">{badge}</span><ChevronRight />
    </button>
  );
}

function Chart({ mode, range }: { mode: PipelineMode; range: Range }) {
  const points = mode === 'overview'
    ? (range === '7d' ? '0,124 52,113 104,117 156,85 208,96 260,61 312,69 364,39 416,51 468,26' : range === '90d' ? '0,131 52,120 104,123 156,104 208,110 260,79 312,85 364,61 416,67 468,34' : '0,129 52,117 104,121 156,91 208,99 260,67 312,74 364,45 416,55 468,20')
    : '0,137 52,129 104,117 156,121 208,94 260,102 312,75 364,77 416,60 468,45';
  const area = `${points} 468,155 0,155`;
  const dots = points.split(' ').map((point) => point.split(',').map(Number));
  return (
    <div className="sgs-chart">
      <svg viewBox="0 0 480 180" role="img" aria-label="Illustrative pipeline movement chart">
        {[22, 66, 110, 154].map((y) => <line key={y} className="sgs-chart-gridline" x1="0" x2="468" y1={y} y2={y} />)}
        <polygon className="sgs-chart-area" points={area} />
        <polyline className="sgs-chart-line" points={points} />
        {dots.map(([x, y]) => <circle key={`${x}-${y}`} className="sgs-chart-dot" cx={x} cy={y} r="3" />)}
        {['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'].map((label, index) => <text key={label} className="sgs-chart-label" x={index * 52} y="174">{label}</text>)}
      </svg>
      <div className="sgs-chart-legend"><span><i className="sgs-legend-dot" />Qualified</span><span><i className="sgs-legend-dot coral" />Closed won</span><span style={{ marginLeft: 'auto' }}>Last updated 08:42</span></div>
    </div>
  );
}

export function Dashboard() {
  const [language, setLanguage] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<Range>('30d');
  const [pipelineMode, setPipelineMode] = useState<PipelineMode>('overview');
  const [teamMode, setTeamMode] = useState<TeamMode>('individual');
  const [activeNav, setActiveNav] = useState('Overview');
  const [focusMode, setFocusMode] = useState(false);
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [toast, setToast] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPosition, setAssistantPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const t = copy[language];

  useEffect(() => {
    setAssistantPosition({ x: Math.max(18, window.innerWidth - 74), y: Math.max(18, window.innerHeight - 82) });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSearchOpen(false); setAssistantOpen(false); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => searchItems.filter((item) => `${item.label} ${item.detail} ${item.type}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const notify = (message: string) => setToast(`${message} · ${language === 'vn' ? 'bản thử nghiệm' : 'demo action'}`);
  const action = (message: string) => { notify(message); setMobileMenu(false); };
  const switchNav = (label: string, localized: string) => { setActiveNav(label); if (label !== 'Overview') action(language === 'vn' ? localized : label); };
  const onDragStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: assistantPosition.x, originY: assistantPosition.y, moved: false };
  };
  const onDragMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) drag.moved = true;
    setAssistantPosition({ x: Math.max(10, Math.min(window.innerWidth - 58, drag.originX + event.clientX - drag.startX)), y: Math.max(10, Math.min(window.innerHeight - 58, drag.originY + event.clientY - drag.startY)) });
  };
  const onDragEnd = () => {
    if (dragRef.current && !dragRef.current.moved) setAssistantOpen((open) => !open);
    dragRef.current = null;
  };
  const fabStyle = { left: assistantPosition.x, top: assistantPosition.y };
  const panelStyle = { left: Math.max(14, Math.min(window.innerWidth - 270, assistantPosition.x - 195)), top: Math.max(14, assistantPosition.y - 182) };

  return (
    <div className={`sgs-dashboard ${darkMode ? 'is-dark' : ''} ${focusMode ? 'sgs-focused' : ''}`}>
      <div className="sgs-frame">
        <aside className={`sgs-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileMenu ? 'mobile-open' : ''}`} aria-label="Primary navigation">
          <div className="sgs-brand">
            <span className="sgs-mark"><Target /></span>
            <div><strong className="sgs-brand-name">SGS LAND</strong><small className="sgs-brand-sub">REAL ESTATE INTELLIGENCE</small></div>
          </div>
          <div className="sgs-workspace">{t.workspace}</div>
          <nav className="sgs-nav">
            {navItems.map(([en, vn, Icon]) => <button type="button" key={en} className={activeNav === en ? 'active' : ''} onClick={() => switchNav(en, vn)}><Icon /><span>{language === 'vn' ? vn : en}</span></button>)}
          </nav>
          <div className="sgs-section-label">{language === 'vn' ? 'Không gian của tôi' : 'Your workspace'}</div>
          <div className="sgs-nav">
            <button type="button" onClick={() => action(language === 'vn' ? 'Đã mở lịch' : 'Calendar opened')}><CalendarDays /><span>{language === 'vn' ? 'Lịch làm việc' : 'Calendar'}</span></button>
            <button type="button" onClick={() => action(language === 'vn' ? 'Đã mở cài đặt' : 'Settings opened')}><Settings2 /><span>{language === 'vn' ? 'Cài đặt' : 'Settings'}</span></button>
          </div>
          <div className="sgs-sidebar-footer">
            <button type="button" onClick={() => setFocusMode((mode) => !mode)}><Sparkles /><span>{t.focus}</span></button>
            <button type="button" onClick={() => { setSidebarCollapsed((collapsed) => !collapsed); setMobileMenu(false); }}><PanelLeftClose /><span>{language === 'vn' ? 'Thu gọn thanh bên' : 'Collapse sidebar'}</span></button>
            <div className="sgs-user"><span className="sgs-avatar">MN</span><div className="sgs-user-meta"><strong>Minh Nguyen</strong><small>Portfolio lead</small></div></div>
          </div>
        </aside>

        <main className="sgs-main">
          <header className="sgs-topbar">
            <div className="sgs-top-left">
              <button type="button" className="sgs-menu" aria-label="Open navigation" onClick={() => setMobileMenu((open) => !open)}><Menu /></button>
              <div className="sgs-breadcrumb"><b>SGS LAND</b><span> / </span>{t.overview}</div>
            </div>
            <div className="sgs-top-actions">
              <button type="button" className="sgs-search-trigger" onClick={() => setSearchOpen(true)} aria-label={t.search}><Search /><span>{t.search}</span><kbd><Command size={9} /> K</kbd></button>
              <IconButton label="Switch language" onClick={() => setLanguage(language === 'en' ? 'vn' : 'en')}><Languages size={15} /><span>{language.toUpperCase()}</span></IconButton>
              <IconButton label="Toggle dark mode" onClick={() => setDarkMode((dark) => !dark)}>{darkMode ? <Sun size={15} /> : <Moon size={15} />}</IconButton>
              <IconButton label="Notifications" onClick={() => action(language === 'vn' ? 'Đã mở thông báo' : 'Notifications opened')}><Bell size={15} /></IconButton>
            </div>
          </header>

          <div className="sgs-content">
            <section className="sgs-hero">
              <div>
                <span className="sgs-demo"><ShieldCheck size={11} />{t.demo}</span>
                <h1>{t.hello}<br /><em>{t.name}</em></h1>
              </div>
              <p className="sgs-hero-note"><b>{t.intro}</b><br />{t.demoNote}</p>
            </section>

            {!dismissedAlert && <div className="sgs-alert" role="status">
              <span className="sgs-alert-icon"><AlertCircle /></span>
              <div className="sgs-alert-copy"><strong>{t.attention}</strong><span>{t.attentionDetail}</span></div>
              <button type="button" onClick={() => { setDismissedAlert(true); action(language === 'vn' ? 'Đã ẩn nhắc nhở' : 'Attention banner dismissed'); }}>{t.review}</button>
              <button type="button" aria-label="Dismiss attention banner" onClick={() => setDismissedAlert(true)}><X size={14} /></button>
            </div>}

            <section aria-labelledby="quick-title">
              <div className="sgs-section-head"><div><h2 id="quick-title">{t.quick}</h2></div></div>
              <div className="sgs-quick-grid">
                <button type="button" className="sgs-quick primary" onClick={() => action(language === 'vn' ? 'Đang mở form thêm sản phẩm' : 'Add listing form opened')}><span className="sgs-quick-icon"><Plus /></span><span><strong>{t.addListing}</strong><small>{t.addListingSub}</small></span><ArrowUpRight size={14} style={{ marginLeft: 'auto' }} /></button>
                <button type="button" className="sgs-quick" onClick={() => action(language === 'vn' ? 'Đang mở trình nhập khách hàng' : 'Lead importer opened')}><span className="sgs-quick-icon"><Download /></span><span><strong>{t.importLeads}</strong><small>{t.importLeadsSub}</small></span></button>
                <button type="button" className="sgs-quick" onClick={() => action(language === 'vn' ? 'Đang tạo báo cáo' : 'Report builder opened')}><span className="sgs-quick-icon"><FilePlus2 /></span><span><strong>{t.report}</strong><small>{t.reportSub}</small></span></button>
              </div>
            </section>

            <section aria-label="Work queues">
              <div className="sgs-section-head"><div><h2>{t.review}</h2><p>{language === 'vn' ? 'Những việc có thể mở khoá tiến độ hôm nay' : 'The small set of work that can unlock momentum today'}</p></div><button type="button" className="sgs-more" onClick={() => action(language === 'vn' ? 'Đã mở toàn bộ hàng đợi' : 'Full queue opened')}>View all <ChevronRight size={11} style={{ verticalAlign: 'middle' }} /></button></div>
              <div className="sgs-queue-grid">
                <div className="sgs-panel"><div className="sgs-panel-head"><div className="sgs-panel-title"><ListChecks /><div><h3>{t.tasks}</h3><p>{language === 'vn' ? 'Việc được giao cho bạn' : 'Assigned to you'}</p></div></div><span className="sgs-count">03</span></div><div className="sgs-queue-list">
                  <QueueItem icon={Clock3} label="Follow up — Nguyen Van An" detail="Riverside District · 09:30" badge={t.due} onClick={() => action(language === 'vn' ? 'Đã mở nhiệm vụ follow-up' : 'Follow-up task opened')} />
                  <QueueItem icon={FileCheck2} label="Refresh Thu Duc pricing sheet" detail="Assigned yesterday" badge={t.due} onClick={() => action(language === 'vn' ? 'Đã mở bảng giá' : 'Pricing task opened')} />
                  <QueueItem icon={Users} label="Qualify 7 new conversations" detail="Lead inbox · 2 hours ago" badge="today" onClick={() => action(language === 'vn' ? 'Đã mở hộp thư khách hàng' : 'Lead inbox opened')} />
                </div></div>
                <div className="sgs-panel"><div className="sgs-panel-head"><div className="sgs-panel-title"><ClipboardCheck /><div><h3>{t.approvals}</h3><p>{language === 'vn' ? 'Cần quyết định của bạn' : 'Needs your decision'}</p></div></div><span className="sgs-count">04</span></div><div className="sgs-queue-list">
                  <QueueItem icon={BriefcaseBusiness} label="Riverside — launch price" detail="Submitted by Linh Tran" badge={t.proposed} onClick={() => action(language === 'vn' ? 'Đã mở phê duyệt giá mở bán' : 'Launch price approval opened')} />
                  <QueueItem icon={Archive} label="Archive — Lot 14B / Long An" detail="Submitted by Bao Pham" badge={t.proposed} onClick={() => action(language === 'vn' ? 'Đã mở đề xuất lưu trữ' : 'Archive request opened')} />
                  <QueueItem icon={ShieldCheck} label="Verify legal packet — Q7" detail="Needs a second reviewer" badge="review" onClick={() => action(language === 'vn' ? 'Đã mở bộ hồ sơ pháp lý' : 'Legal packet opened')} />
                </div></div>
              </div>
            </section>

            <section className="sgs-guide" aria-label="Getting started guide">
              <div className="sgs-guide-copy"><h3>{t.guide}</h3><p>{t.guideText}</p></div>
              <div className="sgs-guide-steps">
                {[[1, language === 'vn' ? 'Kết nối nguồn' : 'Connect a source', language === 'vn' ? 'CRM hoặc form' : 'CRM or lead form'], [2, language === 'vn' ? 'Gắn sản phẩm' : 'Add your inventory', language === 'vn' ? 'Bắt đầu với 1 dự án' : 'Start with one project'], [3, language === 'vn' ? 'Mời đội ngũ' : 'Invite your team', language === 'vn' ? 'Cùng giữ nhịp' : 'Keep momentum together']].map(([number, title, detail]) => <div className="sgs-step" key={number as number}><span className="sgs-step-number">{number}</span><strong>{title}</strong><small>{detail}</small></div>)}
              </div>
            </section>

            <section aria-label="Key performance indicators">
              <div className="sgs-section-head"><div><h2>{language === 'vn' ? 'Tín hiệu chính' : 'Key signals'}</h2><p>{language === 'vn' ? 'Tổng hợp minh hoạ trong kỳ đã chọn' : 'Illustrative snapshot for the selected period'}</p></div><select className="sgs-select" value={range} onChange={(event) => setRange(event.target.value as Range)} aria-label="Select time range"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select></div>
              <div className="sgs-kpi-grid">
                {[['128', '+12.6%', 'vs last period', '78%', 'of 164 target'], ['47', '+8.4%', 'new this period', '61%', 'of 77 target'], ['26', '+3.1%', 'scheduled', '43%', 'of 60 target'], ['18.4%', '+2.7%', 'vs last period', '', 'illustrative']].map(([value, change, note, progress, target], index) => <div className="sgs-kpi" key={t.kpis[index]}><small>{t.kpis[index]}</small><strong>{value}</strong><span className="sgs-kpi-note"><em>{change}</em>{note}</span>{progress ? <><div className="sgs-progress"><i style={{ width: progress }} /></div><span className="sgs-kpi-target">{progress} {target}</span></> : <span className="sgs-kpi-target">{target}</span>}</div>)}
              </div>
            </section>

            <section aria-label="Analytics">
              <div className="sgs-section-head"><div><h2>{language === 'vn' ? 'Đọc nhanh danh mục' : 'Read the portfolio'}</h2><p>{language === 'vn' ? 'Các chuyển động đáng chú ý' : 'A few movements worth a closer look'}</p></div><button type="button" className="sgs-more" onClick={() => action(language === 'vn' ? 'Đã xuất báo cáo' : 'Report exported')}>Export report <Download size={11} style={{ verticalAlign: 'middle' }} /></button></div>
              <div className="sgs-analytics-grid">
                <div className="sgs-panel sgs-chart-panel"><div className="sgs-panel-head"><div className="sgs-panel-title"><TrendingUp /><div><h3>{t.pipeline}</h3><p>{t.pipelineSub}</p></div></div><div className="sgs-chart-tools"><div className="sgs-toggle" role="group" aria-label="Pipeline view"><button type="button" className={pipelineMode === 'overview' ? 'active' : ''} onClick={() => setPipelineMode('overview')}>Overview</button><button type="button" className={pipelineMode === 'source' ? 'active' : ''} onClick={() => setPipelineMode('source')}>By source</button></div></div></div><Chart mode={pipelineMode} range={range} /></div>
                <div className="sgs-panel"><div className="sgs-panel-head"><div className="sgs-panel-title"><Activity /><div><h3>{t.sources}</h3><p>{t.sourcesSub}</p></div></div><button type="button" className="sgs-more" aria-label="Filter lead sources" onClick={() => action(language === 'vn' ? 'Bộ lọc nguồn đã mở' : 'Source filters opened')}><Filter size={14} /></button></div><div className="sgs-source-list">{[['Referral', '42%', 'green'], ['Property portal', '31%', 'green'], ['Facebook / Zalo', '18%', 'coral'], ['Walk-in', '9%', 'yellow']].map(([label, percent, color]) => <div className="sgs-source-row" key={label}><span>{label}</span><div className="sgs-bar"><i className={color === 'coral' ? 'coral' : color === 'yellow' ? 'yellow' : ''} style={{ width: percent }} /></div><b>{percent}</b></div>)}</div></div>
              </div>
            </section>

            <section className="sgs-lower-grid" aria-label="Lower analytics">
              <div className="sgs-panel sgs-mini-panel"><div className="sgs-panel-head"><div className="sgs-panel-title"><Users /><div><h3>{t.team}</h3><p>{t.teamSub}</p></div></div><div className="sgs-toggle"><button type="button" className={teamMode === 'individual' ? 'active' : ''} onClick={() => setTeamMode('individual')}>Me</button><button type="button" className={teamMode === 'team' ? 'active' : ''} onClick={() => setTeamMode('team')}>Team</button></div></div><div className="sgs-mini-body">{teamMode === 'individual' ? <><div className="sgs-metric"><span>My follow-ups</span><strong>18 <em>+4</em></strong></div><div className="sgs-metric"><span>Response time</span><strong>2h 14m <em>−12m</em></strong></div><div className="sgs-metric"><span>Meetings booked</span><strong>06 <em>+2</em></strong></div></> : [['Linh Tran', 'West cluster', '31'], ['Bao Pham', 'South cluster', '24'], ['Minh Nguyen', 'Portfolio lead', '18']].map(([name, role, count]) => <div className="sgs-team-row" key={name}><span className="sgs-team-initial">{name.split(' ').map((part) => part[0]).join('')}</span><span><strong>{name}</strong><small>{role}</small></span><b>{count}</b></div>)}</div></div>
              <div className="sgs-panel sgs-mini-panel"><div className="sgs-panel-head"><div className="sgs-panel-title"><Target /><div><h3>{t.health}</h3><p>{t.healthSub}</p></div></div><MoreHorizontal size={15} color="var(--sgs-muted)" /></div><div className="sgs-mini-body"><div className="sgs-metric"><span>Listings with next step</span><strong>86%</strong></div><div className="sgs-metric"><span>Legal docs complete</span><strong>72%</strong></div><div className="sgs-metric"><span>Stale conversations</span><strong style={{ color: 'var(--sgs-coral)' }}>08</strong></div></div></div>
              <div className="sgs-panel sgs-mini-panel"><div className="sgs-panel-head"><div className="sgs-panel-title"><Clock3 /><div><h3>{t.activity}</h3><p>Last 24 hours</p></div></div><button type="button" className="sgs-more" onClick={() => action(language === 'vn' ? 'Đã mở nhật ký hoạt động' : 'Activity log opened')}>Log</button></div><div className="sgs-mini-body"><div className="sgs-activity"><i className="sgs-activity-mark" /><p><b>Linh Tran</b> updated Riverside launch pack<small>12 min ago</small></p></div><div className="sgs-activity"><i className="sgs-activity-mark" /><p><b>Automation</b> flagged 3 stale leads<small>48 min ago</small></p></div><div className="sgs-activity"><i className="sgs-activity-mark" /><p><b>Bao Pham</b> added a site visit<small>2 hours ago</small></p></div></div></div>
            </section>

            <footer className="sgs-footer-note"><span><ShieldCheck size={12} /> Demo workspace · Metrics are illustrative and not production-verified.</span><span>SGS LAND / internal preview</span></footer>
          </div>
        </main>
      </div>

      <div className="sgs-assistant-layer">
        <button type="button" className={`sgs-assistant-fab ${assistantOpen ? 'active' : ''}`} style={fabStyle} aria-label="Open AI assistant" title="Drag or click AI assistant" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}><Bot /></button>
        {assistantOpen && <div className="sgs-assistant-panel" style={panelStyle}><div className="sgs-assistant-head"><span className="sgs-assistant-icon"><Bot size={16} /></span><div><strong>SGS Copilot</strong><small>Preview assistant</small></div><button type="button" aria-label="Close assistant" onClick={() => setAssistantOpen(false)} style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--sgs-muted)', padding: 2 }}><X size={14} /></button></div><p>There are 2 warm leads in Riverside without a next step. I can draft a focused follow-up list for your review.</p><button type="button" onClick={() => action(language === 'vn' ? 'Đã tạo danh sách follow-up' : 'Follow-up list drafted')}>Draft follow-ups <ArrowUpRight size={12} style={{ verticalAlign: 'middle' }} /></button></div>}
      </div>

      {searchOpen && <div className="sgs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="sgs-search-modal" role="dialog" aria-modal="true" aria-label={t.search}><div className="sgs-search-input"><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} /><kbd>ESC</kbd><button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} style={{ border: 0, background: 'transparent', color: 'var(--sgs-muted)', cursor: 'pointer' }}><X size={15} /></button></div><div className="sgs-search-results">{filtered.length ? filtered.map((item) => <button type="button" className="sgs-search-result" key={item.label} onClick={() => { setSearchOpen(false); setQuery(''); action(`${item.label} opened`); }}><item.icon /><span><strong>{item.label}</strong><small>{item.detail}</small></span><ChevronRight size={13} style={{ marginLeft: 'auto', color: 'var(--sgs-muted)' }} /></button>) : <div className="sgs-empty">No workspace results for “{query}”.</div>}</div></div></div>}
      {toast && <div className="sgs-toast" role="status"><CheckCircle2 size={14} />{toast}</div>}
    </div>
  );
}