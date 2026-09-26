// Unit inventory from project catalog: install files + locale keys.
import fs from 'node:fs';
const DRY = !!process.env.DRY;
const report = [];
const install = (src, dst, guard) => {
  if (!fs.existsSync(src)) { report.push(`FAIL missing ${src}`); return; }
  if (guard && fs.existsSync(dst) && !guard(fs.readFileSync(dst, 'utf8'))) { report.push(`FAIL ${dst}: changed since review - not replaced`); return; }
  if (fs.existsSync(dst) === false && guard) report.push(`INFO ${dst} did not exist`);
  if (!DRY) fs.copyFileSync(src, dst);
  report.push(`OK   ${dst}`);
};
install('.cc/ui/unitInventory.ts', 'utils/unitInventory.ts');
install('.cc/ui/UnitInventory.tsx', 'pages/UnitInventory.tsx', s => s.includes('buildSeedUnits') && s.includes('Tạo dữ liệu mẫu'));
install('.cc/ui/unitInventory.test.ts', 'src/test/unitInventory.test.ts');

const NEW = {
  'unitinv.title': ['Tồn kho cấp căn', 'Unit inventory'],
  'unitinv.subtitle': ['Sơ đồ căn theo tòa và tầng, lấy trực tiếp từ danh mục sản phẩm của dự án', 'Stacking plan by tower and floor, read live from the project catalog'],
  'unitinv.select_project': ['Chọn dự án', 'Select a project'],
  'unitinv.loading_projects': ['Đang tải dự án...', 'Loading projects...'],
  'unitinv.search_placeholder': ['Tìm mã căn', 'Search unit'],
  'unitinv.refresh': ['Làm mới', 'Refresh'],
  'unitinv.open_catalog': ['Mở danh mục dự án', 'Open project catalog'],
  'unitinv.load_error': ['Không tải được tồn kho', 'Could not load inventory'],
  'unitinv.retry': ['Thử lại', 'Retry'],
  'unitinv.source_note': ['Nguồn: danh mục sản phẩm của dự án {project} (mã {code}). Đổi trạng thái căn trong danh mục thì trang này cập nhật theo.', 'Source: product catalog of {project} (code {code}). Status changes in the catalog show up here.'],
  'unitinv.kpi_total': ['Tổng căn', 'Total units'],
  'unitinv.kpi_available': ['Còn hàng', 'Available'],
  'unitinv.kpi_reserved': ['Giữ chỗ và booking', 'On hold and booked'],
  'unitinv.kpi_sold': ['Đã bán hoặc cho thuê', 'Sold or rented'],
  'unitinv.kpi_sold_rate': ['Tỷ lệ bán {n}%', '{n}% sold'],
  'unitinv.kpi_available_value': ['Giá trị còn hàng', 'Available stock value'],
  'unitinv.filter_all': ['Tất cả', 'All'],
  'unitinv.filter_available': ['Còn hàng', 'Available'],
  'unitinv.filter_reserved': ['Giữ chỗ', 'Reserved'],
  'unitinv.filter_sold': ['Đã bán', 'Sold'],
  'unitinv.filter_inactive': ['Ngừng giao dịch', 'Inactive'],
  'unitinv.filter_tower': ['Lọc theo tòa', 'Filter by tower'],
  'unitinv.filter_status': ['Lọc theo trạng thái', 'Filter by status'],
  'unitinv.tower': ['Tòa', 'Tower'],
  'unitinv.all_towers': ['Tất cả tòa', 'All towers'],
  'unitinv.tower_name': ['Tòa {name}', 'Tower {name}'],
  'unitinv.status': ['Trạng thái', 'Status'],
  'unitinv.tone_available': ['Còn hàng', 'Available'],
  'unitinv.tone_opening': ['Mở bán', 'Launching'],
  'unitinv.tone_booking': ['Booking', 'Booked'],
  'unitinv.tone_hold': ['Giữ chỗ', 'On hold'],
  'unitinv.tone_sold': ['Đã bán / cho thuê', 'Sold / rented'],
  'unitinv.tone_inactive': ['Ngừng giao dịch', 'Inactive'],
  'unitinv.no_project_title': ['Chưa có dự án', 'No projects yet'],
  'unitinv.no_project_body': ['Tạo dự án và thêm sản phẩm trong mục Dự án để xem tồn kho cấp căn.', 'Create a project and add units under Projects to see the unit inventory.'],
  'unitinv.empty_title': ['Dự án chưa có sản phẩm', 'This project has no units yet'],
  'unitinv.empty_body': ['Thêm căn trong Dự án → Danh mục sản phẩm (nhập Tòa và Tầng) để hiển thị sơ đồ tồn kho.', 'Add units under Projects → Product catalog (with tower and floor) to build the stacking plan.'],
  'unitinv.no_match_title': ['Không có căn phù hợp', 'No matching units'],
  'unitinv.no_match_body': ['Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.', 'Try removing a filter or changing the search.'],
  'unitinv.tower_summary': ['{total} căn · {available} còn hàng', '{total} units · {available} available'],
  'unitinv.floor_short': ['T{n}', 'F{n}'],
  'unitinv.unplaced_title': ['Căn chưa có tòa/tầng ({n})', 'Units without tower/floor ({n})'],
  'unitinv.unplaced_hint': ['Nhà phố, biệt thự, đất nền hoặc căn chưa nhập Tòa và Tầng. Bổ sung trong danh mục sản phẩm để xếp vào sơ đồ.', 'Townhouses, villas, land plots or units missing tower/floor. Fill them in the catalog to place them on the plan.'],
  'unitinv.detail_title': ['Chi tiết căn', 'Unit details'],
  'unitinv.detail_hint': ['Để đổi trạng thái hoặc giá, mở danh mục sản phẩm của dự án.', 'To change status or price, open the project catalog.'],
  'unitinv.price': ['Giá', 'Price'],
  'unitinv.floor': ['Tầng', 'Floor'],
  'unitinv.type': ['Loại', 'Type'],
  'unitinv.bedrooms': ['Phòng ngủ', 'Bedrooms'],
  'unitinv.area': ['Diện tích', 'Area'],
  'unitinv.clear_area': ['Diện tích thông thủy', 'Net area'],
  'unitinv.direction': ['Hướng', 'Direction'],
  'unitinv.view': ['Tầm nhìn', 'View'],
  'unitinv.bedrooms_short': ['{n}PN', '{n}BR'],
  'unitinv.million_per_sqm': ['triệu/m²', 'M VND/m²'],
};
const f = 'config/locales.ts';
let src = fs.readFileSync(f, 'utf8');
// menu label: sentence case
const enStart = src.search(/^\s*en\s*:\s*\{/m);
const menuRe = /^(\s*)"menu\.unit-inventory"\s*:\s*"(?:[^"\\]|\\.)*",?/gm;
const menu = [...src.matchAll(menuRe)].find(m => m.index < enStart);
if (menu) { src = src.slice(0, menu.index) + `${menu[1]}"menu.unit-inventory": "Tồn kho cấp căn",` + src.slice(menu.index + menu[0].length); report.push('OK   menu.unit-inventory VN'); }
else report.push('INFO menu.unit-inventory not found');
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
  report.push(`OK   ${f} (+${vnIns ? vnIns.split('\n').length : 0} VN / +${enIns ? enIns.split('\n').length : 0} EN)`);
}
console.log(report.join('\n'));
