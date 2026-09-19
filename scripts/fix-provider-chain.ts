// fix-provider-chain.ts — bật FULL multi-provider fallback: model nào hết token → tự chuyển
import { pool } from "../server/db";
const MAIN = "00000000-0000-0000-0000-000000000001";
// Bật TẤT CẢ provider có key: google (GEMINI_API_KEY ✓), anthropic (✓), openai (key có, 401 trước
// đây có thể do model mapping), openrouter (free tier ✓), xai (đã bật), bai (giữ, gateway sập)
const pf = {
  order: ["bai", "google", "anthropic", "openrouter", "xai", "openai"],
  enabled: {
    google: true,
    anthropic: true,
    xai: true,
    openai: true,
    openrouter: true,
    bai: true,
  },
};
const r = await pool.query(
  `INSERT INTO enterprise_config (tenant_id, config_key, config_value, updated_at)
   VALUES ($1, 'ai_config', jsonb_build_object('providerFallback', $2::jsonb), CURRENT_TIMESTAMP)
   ON CONFLICT (tenant_id, config_key) DO UPDATE
   SET config_value = COALESCE(enterprise_config.config_value, '{}'::jsonb)
       || jsonb_build_object('providerFallback', $2::jsonb),
       updated_at = CURRENT_TIMESTAMP
   RETURNING config_value->'providerFallback' AS pf`,
  [MAIN, JSON.stringify(pf)]
);
console.log("PF-UPDATED", JSON.stringify(r.rows[0]?.pf || {}).slice(0, 200));
// cache TTL 30s — provider chain mới áp dụng tự động sau 30p không cần restart
await pool.end();
process.exit(0);
