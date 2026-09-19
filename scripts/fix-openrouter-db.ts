// fix-openrouter-db.ts — đồng bộ enterprise_config: bật openrouter trong providerFallback (nếu có override)
import { pool } from "../server/db";
const before = await pool.query(
  "SELECT tenant_id, config_value->'providerFallback'->'enabled' AS enabled FROM enterprise_config WHERE config_key='ai_config'"
);
console.log("BEFORE", JSON.stringify(before.rows));
const upd = await pool.query(
  "UPDATE enterprise_config SET config_value = jsonb_set(config_value, '{providerFallback,enabled,openrouter}', 'true'::jsonb, true), updated_at = CURRENT_TIMESTAMP WHERE config_key='ai_config' AND (config_value->'providerFallback'->'enabled'->>'openrouter') = 'false' RETURNING tenant_id"
);
console.log("UPDATED-ROWS", upd.rowCount, JSON.stringify(upd.rows.map((r: any) => r.tenant_id)));
const rows = await pool.query("SELECT tenant_id, config_value FROM enterprise_config WHERE config_key='ai_config'");
for (const row of rows.rows) {
  const pf = row.config_value?.providerFallback;
  if (pf?.order && Array.isArray(pf.order) && !pf.order.includes("openrouter")) {
    const newOrder = [...pf.order, "openrouter"];
    await pool.query(
      "UPDATE enterprise_config SET config_value = jsonb_set(config_value, '{providerFallback,order}', $1::jsonb), updated_at = CURRENT_TIMESTAMP WHERE tenant_id=$2 AND config_key='ai_config'",
      [JSON.stringify(newOrder), row.tenant_id]
    );
    console.log("ORDER-ADD", row.tenant_id);
  }
}
await pool.end();
process.exit(0);
