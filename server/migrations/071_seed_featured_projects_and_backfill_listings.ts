import type { PoolClient } from 'pg';

/**
 * Migration 071 — Seed 11 dự án featured + backfill listings.project_id.
 *
 * Mục tiêu:
 *   • Bảng `projects` đang rỗng → kích hoạt được B2B2C cross-tenant share
 *     (project_access JOIN listings ON project_id) cần tối thiểu các project records.
 *   • 66 listings đều có project_id = NULL → khi partner đọc inventory, query
 *     `WHERE project_id = ANY(<accessible>)` luôn trả 0 dòng. Phải backfill
 *     project_id theo heuristic title/location.
 *
 * Nguồn 11 dự án (đồng bộ với PARTNERS hiển thị ở Landing trang chủ):
 *   1. Aqua City Novaland (Biên Hòa, Đồng Nai)
 *   2. The Global City Masterise (TP Thủ Đức)
 *   3. Izumi City Nam Long (Biên Hòa, Đồng Nai)
 *   4. Vinhomes Cần Giờ (TP.HCM)
 *   5. Vinhomes Grand Park (TP Thủ Đức)
 *   6. Masterise Homes ecosystem
 *   7. Grand Marina Saigon (Quận 1)
 *   8. Waterpoint Nam Long (Bến Lức, Long An)
 *   9. The Privia Khang Điền (Bình Tân)
 *  10. Vinhomes Central Park (Bình Thạnh)
 *  11. Sơn Kim Land
 *
 * Heuristic backfill (giữ tự động hoá có thể audit lại):
 *   - title hoặc location chứa "Aqua City"  || "Long Hưng"     → Aqua City Novaland
 *   - title hoặc location chứa "Vinhomes Central Park" || "Park 7" || "208 Nguyễn Hữu Cảnh" || "720 Nguyễn Hữu Cảnh"
 *                                                           → Vinhomes Central Park
 *   - title hoặc location chứa "Vinhomes Grand Park" || "Origami" || "S5"
 *                                                           → Vinhomes Grand Park
 *   - title hoặc location chứa "Vinhomes Cần Giờ"      → Vinhomes Cần Giờ
 *   - title hoặc location chứa "Izumi"                 → Izumi City Nam Long
 *   - title hoặc location chứa "The Global City"       → The Global City Masterise
 *   - title hoặc location chứa "Grand Marina"          → Grand Marina Saigon
 *   - title hoặc location chứa "Waterpoint"            → Waterpoint Nam Long
 *   - title hoặc location chứa "Privia"                → The Privia Khang Điền
 *   - title hoặc location chứa "Masteri" || "Lumière" || "Lumiere"  → Masterise Homes
 *   - các listings còn lại (Eco Retreat, La Villa Green, Long Thành đất nền…)
 *     KHÔNG thuộc 11 dự án phân phối nên giữ project_id = NULL — đúng logic.
 */

const HOST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

interface ProjectSeed {
  code: string;
  name: string;
  developer: string;
  location: string;
  scale: string;
  priceFrom: string;
  type: string;
  badge: string;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED';
  totalUnits?: number;
  slug: string;
  image?: string;
  matchKeywords: string[]; // các chuỗi (không phân biệt hoa/thường) để match listings
}

const FEATURED_PROJECTS: ProjectSeed[] = [
  {
    code: 'AQUA-CITY',
    name: 'Aqua City Novaland',
    developer: 'Novaland',
    location: 'Long Hưng, Biên Hòa, Đồng Nai',
    scale: '1.000 ha',
    priceFrom: 'Từ 6,5 tỷ',
    type: 'Đại Đô Thị Sinh Thái',
    badge: 'Đang bàn giao',
    status: 'ACTIVE',
    totalUnits: 5500,
    slug: 'aqua-city',
    image: '/images/projects/aqua-city.png',
    matchKeywords: ['aqua city', 'long hưng'],
  },
  {
    code: 'GLOBAL-CITY',
    name: 'The Global City',
    developer: 'Masterise Homes',
    location: 'An Phú, TP Thủ Đức',
    scale: '117 ha',
    priceFrom: 'Từ 15 tỷ',
    type: 'Đại Đô Thị Thương Mại',
    badge: 'Đang mở bán',
    status: 'ACTIVE',
    totalUnits: 2500,
    slug: 'the-global-city',
    image: '/images/projects/the-global-city.png',
    matchKeywords: ['the global city', 'global city', 'soho residence'],
  },
  {
    code: 'IZUMI-CITY',
    name: 'Izumi City Nam Long',
    developer: 'Nam Long Group',
    location: 'Long Hưng, Biên Hòa, Đồng Nai',
    scale: '170 ha',
    priceFrom: 'Từ 8,4 tỷ',
    type: 'Đô Thị Chuẩn Nhật',
    badge: 'Đang mở bán',
    status: 'ACTIVE',
    totalUnits: 3000,
    slug: 'izumi-city',
    image: '/images/projects/izumi-city.png',
    matchKeywords: ['izumi'],
  },
  {
    code: 'VINHOMES-CAN-GIO',
    name: 'Vinhomes Cần Giờ',
    developer: 'Vinhomes',
    location: 'Cần Giờ, TP.HCM',
    scale: '2.870 ha',
    priceFrom: 'Từ 12 tỷ',
    type: 'Siêu Đô Thị Lấn Biển',
    badge: 'Đang bán',
    status: 'ACTIVE',
    slug: 'vinhomes-can-gio',
    image: '/images/projects/vinhomes-can-gio.png',
    matchKeywords: ['vinhomes cần giờ', 'cần giờ', 'green paradise'],
  },
  {
    code: 'VINHOMES-GRAND-PARK',
    name: 'Vinhomes Grand Park',
    developer: 'Vinhomes',
    location: 'Long Bình, TP Thủ Đức, TP.HCM',
    scale: '271 ha',
    priceFrom: 'Từ 3 tỷ',
    type: 'Siêu Đô Thị Tích Hợp',
    badge: 'Đang bàn giao',
    status: 'ACTIVE',
    totalUnits: 44000,
    slug: 'vinhomes-grand-park',
    image: '/images/projects/vinhomes-grand-park.png',
    matchKeywords: ['vinhomes grand park', 'grand park', 'origami', 'rainbow', 's5.', 's6.', 's7.', 's8.', 's9.'],
  },
  {
    code: 'MASTERISE-HOMES',
    name: 'Masterise Homes',
    developer: 'Masterise Group',
    location: 'TP.HCM (Quận 1, Quận 2, Bình Thạnh)',
    scale: 'Hệ Sinh Thái Branded',
    priceFrom: 'Từ 7,5 tỷ',
    type: 'Branded Residence',
    badge: 'Đang bán',
    status: 'ACTIVE',
    slug: 'masterise-homes',
    image: '/images/projects/masterise-homes.png',
    matchKeywords: ['masterise', 'masteri', 'lumière', 'lumiere'],
  },
  {
    code: 'GRAND-MARINA-SAIGON',
    name: 'Grand Marina Saigon',
    developer: 'Masterise Homes',
    location: 'Bến Vân Đồn, Quận 1, TP.HCM',
    scale: '10 ha bến du thuyền',
    priceFrom: 'Từ 18 tỷ',
    type: 'Branded Residence Marriott',
    badge: 'Đang bàn giao',
    status: 'ACTIVE',
    slug: 'grand-marina-saigon',
    matchKeywords: ['grand marina', 'marriott residences saigon'],
  },
  {
    code: 'WATERPOINT',
    name: 'Waterpoint Nam Long',
    developer: 'Nam Long Group',
    location: 'Bến Lức, Long An',
    scale: '355 ha',
    priceFrom: 'Từ 5,5 tỷ',
    type: 'Đô Thị Vệ Tinh Ven Sông',
    badge: 'Đang mở bán',
    status: 'ACTIVE',
    totalUnits: 7000,
    slug: 'waterpoint',
    matchKeywords: ['waterpoint', 'water point'],
  },
  {
    code: 'PRIVIA',
    name: 'The Privia Khang Điền',
    developer: 'Khang Điền',
    location: 'An Lạc, Bình Tân, TP.HCM',
    scale: '1,8 ha',
    priceFrom: 'Từ 3,9 tỷ',
    type: 'Căn Hộ Cao Cấp',
    badge: 'Đang bàn giao',
    status: 'ACTIVE',
    totalUnits: 1043,
    slug: 'the-privia',
    matchKeywords: ['privia', 'the privia', 'khang điền'],
  },
  {
    code: 'VINHOMES-CENTRAL-PARK',
    name: 'Vinhomes Central Park',
    developer: 'Vinhomes',
    location: '208 Nguyễn Hữu Cảnh, Bình Thạnh, TP.HCM',
    scale: '43,9 ha',
    priceFrom: 'Từ 5 tỷ',
    type: 'Đô Thị Phức Hợp Ven Sông',
    badge: 'Đã bàn giao',
    status: 'ACTIVE',
    totalUnits: 10000,
    slug: 'vinhomes-central-park',
    matchKeywords: ['vinhomes central park', 'central park', 'park 7', '208 nguyễn hữu cảnh', '720 nguyễn hữu cảnh', 'landmark 81'],
  },
  {
    code: 'SON-KIM-LAND',
    name: 'Sơn Kim Land',
    developer: 'Sơn Kim Land',
    location: 'TP.HCM (Quận 2, Bình Thạnh)',
    scale: 'Hệ Sinh Thái Branded',
    priceFrom: 'Từ 8 tỷ',
    type: 'Branded Residence',
    badge: 'Đang bán',
    status: 'ACTIVE',
    slug: 'son-kim-land',
    matchKeywords: ['sơn kim', 'son kim', 'gateway thảo điền', 'serenity sky villas', 'metropole thủ thiêm'],
  },
];

export default {
  id: '071_seed_featured_projects_and_backfill_listings',
  description:
    'Seed 11 dự án phân phối + backfill listings.project_id để kích hoạt B2B2C share',
  async up(client: PoolClient): Promise<void> {
    // 1) Đảm bảo host tenant tồn tại
    const tenantCheck = await client.query(
      `SELECT 1 FROM tenants WHERE id = $1`,
      [HOST_TENANT_ID]
    );
    if (tenantCheck.rowCount === 0) {
      // Hard fail thay vì soft return — nếu return rỗng, runner sẽ ghi
      // schema_versions là "đã apply" và migration KHÔNG BAO GIỜ chạy lại.
      throw new Error(
        `[071_seed] Tenant host ${HOST_TENANT_ID} chưa tồn tại. ` +
          `Phải chạy migration seed tenant trước khi seed featured projects.`
      );
    }

    // 2) Upsert 11 projects (idempotent theo cặp tenant_id + code)
    const projectIdByCode = new Map<string, string>();
    for (const p of FEATURED_PROJECTS) {
      const existing = await client.query(
        `SELECT id FROM projects WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
        [HOST_TENANT_ID, p.code]
      );
      let id: string;
      if (existing.rowCount && existing.rows[0]) {
        id = existing.rows[0].id;
        await client.query(
          `UPDATE projects
              SET name = $1,
                  description = $2,
                  location = $3,
                  total_units = $4,
                  status = $5,
                  metadata = $6::jsonb,
                  updated_at = NOW()
            WHERE id = $7`,
          [
            p.name,
            `${p.type} · ${p.developer} · ${p.scale}. Giá ${p.priceFrom}.`,
            p.location,
            p.totalUnits ?? null,
            p.status,
            JSON.stringify({
              developer: p.developer,
              scale: p.scale,
              priceFrom: p.priceFrom,
              type: p.type,
              badge: p.badge,
              slug: p.slug,
              image: p.image ?? null,
              source: 'migration_071_featured_partners',
            }),
            id,
          ]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO projects (tenant_id, name, code, description, location, total_units, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
           RETURNING id`,
          [
            HOST_TENANT_ID,
            p.name,
            p.code,
            `${p.type} · ${p.developer} · ${p.scale}. Giá ${p.priceFrom}.`,
            p.location,
            p.totalUnits ?? null,
            p.status,
            JSON.stringify({
              developer: p.developer,
              scale: p.scale,
              priceFrom: p.priceFrom,
              type: p.type,
              badge: p.badge,
              slug: p.slug,
              image: p.image ?? null,
              source: 'migration_071_featured_partners',
            }),
          ]
        );
        id = inserted.rows[0].id;
      }
      projectIdByCode.set(p.code, id);
      console.log(`[071_seed] Upsert dự án: ${p.code.padEnd(22)} → ${id}`);
    }

    // 3) Backfill listings.project_id (chỉ cho host tenant, chỉ update khi NULL)
    let totalMatched = 0;
    const matchedByProject: Record<string, number> = {};
    for (const p of FEATURED_PROJECTS) {
      const projectId = projectIdByCode.get(p.code)!;
      // Build OR clause với LOWER(...) LIKE %keyword%
      const orParts: string[] = [];
      const params: any[] = [projectId, HOST_TENANT_ID];
      for (const kw of p.matchKeywords) {
        params.push(`%${kw.toLowerCase()}%`);
        const idx = params.length;
        orParts.push(`LOWER(title) LIKE $${idx} OR LOWER(COALESCE(location,'')) LIKE $${idx}`);
      }
      const whereExpr = orParts.join(' OR ');
      const sql = `
        UPDATE listings
           SET project_id = $1,
               project_code = $${params.length + 1},
               updated_at = NOW()
         WHERE tenant_id = $2
           AND project_id IS NULL
           AND (${whereExpr})
      `;
      params.push(p.code);
      const r = await client.query(sql, params);
      const updated = r.rowCount ?? 0;
      matchedByProject[p.code] = updated;
      totalMatched += updated;
      console.log(`[071_seed] Backfill ${p.code.padEnd(22)}: ${updated} listings`);
    }

    // 4) Báo cáo các listings còn NULL (không thuộc 11 dự án phân phối — đúng logic)
    const remaining = await client.query(
      `SELECT id, title, location FROM listings
        WHERE tenant_id = $1 AND project_id IS NULL`,
      [HOST_TENANT_ID]
    );
    console.log(
      `[071_seed] Tổng cộng backfill: ${totalMatched} listings. Còn ${remaining.rowCount} listings KHÔNG thuộc 11 dự án phân phối (giữ project_id = NULL):`
    );
    for (const row of remaining.rows.slice(0, 20)) {
      console.log(`           - ${row.title} | ${row.location}`);
    }
  },

  async down(client: PoolClient): Promise<void> {
    // True reverse: clear CẢ project_id và project_code (cả 2 đều do up() ghi)
    // — nếu chỉ clear project_id sẽ để lại project_code mồ côi, làm sai logic
    // các filter dùng project_code ở app layer.
    await client.query(
      `UPDATE listings
          SET project_id = NULL, project_code = NULL, updated_at = NOW()
        WHERE tenant_id = $1
          AND project_id IN (SELECT id FROM projects WHERE tenant_id = $1
            AND metadata->>'source' = 'migration_071_featured_partners')`,
      [HOST_TENANT_ID]
    );
    await client.query(
      `DELETE FROM projects
        WHERE tenant_id = $1
          AND metadata->>'source' = 'migration_071_featured_partners'`,
      [HOST_TENANT_ID]
    );
  },
};
