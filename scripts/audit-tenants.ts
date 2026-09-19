import { pool } from "../server/db";
const tenants = ["82f33046-8d56-43b1-a680-de4f3b1427b8","4f1c1068-bb3f-438d-aa7f-a0757d6a7eef","4c890613-c46a-4459-b8eb-75db42d9b22e","40efb245-8e38-4bd2-9eb4-fd68663f3033","00000000-0000-0000-0000-000000000001"];
for (const t of tenants) {
  try {
    const leads = await pool.query(`SELECT COUNT(*)::int c FROM leads WHERE tenant_id=$1`, [t]);
    const sig = await pool.query(`SELECT COUNT(*)::int c FROM agent_signals WHERE tenant_id=$1`, [t]);
    const runs = await pool.query(`SELECT COUNT(*)::int c FROM agent_runs WHERE tenant_id=$1 AND created_at > NOW() - INTERVAL '7 days'`, [t]).catch(() => ({ rows: [{ c: -1 }] }));
    const name = await pool.query(`SELECT name FROM tenants WHERE id=$1`, [t]).catch(() => ({ rows: [] }));
    console.log("TENANT", t.slice(0, 8), "name=" + (name.rows[0]?.name || "?"), "leads=" + leads.rows[0].c, "signals=" + sig.rows[0].c, "runs7d=" + runs.rows[0].c);
  } catch (e: any) { console.log("TENANT", t.slice(0, 8), "ERR", String(e?.message || e).slice(0, 60)); }
}
await pool.end();
process.exit(0);
