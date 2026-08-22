import { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  ChevronRight,
  CircleHelp,
  FileText,
  Home,
  LayoutDashboard,
  Maximize2,
  MessageSquareText,
  RefreshCw,
  Search,
  Settings2,
  Target,
  Users,
  X,
} from 'lucide-react';
import './_group.css';

type Language = 'en' | 'vn';

const sample = {
  revenue: '₫2.84B',
  pipeline: '₫14.6B',
  aiDeflection: '68.4%',
  velocity: '21.6 days',
  trend: [42, 58, 47, 67, 53, 74, 64, 84, 70, 91, 78, 96],
  newLeads: [18, 24, 16, 29, 21, 31, 27, 36, 30, 42, 34, 47],
};

const copy = {
  en: {
    overview: 'Overview',
    company: 'Company workspace',
    greeting: 'Good morning, Minh',
    intro: 'A clear view of today’s work — start with what needs your attention, then follow the signals.',
    period: 'Last 30 days',
    export: 'Export report',
    attention: '2 items need your attention',
    attentionSub: 'One high-intent lead is waiting for a reply. Three contracts are ready for review.',
    review: 'Review queue',
    quick: 'Quick actions',
    addLead: 'Add lead',
    addListing: 'Add listing',
    createContract: 'Create contract',
    revenue: 'Revenue',
    pipeline: 'Open pipeline',
    ai: 'AI deflection rate',
    velocity: 'Sales velocity',
    compared: 'vs previous period',
    target: 'of monthly target',
    noTarget: 'Target not set yet',
    work: 'Work queue',
    workSub: 'The next useful step, in one place',
    reply: 'Reply to lead',
    replySub: 'High intent · source: Facebook',
    contracts: 'Review contracts',
    contractsSub: 'Awaiting your approval',
    listings: 'Complete listings',
    listingsSub: 'Drafts missing a cover image',
    open: 'Open',
    leadFlow: 'Lead flow',
    leadFlowSub: 'New leads by day',
    trend: 'Trend',
    source: 'Source',
    activity: 'Recent activity',
    activitySub: 'Latest changes across the workspace',
    projects: 'Projects',
    projectsSub: 'Leads by project',
    viewAll: 'View all',
    updated: 'Updated just now',
    emptyTarget: 'No target configured',
    focus: 'Focus mode',
    focused: 'Focus mode on',
  },
  vn: {
    overview: 'Tổng quan',
    company: 'Không gian công ty',
    greeting: 'Chào buổi sáng, Minh',
    intro: 'Nắm nhanh công việc hôm nay — xử lý điều cần chú ý trước, rồi theo dõi các tín hiệu.',
    period: '30 ngày qua',
    export: 'Xuất báo cáo',
    attention: '2 việc cần bạn chú ý',
    attentionSub: 'Một khách hàng tiềm năng đang chờ phản hồi. Ba hợp đồng sẵn sàng để duyệt.',
    review: 'Xem hàng đợi',
    quick: 'Thao tác nhanh',
    addLead: 'Thêm khách hàng',
    addListing: 'Đăng tin BĐS',
    createContract: 'Tạo hợp đồng',
    revenue: 'Doanh thu',
    pipeline: 'Giá trị pipeline',
    ai: 'Tỷ lệ AI xử lý',
    velocity: 'Tốc độ bán hàng',
    compared: 'so với kỳ trước',
    target: 'trên mục tiêu tháng',
    noTarget: 'Chưa thiết lập mục tiêu',
    work: 'Hàng đợi công việc',
    workSub: 'Bước tiếp theo hữu ích, ở một nơi',
    reply: 'Trả lời khách hàng',
    replySub: 'Nhu cầu cao · nguồn: Facebook',
    contracts: 'Duyệt hợp đồng',
    contractsSub: 'Đang chờ bạn phê duyệt',
    listings: 'Hoàn thiện tin đăng',
    listingsSub: 'Tin nháp thiếu ảnh bìa',
    open: 'Mở',
    leadFlow: 'Luồng khách hàng',
    leadFlowSub: 'Khách hàng mới theo ngày',
    trend: 'Xu hướng',
    source: 'Nguồn',
    activity: 'Hoạt động gần đây',
    activitySub: 'Thay đổi mới nhất trong workspace',
    projects: 'Dự án',
    projectsSub: 'Khách hàng theo dự án',
    viewAll: 'Xem tất cả',
    updated: 'Vừa cập nhật',
    emptyTarget: 'Chưa có mục tiêu',
    focus: 'Chế độ tập trung',
    focused: 'Đã bật tập trung',
  },
};

const navItems = [
  { label: 'Overview', vi: 'Tổng quan', icon: LayoutDashboard },
  { label: 'Leads', vi: 'Khách hàng', icon: Users },
  { label: 'Listings', vi: 'Kho BĐS', icon: Home },
  { label: 'Contracts', vi: 'Hợp đồng', icon: FileText },
  { label: 'Market valuation', vi: 'Định giá thị trường', icon: Target },
  { label: 'AI guidance', vi: 'Hướng dẫn AI', icon: Bot },
  { label: 'Visitor analytics', vi: 'Phân tích truy cập', icon: Activity },
];

const activities = [
  ['Nguyễn An', 'moved to Qualified', '8 min ago'],
  ['Landmark Riverside', 'new listing published', '34 min ago'],
  ['Trần Hà', 'received an AI reply', '1 hr ago'],
  ['Horizon Villas', 'contract draft updated', '2 hrs ago'],
];

const projects = [
  ['The Marq District 1', '38 leads', '₫5.8B'],
  ['Landmark Riverside', '26 leads', '₫4.1B'],
  ['Horizon Villas', '19 leads', '₫2.7B'],
];

export function GuidedOverview() {
  const [language, setLanguage] = useState<Language>('en');
  const [range, setRange] = useState('30d');
  const [activeNav, setActiveNav] = useState('Overview');
  const [leadView, setLeadView] = useState<'overview' | 'source'>('overview');
  const [expanded, setExpanded] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [toast, setToast] = useState('');
  const t = copy[language];

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const action = (message: string) => notify(language === 'vn' ? `${message} — bản thử nghiệm` : `${message} — mockup action`);

  return (
    <div className={`guided-overview ${focusMode ? 'is-focused' : ''}`}>
      <div className="shell">
        <aside className="sidebar" aria-label="Primary navigation">
          <div className="brand">
            <div className="brand-mark">S</div>
            <div className="brand-name">SGS LAND</div>
          </div>
          <div className="workspace">{t.company}</div>
          <nav className="nav">
            {navItems.map(({ label, vi, icon: Icon }) => (
              <button
                type="button"
                key={label}
                className={activeNav === label ? 'active' : ''}
                onClick={() => {
                  setActiveNav(label);
                  if (label !== 'Overview') action(language === 'vn' ? vi : label);
                }}
              >
                <Icon />
                <span>{language === 'vn' ? vi : label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="profile">
              <div className="avatar">MN</div>
              <div>
                <strong>Minh Nguyễn</strong>
                <span>Team lead</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="crumb">SGS LAND <span>/</span> {t.overview}</div>
            <div className="top-actions">
              <button className="top-icon" type="button" aria-label="Search" onClick={() => action(language === 'vn' ? 'Mở tìm kiếm' : 'Open search')}><Search /></button>
              <button className="top-icon" type="button" aria-label="Notifications" onClick={() => action(language === 'vn' ? 'Mở thông báo' : 'Open notifications')}><Bell /></button>
              <button className="top-icon" type="button" aria-label="Help" onClick={() => action(language === 'vn' ? 'Mở trợ giúp' : 'Open help')}><CircleHelp /></button>
              <div className="language">
                <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
                <span> / </span>
                <button type="button" onClick={() => setLanguage('vn')} aria-pressed={language === 'vn'}>VI</button>
              </div>
            </div>
          </header>

          <div className="content">
            <div className="headline">
              <div>
                <div className="eyebrow">{t.company}</div>
                <h1 className="display">{t.greeting}</h1>
                <p className="intro">{t.intro}</p>
              </div>
              <div className="headline-tools">
                <select className="range" value={range} onChange={(event) => { setRange(event.target.value); action(event.target.value === '7d' ? '7 day view' : event.target.value === '90d' ? '90 day view' : '30 day view'); }} aria-label="Select time range">
                  <option value="7d">{language === 'vn' ? '7 ngày qua' : 'Last 7 days'}</option>
                  <option value="30d">{language === 'vn' ? '30 ngày qua' : 'Last 30 days'}</option>
                  <option value="90d">{language === 'vn' ? '90 ngày qua' : 'Last 90 days'}</option>
                  <option value="all">{language === 'vn' ? 'Tất cả thời gian' : 'All time'}</option>
                </select>
                <button className="outline-btn" type="button" onClick={() => action(t.export)}><ArrowUpRight size={14} />{t.export}</button>
              </div>
            </div>

            <section className="attention" aria-label={t.attention}>
              <div className="attention-copy">
                <span className="attention-dot" />
                <div><strong>{t.attention}</strong><span>{t.attentionSub}</span></div>
              </div>
              <button className="attention-link" type="button" onClick={() => action(t.review)}>{t.review} <ChevronRight size={13} /></button>
            </section>

            <div className="section-head">
              <div className="section-label">{t.quick}</div>
            </div>
            <div className="quick-actions">
              <button type="button" onClick={() => action(t.addLead)}><Users size={15} /><span>{t.addLead}</span><ChevronRight size={13} /></button>
              <button type="button" onClick={() => action(t.addListing)}><Home size={15} /><span>{t.addListing}</span><ChevronRight size={13} /></button>
              <button type="button" onClick={() => action(t.createContract)}><FileText size={15} /><span>{t.createContract}</span><ChevronRight size={13} /></button>
            </div>

            <div className="metrics" aria-label={t.overview}>
              <div className="metric"><div className="metric-label">{t.revenue}</div><div className="metric-value mono">{sample.revenue}</div><div className="metric-note"><span className="positive">↑ 12.6%</span> {t.compared}</div><div className="bar"><i style={{ width: '71%' }} /></div></div>
              <div className="metric"><div className="metric-label">{t.pipeline}</div><div className="metric-value mono">{sample.pipeline}</div><div className="metric-note"><span className="positive">47.2%</span> {language === 'vn' ? 'xác suất thắng' : 'win probability'}</div><div className="bar"><i style={{ width: '54%' }} /></div></div>
              <div className="metric"><div className="metric-label">{t.ai}</div><div className="metric-value mono">{sample.aiDeflection}</div><div className="metric-note"><span className="positive">↑ 4.8%</span> {t.compared}</div></div>
              <div className="metric"><div className="metric-label">{t.velocity}</div><div className="metric-value mono">{sample.velocity}</div><div className="metric-note"><span className="positive">↓ 3.4 days</span> {t.compared}</div><div className="bar"><i style={{ width: '63%' }} /></div></div>
            </div>

            <div className="work-grid">
              <section className={`panel lead-panel ${expanded ? 'expanded' : ''}`}>
                <div className="panel-head">
                  <div><div className="panel-title">{t.leadFlow}</div><div className="panel-subtitle">{t.leadFlowSub} · {range}</div></div>
                  <div className="panel-controls">
                    <div className="segmented" role="tablist" aria-label="Lead chart view">
                      <button type="button" className={leadView === 'overview' ? 'active' : ''} onClick={() => setLeadView('overview')}>{t.trend}</button>
                      <button type="button" className={leadView === 'source' ? 'active' : ''} onClick={() => setLeadView('source')}>{t.source}</button>
                    </div>
                    <button className="expand-btn" type="button" aria-label={expanded ? 'Collapse chart' : 'Expand chart'} onClick={() => setExpanded(!expanded)}>{expanded ? <X size={15} /> : <Maximize2 size={15} />}</button>
                  </div>
                </div>
                {leadView === 'overview' ? (
                  <div className="chart-wrap">
                    <div className="chart-meta"><span>47 {language === 'vn' ? 'khách hàng mới' : 'new leads'}</span><span className="positive">↑ 18.4%</span></div>
                    <div className="chart" aria-label="New leads trend">
                      {sample.trend.map((height, index) => <div className="chart-col" key={index}><i style={{ height: `${height * .7}%` }} /><i style={{ height: `${sample.newLeads[index] * 1.7}%` }} /><em>{['01','03','05','07','09','11','13','15','17','19','21','23'][index]}</em></div>)}
                    </div>
                    <div className="chart-legend"><span><i className="legend-dot" />{language === 'vn' ? 'Khách đủ điều kiện' : 'Qualified'}</span><span><i className="legend-dot muted" />{language === 'vn' ? 'Tất cả khách mới' : 'All new leads'}</span></div>
                  </div>
                ) : (
                  <div className="source-list">
                    {[['Facebook', '42%', '20'], ['Website', '30%', '14'], ['Referral', '19%', '9'], ['Other', '9%', '4']].map(([source, percentage, count]) => <div className="source-row" key={source}><span>{source}</span><div className="source-bar"><i style={{ width: percentage }} /></div><strong className="mono">{count}</strong></div>)}
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panel-head"><div><div className="panel-title">{t.work}</div><div className="panel-subtitle">{t.workSub}</div></div><button className="top-icon" type="button" aria-label="Refresh work queue" onClick={() => action(language === 'vn' ? 'Đã làm mới hàng đợi' : 'Queue refreshed')}><RefreshCw size={14} /></button></div>
                <div className="queue">
                  <div className="queue-row"><div className="queue-left"><div className="queue-icon warn"><MessageSquareText /></div><div><div className="queue-name">{t.reply}</div><div className="queue-detail">{t.replySub}</div></div></div><button className="queue-action" type="button" onClick={() => action(t.reply)}>{t.open}</button></div>
                  <div className="queue-row"><div className="queue-left"><div className="queue-icon"><FileText /></div><div><div className="queue-name">{t.contracts}</div><div className="queue-detail">{t.contractsSub}</div></div></div><button className="queue-action" type="button" onClick={() => action(t.contracts)}>{t.open}</button></div>
                  <div className="queue-row"><div className="queue-left"><div className="queue-icon"><Home /></div><div><div className="queue-name">{t.listings}</div><div className="queue-detail">{t.listingsSub}</div></div></div><button className="queue-action" type="button" onClick={() => action(t.listings)}>{t.open}</button></div>
                </div>
              </section>
            </div>

            <div className="lower-grid">
              <section className="panel">
                <div className="panel-head"><div><div className="panel-title">{t.activity}</div><div className="panel-subtitle">{t.activitySub}</div></div><button className="queue-action" type="button" onClick={() => action(t.viewAll)}>{t.viewAll} <ChevronRight size={12} /></button></div>
                <div className="list">{activities.map(([name, change, time]) => <div className="activity" key={`${name}-${change}`}><span className="activity-mark" /><div><strong>{name}</strong><p>{change}</p></div><time>{time}</time></div>)}</div>
              </section>
              <section className="panel">
                <div className="panel-head"><div><div className="panel-title">{t.projects}</div><div className="panel-subtitle">{t.projectsSub}</div></div><button className="queue-action" type="button" onClick={() => action(language === 'vn' ? 'Mở phân tích dự án' : 'Open project analytics')}><ArrowUpRight size={13} /></button></div>
                <div className="list">{projects.map(([name, count, value]) => <div className="project" key={name}><div><div className="project-name">{name}</div><div className="project-meta">{count}</div></div><div className="project-value">{value}</div></div>)}</div>
              </section>
            </div>

            <div className="footer-note"><span><RefreshCw size={11} /> {t.updated} · {language === 'vn' ? 'Phạm vi: công ty' : 'Scope: company'}</span><button type="button" onClick={() => { setFocusMode(!focusMode); notify(focusMode ? t.focus : t.focused); }}><Settings2 size={11} /> {focusMode ? t.focused : t.focus}</button></div>
          </div>
        </main>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
