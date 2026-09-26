// Projects + product catalog design pass: swap in reviewed Projects.tsx, update locale keys.
import fs from 'node:fs';
import crypto from 'node:crypto';
const DRY = !!process.env.DRY;
const report = [];
const F = 'pages/Projects.tsx';
const md5 = crypto.createHash('md5').update(fs.readFileSync(F)).digest('hex');
if (md5 !== '67b0da9c4a306e5f91eed807d284b4af') report.push(`FAIL ${F}: changed since review (${md5}) - not replaced`);
else { if (!DRY) fs.copyFileSync('.cc/Projects.new.tsx', F); report.push(`OK   ${F} replaced`); }

const UPDATE = { // [vn, en|null]
  'project.title': ['Quản lý dự án', null],
  'project.new': ['Tạo dự án', null],
  'project.edit': ['Chỉnh sửa dự án', null],
  'project.partner_view_title': ['Dự án bạn được ủy quyền', null],
  'project.listing_count': ['sản phẩm', null],
  'project.stat_inactive': ['Ngừng giao dịch', null],
};
const NEW = {
  'project.search_placeholder': ['Tìm theo tên, mã hoặc vị trí', 'Search by name, code or location'],
  'project.status_all': ['Mọi trạng thái', 'All statuses'],
  'project.scale_label': ['Quy mô', 'Scale'],
  'project.price_label': ['Giá', 'Price'],
  'project.price_matrix': ['Bảng giá', 'Price list'],
  'project.listing_search_placeholder': ['Tìm theo mã hoặc tên sản phẩm', 'Search by code or name'],
  'project.listings_load_error': ['Không tải được danh mục sản phẩm', 'Could not load the product catalog'],
  'project.listings_retry': ['Thử lại', 'Retry'],
};
const f = 'config/locales.ts';
let src = fs.readFileSync(f, 'utf8');
const enStart = src.search(/^\s*en\s*:\s*\{/m);
let upd = 0; const miss = [];
for (const [k, [vn, en]] of Object.entries(UPDATE)) {
  const re = new RegExp(`^(\\s*)"${k.replace(/\./g, '\\.')}"\\s*:\\s*"(?:[^"\\\\]|\\\\.)*",?`, 'gm');
  const m = [...src.matchAll(re)];
  const vnM = m.find(x => x.index < enStart), enM = m.find(x => x.index > enStart);
  if (!vnM) { miss.push(k); continue; }
  if (en && enM) src = src.slice(0, enM.index) + `${enM[1]}${JSON.stringify(k)}: ${JSON.stringify(en)},` + src.slice(enM.index + enM[0].length);
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
console.log(report.join('\n'));
