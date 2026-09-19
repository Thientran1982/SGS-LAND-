// seed-skill-bindings.ts v2 — 1 transaction, GUC đúng cho FORCE RLS của bindings
import { pool } from "../server/db";
const MAIN = "00000000-0000-0000-0000-000000000001";

const MAP: Record<string, string[]> = {
  BROKER_ENABLEMENT: ["broker-enablement"],
  COMPETITIVE_INTELLIGENCE: ["competitive-intelligence"],
  COMPLIANCE_GUARDIAN: ["compliance-guardian"],
  CONTENT_RADAR: ["content-radar"],
  LEAD_QUALIFICATION: ["lead-qualification"],
  MARKETING_ANALYST: ["marketing-analyst"],
  OUTREACH: ["outreach"],
  PRICING_INVENTORY_SYNC: ["pricing-inventory-sync"],
  PROJECT_PAGE: ["project-page"],
  REPURPOSING: ["repurposing"],
  REVENUE_SIGNAL: ["revenue-signal"],
  SEO_AEO_AUDITOR: ["seo-aeo-auditor"],
  VALUATION_QA: ["valuation-qa"],
  LANDING_DESIGN_AGENT: ["landing-design"],
  SALES_AGENT: ["revenue-signal", "lead-qualification"],
  MARKETING_AGENT: ["marketing-analyst", "seo-aeo-auditor", "competitive-intelligence"],
  LEGAL_AGENT: ["compliance-guardian"],
  INVENTORY_AGENT: ["pricing-inventory-sync"],
};

const client = await pool.connect();
try {
  await client.query("BEGIN");
  // FORCE RLS của agent_skill_bindings dùng app.current_tenant_id
  await client.query(`SET LOCAL app.current_tenant_id = '${MAIN}'`);
  let created = 0, existed = 0; const missing: string[] = [];
  for (const [agentName, skillKeys] of Object.entries(MAP)) {
    for (const skillKey of skillKeys) {
      const ins = await client.query(
        `INSERT INTO agent_skill_bindings (tenant_id, agent_id, skill_id, status)
         SELECT $1, a.id, s.id, 'ACTIVE'
         FROM ai_agents a, agent_skills s
         WHERE a.tenant_id=$1 AND a.name=$2 AND a.active=true
           AND s.tenant_id=$1 AND s.skill_key=$3 AND s.published=true
         ON CONFLICT (tenant_id, agent_id, skill_id) DO NOTHING
         RETURNING id`,
        [MAIN, agentName, skillKey]
      );
      if (ins.rows.length) created++;
      else {
        // phân biệt: đã tồn tại hay thiếu agent/skill
        const chk = await client.query(
          `SELECT
             (SELECT COUNT(*)::int FROM agent_skill_bindings b WHERE b.tenant_id=$1 AND b.agent_id=(SELECT id FROM ai_agents WHERE tenant_id=$1 AND name=$2) AND b.skill_id=(SELECT id FROM agent_skills WHERE tenant_id=$1 AND skill_key=$3 AND published=true)) AS existed,
             (SELECT COUNT(*)::int FROM ai_agents WHERE tenant_id=$1 AND name=$2) AS hasAgent,
             (SELECT COUNT(*)::int FROM agent_skills WHERE tenant_id=$1 AND skill_key=$3 AND published=true) AS hasSkill`,
          [MAIN, agentName, skillKey]
        );
        if (chk.rows[0].existed > 0) existed++;
        else missing.push(`${agentName}:${skillKey}(agent=${chk.rows[0].hasagent ?? chk.rows[0].hasAgent},skill=${chk.rows[0].hasskill ?? chk.rows[0].hasSkill})`);
      }
    }
  }
  await client.query("COMMIT");
  console.log("BINDINGS", JSON.stringify({ created, existed, missing }));
} catch (e: any) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.log("SEED-ERR", String(e?.message || e).slice(0, 160));
}
const total = await pool.query(`SELECT COUNT(*)::int c FROM agent_skill_bindings WHERE tenant_id=$1`, [MAIN]);
console.log("TOTAL-BINDINGS", total.rows[0].c);
await pool.end();
process.exit(0);
