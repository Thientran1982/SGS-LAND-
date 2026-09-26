// Inbox follow-up: badge base class, context panel breakpoint, accurate preview hint.
import fs from 'node:fs';
const DRY = !!process.env.DRY;
const report = [];
function patch(file, steps) {
  let src = fs.readFileSync(file, 'utf8');
  for (const [name, fn] of steps) {
    const next = fn(src);
    if (next === null || next === src) { report.push(`FAIL ${file}: ${name}`); return; }
    src = next;
  }
  if (!DRY) fs.writeFileSync(file, src);
  report.push(`OK   ${file} (${steps.length} steps)`);
}
const all = (a, b) => (s) => (s.includes(a) ? s.split(a).join(b) : null);
const lit = (a, b) => (s) => (s.includes(a) ? s.replace(a, () => b) : null);

patch('pages/Inbox.tsx', [
  ['badge base (attr)', all('className="ui-badge-', 'className="ui-badge ui-badge-')],
  ['badge base (ternary)', lit("isAiActiveForSelected ? 'ui-badge-success' : 'ui-badge-warning'", "isAiActiveForSelected ? 'ui-badge ui-badge-success' : 'ui-badge ui-badge-warning'")],
  // 1440px+: keeps the conversation column >= ~700px next to the context panel.
  ['aside breakpoint', lit('<aside className="hidden xl:flex w-[300px]', '<aside className="hidden min-[1440px]:flex w-[300px]')],
  ['header avatar breakpoint', lit('shrink-0 text-sm xl:hidden">', 'shrink-0 text-sm min-[1440px]:hidden">')],
]);

const dl = 'components/detail/DetailLayout.tsx';
if (fs.existsSync(dl)) {
  const s = fs.readFileSync(dl, 'utf8');
  report.push(`INFO ${dl}: ${/['"`]ui-badge ui-badge-|ui-badge \$|className=\{`ui-badge /.test(s) ? 'has base class' : 'CHECK base class'}`);
  const m = s.match(/CHIP_TONE[\s\S]{0,400}/); if (m) report.push(m[0].split('\n').slice(0, 8).join('\n'));
  const u = s.match(/.*CHIP_TONE\[.*/g); if (u) report.push(u.join('\n'));
}

{
  const f = 'config/locales.ts';
  let src = fs.readFileSync(f, 'utf8');
  const a = '"inbox.widget_preview_hint": "Khung chat dùng màu thương hiệu SGS Land và tự đổi ngôn ngữ theo trình duyệt của khách.",';
  const b = '"inbox.widget_preview_hint": "The chat uses SGS Land brand colours and follows the visitor\'s language.",';
  if (!src.includes(a) || !src.includes(b)) report.push('FAIL locales hint');
  else {
    src = src.replace(a, '"inbox.widget_preview_hint": "Bản xem trước gần đúng; tiêu đề và lời chào cập nhật ngay khi bạn sửa.",')
             .replace(b, '"inbox.widget_preview_hint": "Approximate preview; the title and greeting update as you type.",');
    if (!DRY) fs.writeFileSync(f, src);
    report.push('OK   locales hint');
  }
}
console.log(report.join('\n'));
