import { pool } from "../server/db";
import { agentMemoryService } from "../server/services/agentMemoryService";
// 1. tìm tenant thật có sẵn trong agent_signals
const t = await pool.query("SELECT DISTINCT tenant_id FROM agent_signals LIMIT 3");
console.log("TENANTS", JSON.stringify(t.rows.map((x: any) => x.tenant_id)));
const tenantId = t.rows[0]?.tenant_id;
if (!tenantId) { console.log("NO-TENANT"); process.exit(1); }
// 2. ghi signal P4 qua đúng đường production (recordSignal)
await agentMemoryService.recordSignal(tenantId, {
  signalType: "minh_systemone_router",
  actorId: "MINH",
  subjectType: "chat_message",
  subjectId: "p234-recheck",
  dedupeKey: "minh-s1:p234-recheck:" + Date.now().toString(36),
  payload: { outcome: "ok", intent: "VALUATION", confidence: 0.95, ms: 123 },
  provenance: "minh_orchestrator",
}).catch((e: any) => console.log("RECORD-ERR", String(e?.message || e).slice(0, 150)));
// 3. đọc lại
const r = await pool.query(
  "SELECT signal_type, payload::jsonb->>'outcome' AS outcome, payload::jsonb->>'intent' AS intent, payload::jsonb->>'confidence' AS conf, payload::jsonb->>'ms' AS ms, created_at FROM agent_signals WHERE signal_type = 'minh_systemone_router' ORDER BY created_at DESC LIMIT 3"
);
console.log("SIGNAL-ROWS", r.rowCount);
for (const row of r.rows) console.log("SIG", JSON.stringify(row));
await pool.end();
process.exit(0);
