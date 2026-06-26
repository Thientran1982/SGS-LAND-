# Chủ đầu tư (Developers) - Các bước thủ công còn lại

Tất cả file khác đã được tạo/chỉnh tự động qua Shell. Chỉ còn 2 việc dưới đây cần làm thủ công (để tránh rủi ro khi sửa file App.tsx 59KB qua terminal, và KHÔNG tự chạy migration trên Neon production).

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

## 2) Đăng ký migration 110 (server/migrations/runner.ts) + chạy trên Neon

(a) Thêm import (cạnh các import m105/m106, ~dòng 126):

    import m110 from './110_developers';

(b) Thêm entry vào MIGRATION_REGISTRY (cạnh '106_...': m106, ~dòng 246):

    '110_developers.ts': m110,

(c) Chạy migration (BẠN tự chạy - tôi KHÔNG tự chạy trên production):

    npm run migrate:dry   # xem trước, không đổi DB
    npm run migrate       # áp dụng m110 lên Neon

Lưu ý 107/108/109: 4 bảng (agent_prompt_versions, lead_journey_memory, tenant_prompt_overrides,
prompt_performance_log) đã tồn tại trên Neon (bạn xác nhận). Nếu muốn đăng ký 107-109 vào registry,
NÊN chèn version thủ công vào schema_versions (để runner coi như đã áp dụng, không chạy lại):

    INSERT INTO schema_versions (version) VALUES
      ('107_agent_prompt_versions.ts'),
      ('108_lead_journey_memory.ts'),
      ('109_n1_n2_tables.ts')
    ON CONFLICT (version) DO NOTHING;

## 3) Seed dữ liệu (tuỳ chọn)

Bảng developers là multi-tenant + RLS (tenant_id). Khi INSERT seed, phải set tenant context:

    SET app.current_tenant_id = '<tenant-uuid>';

hoặc dùng withRlsBypass trong migration seed (111_seed_developers.ts) giống pattern hiện có.
