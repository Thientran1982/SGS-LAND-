import { pool } from "../server/db";
const t = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename ~ 'chat|message|interact|convers|live') ORDER BY tablename`);
console.log("TABLES", t.rows.map((r: any) => r.tablename).join(", "));
for (const r of t.rows) {
  const n = r.tablename;
  try {
    const c = await pool.query(`SELECT COUNT(*)::int c FROM "${n}"`);
    const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND table_schema='public'`, [n]);
    const cn = cols.rows.map((x: any) => x.column_name);
    const tc = ["created_at", "timestamp", "ts", "sent_at"].find((x) => cn.includes(x));
    let last = "-";
    if (tc) {
      const l = await pool.query(`SELECT MAX("${tc}")::text m FROM "${n}"`);
      last = String(l.rows[0].m || "-").slice(0, 16);
    }
    console.log("T", n, c.rows[0].c, "last:", last, "| cols:", cn.slice(0, 12).join(","));
  } catch (e: any) { console.log("T", n, "ERR", String(e?.message || e).slice(0, 50)); }
}
await pool.end();
process.exit(0);
