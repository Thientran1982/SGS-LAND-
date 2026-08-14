# Chủ đầu tư (Developers) - Các bước thủ công còn lại

Tất cả file khác đã được tạo/chỉnh tự động qua Shell. Chỉ còn 2 việc dưới đây cần làm thủ công (để tránh rủi ro khi sửa file App.tsx 59KB qua terminal, và KHÔNG tự chạy migration trên Aiven production).

## 1) App.tsx (3 chỗ)

(a) Thêm lazyLoad, cạnh dòng 68 (sau ProjectLandingPage):

    const DeveloperPage = lazyLoad(() => import('./pages/DeveloperPage'), 'DeveloperPage');

(b) Thêm vào route component map, cạnh dòng 258 ([ROUTES.DU_AN]: ProjectLandingPage):

    [ROUTES.CHU_DAU_TU]: DeveloperPage,

(c) Thêm vào Set PUBLIC_ROUTES, cạnh dòng 335 (ROUTES.DU_AN):

    ROUTES.CHU_DAU_TU,

Lưu ý: route /chu-dau-tu/:slug là prefix route (có slug động). DeveloperPage tự đọc slug từ
window.location.pathname.split('/')[1] giống ProjectLandingPage, nên chỉ cần map ROUTES.CHU_DAU_TU
là router prefix xử lý được cả trang danh sách và trang chi tiết.

## 2) Đăng ký migration 110 (server/migrations/runner.ts) + chạy trên Aiven

(a) Thêm import (cạnh các import m105/m106, ~dòng 126):

    import m110 from './110_developers';

(b) Thêm entry vào MIGRATION_REGISTRY (cạnh '106_...': m106, ~dòng 246):

    '110_developers.ts': m110,

(c) Chạy migration (BẠN tự chạy - tôi KHÔNG tự chạy trên production):

    npm run migrate:dry   # xem trước, không đổi DB
    npm run migrate       # áp dụng m110 lên Aiven

Lưu ý 107/108/109: 4 bảng (agent_prompt_versions, lead_journey_memory, tenant_prompt_overrides,
prompt_performance_log) đã tồn tại trên Aiven (bạn xác nhận). Nếu muốn đăng ký 107-109 vào registry,
NÊN chèn version thủ công vào schema_versions (để runner coi như đã áp dụng, không chạy lại):

    INSERT INTO schema_versions (version) VALUES
      ('107_agent_prompt_versions.ts'),
      ('108_lead_journey_memory.ts'),
      ('109_n1_n2_tables.ts')
    ON CONFLICT (version) DO NOTHING;


## 3) Đăng ký migration 111 (seed 8 chủ đầu tư) + chạy trên Aiven

File server/migrations/111_seed_developers.ts seed 8 chủ đầu tư BĐS lớn cho MỎI tenant:
novaland, vinhomes, khang-dien, hung-thinh, an-gia, phat-dat, sun-group, masterise-homes.
Mỗi bản ghi có đủ summary + description + faq[] + awards[] (citable cho AI engines, chuẩn GEO/AEO).
INSERT dùng ON CONFLICT (tenant_id, slug) DO NOTHING nên an toàn khi chạy lại (idempotent).

(a) Thêm import (cạnh import m110, ~dòng 127):

    import m111 from './111_seed_developers';

(b) Thêm entry vào MIGRATION_REGISTRY (ngay sau '110_developers.ts': m110):

    '111_seed_developers.ts': m111,

(c) Chạy migration (BẠN tự chạy - tôi KHÔNG tự chạy trên production):

    npm run migrate:dry   # xem trước 110 + 111, không đổi DB
    npm run migrate       # áp dụng m110 (tạo bảng) rồi m111 (seed) lên Aiven

Lưu ý thứ tự: m110 PHẢI chạy trước m111 (m110 tạo bảng developers, m111 seed vào đó).
Runner sắp xếp theo version nên chỉ cần đăng ký đúng cả hai trong registry.

RLS: seed chạy bằng owner connection của migration runner nên không bị RLS chặn.
Nếu seed thủ công bằng app connection thì phải SET app.current_tenant_id = '<tenant-uuid>' trước INSERT.
