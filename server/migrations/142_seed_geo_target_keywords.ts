import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const KEYWORDS = [
  ['bất động sản TP.HCM', '/marketplace', 60500, 'Từ khóa chủ đạo'],
  ['bất động sản Đồng Nai', '/bat-dong-san-dong-nai', 27100, 'Long Thành, Nhơn Trạch, Biên Hòa'],
  ['bất động sản Long Thành', '/bat-dong-san-long-thanh', 18100, 'Khu vực sân bay Long Thành'],
  ['bất động sản Bình Dương', '/bat-dong-san-binh-duong', 22200, 'Khu công nghiệp và căn hộ chuyên gia'],
  ['bất động sản Thủ Đức', '/bat-dong-san-thu-duc', 14800, 'Metro số 1 và Thủ Thiêm'],
  ['định giá bất động sản', '/ai-valuation', 9900, 'Công cụ định giá AI'],
  ['sàn bất động sản uy tín', '/', 4400, 'Từ khóa thương hiệu'],
  ['giá nhà đất TP.HCM', '/marketplace', 12100, 'Theo dõi nhu cầu thị trường'],
  ['Aqua City Novaland', '/du-an/aqua-city', 18100, 'Dự án Đồng Nai'],
  ['Izumi City Nam Long', '/du-an/izumi-city', 8100, 'Dự án Biên Hòa'],
  ['Vinhomes Grand Park', '/du-an/vinhomes-grand-park', 27100, 'Dự án Thủ Đức'],
  ['Vinhomes Cần Giờ', '/du-an/vinhomes-can-gio', 49500, 'Dự án Cần Giờ'],
  ['Vinhomes Central Park', '/du-an/vinhomes-central-park', 22200, 'Dự án Bình Thạnh'],
  ['The Global City Masterise', '/du-an/the-global-city', 14800, 'Dự án An Phú'],
  ['Masterise Homes', '/du-an/masterise-homes', 9900, 'Bất động sản cao cấp'],
  ['Vạn Phúc City', '/du-an/van-phuc-city', 12100, 'Khu đô thị ven sông Sài Gòn'],
  ['Sala Đại Quang Minh', '/du-an/sala', 8100, 'Khu đô thị Sala'],
  ['Khu đô thị Thủ Thiêm', '/du-an/thu-thiem', 6600, 'Trung tâm tài chính'],
  ['Grand Manhattan Novaland', '/du-an/manhattan', 2900, 'Bất động sản trung tâm'],
  ['Sơn Kim Land', '/du-an/son-kim-land', 1900, 'Bất động sản thương mại cao cấp'],
] as const;

const migration: Migration = {
  description: 'Seed the initial GEO target keyword set without overwriting admin measurements',
  async up(client: PoolClient) {
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_seo_target_keywords_tenant_kw
        ON seo_target_keywords(tenant_id, lower(keyword))
    `);
    for (const [keyword, targetUrl, searchVolume, notes] of KEYWORDS) {
      await client.query(
        `INSERT INTO seo_target_keywords
          (tenant_id, keyword, target_url, target_position, search_volume, notes, ai_visibility)
         VALUES ($1, $2, $3, 3, $4, $5, '{}'::jsonb)
         ON CONFLICT (tenant_id, lower(keyword)) DO NOTHING`,
        [TENANT_ID, keyword, targetUrl, searchVolume, notes],
      );
    }
  },
  async down(client: PoolClient) {
    await client.query(
      `DELETE FROM seo_target_keywords
       WHERE tenant_id = $1 AND lower(keyword) = ANY($2::text[])`,
      [TENANT_ID, KEYWORDS.map(([keyword]) => keyword.toLowerCase())],
    );
  },
};

export default migration;