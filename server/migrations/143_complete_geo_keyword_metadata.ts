import type { Migration } from './runner';
import type { PoolClient } from 'pg';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const VOLUMES: Record<string, number> = {
  'bất động sản tp.hcm': 60500,
  'bất động sản đồng nai': 27100,
  'bất động sản long thành': 18100,
  'bất động sản bình dương': 22200,
  'bất động sản thủ đức': 14800,
  'định giá bất động sản': 9900,
  'sàn bất động sản uy tín': 4400,
  'giá nhà đất tp.hcm': 12100,
  'aqua city novaland': 18100,
  'izumi city nam long': 8100,
  'vinhomes grand park': 27100,
  'vinhomes cần giờ': 49500,
  'vinhomes central park': 22200,
  'the global city masterise': 14800,
  'masterise homes': 9900,
  'vạn phúc city': 12100,
  'sala đại quang minh': 8100,
  'khu đô thị thủ thiêm': 6600,
  'grand manhattan novaland': 2900,
  'sơn kim land': 1900,
};

const migration: Migration = {
  description: 'Complete metadata for the seeded GEO keyword set',
  async up(client: PoolClient) {
    for (const [keyword, volume] of Object.entries(VOLUMES)) {
      await client.query(
        `UPDATE seo_target_keywords
            SET search_volume = COALESCE(search_volume, $1),
                updated_at = NOW()
          WHERE tenant_id = $2 AND lower(keyword) = $3`,
        [volume, TENANT_ID, keyword],
      );
    }
  },
};

export default migration;