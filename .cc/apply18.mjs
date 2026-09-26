// Scoring config + sequences design pass.
import fs from 'node:fs';
import crypto from 'node:crypto';
const DRY = !!process.env.DRY;
const report = [];
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const install = (src, dst, hash) => {
  if (hash && md5(dst) !== hash) { report.push(`FAIL ${dst}: changed since review`); return; }
  if (!DRY) fs.copyFileSync(src, dst);
  report.push(`OK   ${dst}`);
};
install('.cc/sq/Sequences.new.tsx', 'pages/Sequences.tsx', '6e87a545fde3ac5ab859cfd617036619');
install('.cc/sq/ScoringRules.tsx', 'pages/ScoringRules.tsx', '371634729dddcdaf8c062be3c0fa80ab');

// Server: validate scoring config instead of storing anything.
{
  const f = 'server/routes/scoringRoutes.ts';
  let s = fs.readFileSync(f, 'utf8');
  const a = `      if (!weights || typeof weights !== 'object') {
        return res.status(400).json({ error: 'weights is required' });
      }`;
  const b = `      if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
        return res.status(400).json({ error: 'Thiếu trọng số chấm điểm' });
      }
      const values = Object.values(weights).map(Number);
      if (values.some(v => !Number.isFinite(v) || v < 0 || v > 100) || values.reduce((x, y) => x + y, 0) <= 0) {
        return res.status(400).json({ error: 'Trọng số phải từ 0 đến 100 và tổng lớn hơn 0' });
      }
      if (thresholds !== undefined) {
        const th = thresholds || {};
        const [A, B, C, D] = ['A', 'B', 'C', 'D'].map(k => Number(th[k]));
        if (![A, B, C, D].every(Number.isFinite) || !(A <= 100 && A > B && B > C && C > D && D >= 0)) {
          return res.status(400).json({ error: 'Ngưỡng hạng phải giảm dần từ A đến D trong khoảng 0–100' });
        }
      }`;
  if (!s.includes(a)) report.push(`FAIL ${f}`);
  else {
    s = s.replace(a, b)
      .replace(`return res.status(403).json({ error: 'Only admins can update scoring config' });`, `return res.status(403).json({ error: 'Chỉ quản trị viên và trưởng nhóm được sửa cấu hình điểm số' });`)
      .replace(`res.status(500).json({ error: 'Failed to update scoring config' });`, `res.status(500).json({ error: 'Không lưu được cấu hình điểm số' });`)
      .replace(`res.status(500).json({ error: 'Failed to fetch scoring config' });`, `res.status(500).json({ error: 'Không tải được cấu hình điểm số' });`);
    if (!DRY) fs.writeFileSync(f, s);
    report.push(`OK   ${f}`);
  }
}

const UPDATE = {
  'scoring.title': ['Cấu hình điểm số lead', 'Lead scoring'],
  'scoring.subtitle': ['Đặt trọng số cho từng tiêu chí và ngưỡng xếp hạng khách hàng.', 'Weight each criterion and set the grade thresholds.'],
  'scoring.sim_title': ['Thử chấm điểm', 'Try a score'],
  'scoring.sim_desc': ['Kéo mức đáp ứng của một khách giả định để xem điểm và hạng theo cấu hình hiện tại.', 'Move a sample lead\'s fulfilment to see the score and grade with the current settings.'],
  'scoring.engagement': ['Mức độ tương tác', 'Engagement'],
  'scoring.completeness': ['Độ đầy đủ hồ sơ', 'Profile completeness'],
  'scoring.budget_fit': ['Phù hợp ngân sách', 'Budget fit'],
  'scoring.velocity': ['Tốc độ phản hồi', 'Response speed'],
  'seq.title': ['Chiến dịch tự động', 'Automated campaigns'],
  'seq.btn_new': ['Tạo chiến dịch', 'New campaign'],
  'seq.step_email': ['Gửi email', 'Send email'],
  'seq.step_task': ['Tạo công việc', 'Create task'],
  'seq.modal_add_step_title': ['Thêm bước', 'Add step'],
  'seq.modal_edit_step_title': ['Sửa bước', 'Edit step'],
  'seq.step_delay_label': ['Thời điểm chạy', 'Run after'],
  'seq.stats_click_rate': ['Tỷ lệ bấm link', 'Click rate'],
  'seq.empty_steps': ['Chưa có bước nào. Bấm để thêm bước đầu tiên.', 'No steps yet. Click to add the first one.'],
  'seq.placeholder_content': ['Nội dung email hoặc tin nhắn...', 'Email or message content...'],
  'seq.trigger_stage': ['Bắt đầu khi khách chuyển sang giai đoạn', 'Start when the lead moves to'],
};
const NEW = {
  'scoring.version_n': ['Phiên bản {n}', 'Version {n}'],
  'scoring.weights_title': ['Trọng số tiêu chí', 'Criteria weights'],
  'scoring.weights_desc': ['Điểm cuối được quy về thang 100 theo tỷ lệ giữa các tiêu chí, nên tổng không cần bằng 100.', 'The final score is scaled to 100 by each criterion\'s share, so the total need not be 100.'],
  'scoring.use_defaults': ['Dùng giá trị mặc định', 'Use defaults'],
  'scoring.hint_engagement': ['Số lần nhắn, gọi, mở email, xem tin của khách.', 'Messages, calls, email opens and listing views.'],
  'scoring.hint_completeness': ['Hồ sơ có đủ số điện thoại, email, nhu cầu, khu vực.', 'Phone, email, needs and area are filled in.'],
  'scoring.hint_budget_fit': ['Ngân sách khách khớp với giá sản phẩm quan tâm.', 'Budget matches the price of listings of interest.'],
  'scoring.hint_velocity': ['Khách trả lời nhanh sau khi được liên hệ.', 'How fast the lead replies after contact.'],
  'scoring.points_n': ['{n} điểm', '{n} pts'],
  'scoring.share_n': ['chiếm {n}%', '{n}% of total'],
  'scoring.total_note': ['Tổng trọng số hiện tại: {n} điểm.', 'Current total weight: {n} pts.'],
  'scoring.err_weights': ['Cần ít nhất một tiêu chí có trọng số lớn hơn 0.', 'At least one criterion needs a weight above 0.'],
  'scoring.thresholds_title': ['Ngưỡng xếp hạng', 'Grade thresholds'],
  'scoring.thresholds_desc': ['Khách đạt từ ngưỡng trở lên sẽ được xếp vào hạng tương ứng.', 'Leads at or above a threshold get that grade.'],
  'scoring.grade_A': ['Hạng A · nóng', 'Grade A · hot'],
  'scoring.grade_B': ['Hạng B · ấm', 'Grade B · warm'],
  'scoring.grade_C': ['Hạng C · quan tâm', 'Grade C · interested'],
  'scoring.grade_D': ['Hạng D · nguội', 'Grade D · cool'],
  'scoring.grade_none': ['Chưa xếp hạng', 'Ungraded'],
  'scoring.from': ['Từ', 'From'],
  'scoring.err_thresholds': ['Ngưỡng phải giảm dần từ A đến D và nằm trong khoảng 0–100.', 'Thresholds must decrease from A to D within 0–100.'],
  'scoring.sim_factor': ['Mức đáp ứng: {name}', 'Fulfilment: {name}'],
  'scoring.sim_formula': ['Điểm = tổng (trọng số × mức đáp ứng) ÷ tổng trọng số × 100.', 'Score = Σ(weight × fulfilment) ÷ total weight × 100.'],
  'scoring.unsaved': ['Có thay đổi chưa lưu', 'Unsaved changes'],
  'scoring.saved_state': ['Đã lưu', 'All changes saved'],
  'scoring.discard': ['Hoàn tác', 'Discard'],
  'scoring.saving': ['Đang lưu...', 'Saving...'],
  'seq.delay_now': ['Ngay lập tức', 'Immediately'],
  'seq.delay_hours': ['Sau {n} giờ', 'After {n}h'],
  'seq.delay_days': ['Sau {n} ngày', 'After {n} days'],
  'seq.delay_unit': ['Đơn vị thời gian', 'Time unit'],
  'seq.unit_hours': ['Giờ', 'Hours'],
  'seq.unit_days': ['Ngày', 'Days'],
  'seq.delay_hint': ['tính từ bước trước', 'after the previous step'],
  'seq.variables_hint': ['Dùng {{name}} để chèn tên khách.', 'Use {{name}} to insert the lead name.'],
  'seq.step_required': ['Vui lòng nhập nội dung cho bước này.', 'Please fill in this step.'],
  'seq.move_up': ['Chuyển lên', 'Move up'],
  'seq.move_down': ['Chuyển xuống', 'Move down'],
  'seq.name_label': ['Tên chiến dịch', 'Campaign name'],
  'seq.name_required': ['Vui lòng nhập tên chiến dịch.', 'Please enter a campaign name.'],
  'seq.active_needs_steps': ['Chiến dịch cần ít nhất một bước trước khi bật.', 'Add at least one step before activating.'],
  'seq.trigger_hint': ['Khách được đưa vào chiến dịch ngay khi chuyển sang giai đoạn này.', 'Leads join as soon as they reach this stage.'],
  'seq.steps_title': ['Các bước', 'Steps'],
  'seq.discard_title': ['Bỏ thay đổi?', 'Discard changes?'],
  'seq.discard_msg': ['Các chỉnh sửa chưa lưu sẽ mất.', 'Unsaved edits will be lost.'],
  'seq.discard_confirm': ['Bỏ thay đổi', 'Discard'],
  'seq.keep_editing': ['Tiếp tục sửa', 'Keep editing'],
  'seq.cat_all': ['Tất cả', 'All'],
  'seq.cat_lead': ['Khách mới', 'New leads'],
  'seq.cat_nurture': ['Chăm sóc', 'Nurture'],
  'seq.cat_closing': ['Chốt giao dịch', 'Closing'],
  'seq.cat_retention': ['Giữ chân', 'Retention'],
  'seq.gallery_title': ['Thư viện mẫu', 'Template library'],
  'seq.gallery_desc': ['Chọn một mẫu rồi tùy chỉnh theo nhu cầu.', 'Pick a template and adjust it.'],
  'seq.gallery_loading': ['Đang tải mẫu...', 'Loading templates...'],
  'seq.gallery_empty': ['Không có mẫu nào', 'No templates'],
  'seq.gallery_error': ['Không tải được thư viện mẫu', 'Could not load templates'],
  'seq.use_template': ['Dùng mẫu', 'Use template'],
  'seq.n_steps': ['{n} bước', '{n} steps'],
  'seq.n_emails': ['{n} email', '{n} emails'],
  'seq.n_tasks': ['{n} công việc', '{n} tasks'],
  'seq.duplicate': ['Nhân bản', 'Duplicate'],
  'seq.pause': ['Tạm dừng', 'Pause'],
  'seq.activate': ['Bật chiến dịch', 'Activate'],
  'seq.trigger_chip': ['Khi: {stage}', 'When: {stage}'],
  'seq.created_from_template': ['Đã tạo chiến dịch từ mẫu', 'Campaign created from template'],
  'seq.copy_suffix': ['(bản sao)', '(copy)'],
  'seq.duplicated': ['Đã nhân bản chiến dịch', 'Campaign duplicated'],
  'seq.duplicate_error': ['Không nhân bản được chiến dịch', 'Could not duplicate the campaign'],
  'seq.paused_ok': ['Đã tạm dừng chiến dịch', 'Campaign paused'],
  'seq.activated_ok': ['Đã bật chiến dịch', 'Campaign activated'],
  'seq.status_error': ['Không cập nhật được trạng thái', 'Could not update the status'],
  'seq.deleted': ['Đã xóa chiến dịch', 'Campaign deleted'],
  'seq.templates_btn': ['Thư viện mẫu', 'Templates'],
  'seq.use_existing_template': ['Dùng mẫu có sẵn', 'Start from a template'],
  'seq.create_blank': ['Tạo trống', 'Start blank'],
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
