
import { withTenantContext, pool } from '../db';
const TID = '00000000-0000-0000-0000-000000000001';
(async () => {
  const t = await withTenantContext(TID, async (client: any) =>
    (await client.query('SELECT id::text, title, due_date::text FROM tasks ORDER BY created_at DESC LIMIT 3')).rows);
  console.log('ROWS:', JSON.stringify(t, null, 1));
  await pool.end();
})();
