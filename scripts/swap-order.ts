import { pool } from "../server/db";
const pf = {
  order: ["openrouter", "google", "anthropic", "xai", "openai", "bai"],
  enabled: { openrouter: true, google: true, anthropic: true, xai: true, openai: true, bai: false },
};
const r = await pool.query(
  `UPDATE enterprise_config SET config_value = jsonb_set(config_value, '{providerFallback}', $1::jsonb), updated_at = CURRENT_TIMESTAMP WHERE tenant_id = '00000000-0000-0000-0000-000000000001' AND config_key = 'ai_config' RETURNING config_value->'providerFallback'->'order' AS ord`,
  [JSON.stringify(pf)]
);
console.log("ORDER", JSON.stringify(r.rows[0]?.ord));
await pool.end();
process.exit(0);
