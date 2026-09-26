// Routing rules fix + mobile Minh bar overlap.
import fs from 'node:fs';
const DRY = !!process.env.DRY;
const report = [];
function patch(file, steps) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [name, fn] of steps) {
    const n = fn(s);
    if (n === null || n === s) { report.push(`FAIL ${file}: ${name}`); return; }
    s = n;
  }
  if (!DRY) fs.writeFileSync(file, s);
  report.push(`OK   ${file} (${steps.length} steps)`);
}
const lit = (a, b) => (s) => (s.includes(a) ? s.replace(a, () => b) : null);
const install = (src, dst, guard) => {
  if (guard && !guard(fs.readFileSync(dst, 'utf8'))) { report.push(`FAIL ${dst}: changed since review`); return; }
  if (!DRY) fs.copyFileSync(src, dst);
  report.push(`OK   ${dst}`);
};

install('.cc/rr/routingRuleRepository.ts', 'server/repositories/routingRuleRepository.ts', s => s.includes('async matchLead') && !s.includes('normalizeRegion'));
install('.cc/rr/routingRuleRoutes.ts', 'server/routes/routingRuleRoutes.ts', s => s.includes("'Only admins and team leads can create routing rules'"));
install('.cc/rr/RoutingRules.tsx', 'pages/RoutingRules.tsx', s => s.includes('const RuleModal = ') && s.includes('opacity-0 group-hover:opacity-100'));
install('.cc/rr/routingRules.test.ts', 'src/test/routingRules.test.ts');

// Surface server messages instead of a generic English error; add the simulator call.
const errOf = `(await result.json().catch(() => ({}))).error`;
patch('services/dbApi.ts', [
  ['create msg', lit(`    if (!result.ok) throw new Error('Failed to create routing rule');`, `    if (!result.ok) throw new Error(${errOf} || 'Không lưu được luật phân bổ');`)],
  ['update msg', lit(`    if (!result.ok) throw new Error('Failed to update routing rule');`, `    if (!result.ok) throw new Error(${errOf} || 'Không lưu được luật phân bổ');`)],
  ['delete msg + simulate', lit(`    if (!result.ok) throw new Error('Failed to delete routing rule');
    return true;
  }`, `    if (!result.ok) throw new Error(${errOf} || 'Không xóa được luật phân bổ');
    return true;
  }
  async simulateRouting(input: { source?: string; region?: string; budget?: number }) {
    const result = await fetch('/api/routing-rules/simulate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!result.ok) throw new Error(${errOf} || 'Không chạy được mô phỏng');
    return result.json();
  }`)],
]);

// Mobile: the "Nhắn cho trợ lý Minh" bar floats above the tab bar; reserve its height so the
// bottom of every page (tables, sticky footers) is no longer hidden behind it.
patch('components/WorkspaceNavigation.tsx', [
  ['reserve assistant bar', lit(`<div className="relative mb-[calc(4rem+env(safe-area-inset-bottom))] min-h-0 flex-1 overflow-hidden bg-[var(--bg-app)] md:mb-0">`,
    "<div className={`relative ${assistantOpen ? 'mb-[calc(4rem+env(safe-area-inset-bottom))]' : 'mb-[calc(7.75rem+env(safe-area-inset-bottom))]'} min-h-0 flex-1 overflow-hidden bg-[var(--bg-app)] md:mb-0`}>")],
]);
patch('components/Layout.tsx', [
  ['center bar on wide phones/tablets', lit(`className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 text-left shadow-lg md:hidden"`,
    `className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex min-h-12 max-w-xl items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-surface)] px-4 text-left shadow-lg md:hidden"`)],
]);

const UPDATE = {
  'routing.title': ['Luật phân bổ lead', 'Lead routing rules'],
  'routing.btn_add': ['Thêm luật', 'Add rule'],
  'routing.modal_title': ['Thêm luật phân bổ', 'New routing rule'],
  'routing.empty_title': ['Chưa có luật phân bổ', 'No routing rules yet'],
  'routing.sim_no_match': ['Không có luật nào khớp', 'No rule matches'],
  'routing.placeholder_region': ['VD: TP.HCM, Hà Nội', 'e.g. HCMC, Hanoi'],
  'routing.stg_BEST_AVAILABLE': ['Người ít việc nhất', 'Least busy'],
};
const NEW = {
  'routing.modal_edit': ['Sửa luật phân bổ', 'Edit routing rule'],
  'routing.placeholder_name': ['VD: Khách Facebook khu vực TP.HCM', 'e.g. Facebook leads in HCMC'],
  'routing.priority_hint': ['Số nhỏ được xét trước. Luật đầu tiên khớp sẽ nhận lead.', 'Lower numbers are checked first. The first matching rule wins.'],
  'routing.active_label': ['Đang áp dụng', 'Active'],
  'routing.conditions_hint': ['Để trống điều kiện nào thì bỏ qua điều kiện đó.', 'Leave a condition empty to ignore it.'],
  'routing.region_hint': ['Khu vực so với địa chỉ khách, không phân biệt dấu và hiểu viết tắt (HCM, TP.HCM, Sài Gòn, HN…). Nhiều khu vực cách nhau bằng dấu phẩy.', 'Matched against the lead address, accent-insensitive, understands abbreviations (HCM, Saigon, HN…). Separate several regions with commas.'],
  'routing.placeholder_budget': ['VD: 3 tỷ', 'e.g. 3 tỷ'],
  'routing.target_user': ['Nhân viên nhận lead', 'Assign to'],
  'routing.target_team': ['Nhóm nhận lead', 'Assign to team'],
  'routing.target_placeholder': ['Chọn người nhận', 'Choose a recipient'],
  'routing.no_teams': ['Chưa có nhóm nào. Tạo nhóm trong Nhân viên & phân công.', 'No teams yet. Create one under Employees.'],
  'routing.stg_hint_ROUND_ROBIN': ['Lần lượt từng thành viên, người lâu chưa nhận lead được giao trước.', 'Members take turns; whoever waited longest goes next.'],
  'routing.stg_hint_BEST_AVAILABLE': ['Giao cho thành viên đang giữ ít lead mở nhất.', 'Goes to the member with the fewest open leads.'],
  'routing.err_name': ['Vui lòng nhập tên luật.', 'Please enter a rule name.'],
  'routing.err_target': ['Vui lòng chọn người hoặc nhóm nhận lead.', 'Please choose who receives the lead.'],
  'routing.err_budget_format': ['Ngân sách chưa đúng định dạng (VD: 3 tỷ, 800 triệu).', 'Budget format not recognised (e.g. 3 tỷ, 800 triệu).'],
  'routing.err_budget_range': ['Ngân sách tối thiểu phải nhỏ hơn tối đa.', 'Minimum budget must be below the maximum.'],
  'routing.err_save': ['Không lưu được luật phân bổ.', 'Could not save the rule.'],
  'routing.err_delete': ['Không xóa được luật phân bổ.', 'Could not delete the rule.'],
  'routing.err_sim': ['Không chạy được mô phỏng.', 'Could not run the simulation.'],
  'routing.saving': ['Đang lưu...', 'Saving...'],
  'routing.unknown_target': ['(người nhận đã bị xóa)', '(recipient removed)'],
  'routing.chip_budget_min': ['Ngân sách từ {amount}', 'Budget from {amount}'],
  'routing.chip_budget_max': ['Ngân sách đến {amount}', 'Budget up to {amount}'],
  'routing.enabled_ok': ['Đã bật luật', 'Rule turned on'],
  'routing.disabled_ok': ['Đã tắt luật', 'Rule turned off'],
  'routing.order_hint': ['Luật được xét theo độ ưu tiên từ nhỏ đến lớn; luật khớp đầu tiên sẽ nhận lead.', 'Rules run in priority order; the first match takes the lead.'],
  'routing.status_on': ['Đang bật', 'On'],
  'routing.status_off': ['Đang tắt', 'Off'],
  'routing.turn_on': ['Bật luật', 'Turn on'],
  'routing.turn_off': ['Tắt luật', 'Turn off'],
  'routing.assign_user_line': ['Giao cho {name}', 'Assign to {name}'],
  'routing.assign_team_line': ['Giao cho nhóm {name} · {strategy}', 'Assign to team {name} · {strategy}'],
  'routing.sim_desc': ['Thử một khách giả định để xem lead sẽ được giao cho ai, dùng đúng quy tắc khi tạo lead thật.', 'Try a sample lead to see who would receive it, using the real matching.'],
  'routing.sim_no_source': ['Không rõ nguồn', 'Unknown source'],
  'routing.sim_address': ['Địa chỉ hoặc khu vực của khách', 'Lead address or region'],
  'routing.sim_running': ['Đang mô phỏng...', 'Simulating...'],
  'routing.sim_matched': ['Khớp luật: {name}', 'Matched: {name}'],
  'routing.sim_fallback': ['Lead sẽ giao cho người tạo lead.', 'The lead stays with whoever created it.'],
  'routing.fail_none': ['Khớp', 'Match'],
  'routing.fail_source': ['Khác nguồn', 'Source differs'],
  'routing.fail_region': ['Khác khu vực', 'Region differs'],
  'routing.fail_tags': ['Thiếu thẻ', 'Missing tag'],
  'routing.fail_budgetMin': ['Ngân sách thấp hơn', 'Budget too low'],
  'routing.fail_budgetMax': ['Ngân sách cao hơn', 'Budget too high'],
  'routing.fail_temperature': ['Khác mức quan tâm', 'Temperature differs'],
  'routing.fail_inactive': ['Đang tắt', 'Off'],
};
{
  const f = 'config/locales.ts';
  let src = fs.readFileSync(f, 'utf8');
  const enStart = src.search(/^\s*en\s*:\s*\{/m);
  let upd = 0; const miss = [];
  for (const [k, [vn, en]] of Object.entries(UPDATE)) {
    const re = new RegExp(`^(\\s*)"${k.replace(/\./g, '\\.')}"\\s*:\\s*"(?:[^"\\\\]|\\\\.)*",?`, 'gm');
    const m = [...src.matchAll(re)];
    const vnM = m.find(x => x.index < enStart), enM = m.find(x => x.index > enStart);
    if (!vnM || !enM) { miss.push(k); continue; }
    src = src.slice(0, enM.index) + `${enM[1]}${JSON.stringify(k)}: ${JSON.stringify(en)},` + src.slice(enM.index + enM[0].length);
    src = src.slice(0, vnM.index) + `${vnM[1]}${JSON.stringify(k)}: ${JSON.stringify(vn)},` + src.slice(vnM.index + vnM[0].length);
    upd++;
  }
  const anchors = [...src.matchAll(/^(\s*)"detail\.history"\s*:.*$/gm)];
  if (anchors.length !== 2) report.push(`FAIL ${f}: anchors ${anchors.length}`);
  else {
    const [a, b] = anchors;
    const ins = (i, indent, block) => Object.entries(NEW).filter(([k]) => !block.includes(`"${k}"`)).map(([k, v]) => `${indent}${JSON.stringify(k)}: ${JSON.stringify(v[i])},`).join('\n');
    const enIns = ins(1, b[1], src.slice(a.index + a[0].length));
    const vnIns = ins(0, a[1], src.slice(0, b.index));
    const bEnd = b.index + b[0].length; src = src.slice(0, bEnd) + (enIns ? '\n' + enIns : '') + src.slice(bEnd);
    const aEnd = a.index + a[0].length; src = src.slice(0, aEnd) + (vnIns ? '\n' + vnIns : '') + src.slice(aEnd);
    if (!DRY) fs.writeFileSync(f, src);
    report.push(`OK   ${f} (updated ${upd}${miss.length ? ', MISSING ' + miss.join(',') : ''}; +${vnIns ? vnIns.split('\n').length : 0} VN / +${enIns ? enIns.split('\n').length : 0} EN)`);
  }
}
console.log(report.join('\n'));
