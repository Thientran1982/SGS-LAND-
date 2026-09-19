// audit-agents.ts — audit sâu hệ agents: bảng, hoạt động, sự kiện, dead-letter, tự động hoá
import { pool } from "../server/db";

const like = `('agent%','%agent%','%task%','%memory%','%lesson%','%signal%','%workflow%','%approval%','%learning%','%kpi%','%dead%','%queue%','%role%','%campaign%','%sequence%','%skill%','%operating%','%minh%')`;

// 1. Danh mục bảng liên quan
const tbls = await pool.query(
  `SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename ~ 'agent|task|memory|lesson|signal|workflow|approval|learning|kpi|dead|queue|role|campaign|sequence|skill|operating|minh') ORDER BY tablename`
);
console.log("== TABLES ==");
console.log(tbls.rows.map((r: any) => r.tablename).join(", "));

// 2. Đếm + hoạt động gần đây cho từng bảng (tự nhận diện cột thời gian)
const names = tbls.rows.map((r: any) => r.tablename).filter((n: string) =>
  !/(_logs|backup|temp|session)/.test(n)
);
console.log("== COUNTS & ACTIVITY ==");
for (const n of names) {
  try {
    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 AND table_schema='public'`,
      [n]
    );
    const colNames = cols.rows.map((c: any) => c.column_name);
    const timeCol = ["created_at", "timestamp", "ts", "updated_at", "started_at", "created"].find((c) => colNames.includes(c));
    const cnt = await pool.query(`SELECT COUNT(*)::int AS c FROM "${n}"`);
    let recent = "-";
    if (timeCol) {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS c, MAX("${timeCol}")::text AS last FROM "${n}" WHERE "${timeCol}" > NOW() - INTERVAL '7 days'`
      );
      recent = `${r.rows[0].c} trong 7d · last ${String(r.rows[0].last || "-").slice(0, 16)}`;
    }
    console.log(`TBL ${n}: ${cnt.rows[0].c} rows · ${recent}`);
  } catch (e: any) { console.log(`TBL ${n}: ERR ${String(e?.message || e).slice(0, 60)}`); }
}

// 3. Dead-letter / sự kiện kẹt
try {
  const dl = await pool.query(
    `SELECT status, COUNT(*)::int AS c FROM agent_operating_events GROUP BY status ORDER BY c DESC`
  );
  console.log("== EVENT-STATUS ==");
  for (const r of dl.rows) console.log(`EVT ${r.status}: ${r.c}`);
  const dead = await pool.query(
    `SELECT event_type, COUNT(*)::int AS c, MAX(created_at)::text AS last FROM agent_operating_events WHERE status IN ('dead_letter','DEAD_LETTER','failed','error') GROUP BY event_type ORDER BY c DESC LIMIT 8`
  );
  for (const r of dead.rows) console.log(`DEAD ${r.event_type}: ${r.c} · last ${String(r.last).slice(0, 16)}`);
} catch (e: any) { console.log("EVT-ERR", String(e?.message || e).slice(0, 80)); }

// 4. Agent runs gần đây theo tool/intent
try {
  const runs = await pool.query(
    `SELECT tool, status, COUNT(*)::int AS c FROM agent_runs WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY tool, status ORDER BY c DESC LIMIT 12`
  );
  console.log("== RUNS 14D ==");
  for (const r of runs.rows) console.log(`RUN ${r.tool} ${r.status}: ${r.c}`);
} catch (e: any) { console.log("RUNS-ERR", String(e?.message || e).slice(0, 80)); }

await pool.end();
process.exit(0);
