// patch-shift-wholesale.mjs — thay toàn bộ generateDailyShiftReport bằng bản có agent_runs
import fs from "node:fs";
const F = "server/repositories/agentOperatingRepository.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("agentRuns: runs.rows[0]")) { console.log("SKIP already"); process.exit(0); }
const i1 = s.indexOf("async generateDailyShiftReport");
const i2 = s.indexOf("async reviewShiftReport");
if (i1 === -1 || i2 === -1 || i2 <= i1) { console.log("MISS bounds i1=" + i1 + " i2=" + i2); process.exit(1); }
const NEW = `async generateDailyShiftReport(tenantId: string, reportDate: string, shift = 'ALL_DAY') {
    return withTenantContext(tenantId, async client => {
      const [events, questions, executions, runs] = await Promise.all([
        client.query(\`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='DONE')::int AS done, COUNT(*) FILTER (WHERE status IN ('FAILED','DEAD_LETTER'))::int AS failed FROM agent_operating_events WHERE tenant_id=\$1 AND created_at >= \$2::date AND created_at < \$2::date + INTERVAL '1 day'\`, [tenantId, reportDate]),
        client.query(\`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='ANSWERED')::int AS answered FROM agent_human_questions WHERE tenant_id=\$1 AND created_at >= \$2::date AND created_at < \$2::date + INTERVAL '1 day'\`, [tenantId, reportDate]),
        client.query(\`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='SUCCESS')::int AS success, COUNT(*) FILTER (WHERE status IN ('ERROR','BLOCKED'))::int AS failed FROM agent_executions WHERE tenant_id=\$1 AND created_at >= \$2::date AND created_at < \$2::date + INTERVAL '1 day'\`, [tenantId, reportDate]),
        client.query(\`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='success')::int AS success, COUNT(*) FILTER (WHERE status='error')::int AS failed FROM agent_runs WHERE tenant_id=\$1 AND created_at >= \$2::date AND created_at < \$2::date + INTERVAL '1 day'\`, [tenantId, reportDate]),
      ]);
      const metrics = { events: events.rows[0], humanQuestions: questions.rows[0], executions: executions.rows[0], agentRuns: runs.rows[0] };
      const summary = \`\${metrics.executions.success}/\${metrics.executions.total} runs thành công · \${metrics.events.done}/\${metrics.events.total} event hoàn tất · \${metrics.humanQuestions.answered}/\${metrics.humanQuestions.total} câu hỏi đã trả lời · \${metrics.agentRuns.success}/\${metrics.agentRuns.total} agent runs (P-AUDIT: nguồn thật)\`;
      const result = await client.query(
        \`INSERT INTO agent_shift_reports (tenant_id, report_date, shift, metrics_json, summary)
         VALUES (\$1,\$2,\$3,\$4::jsonb,\$5)
         ON CONFLICT (tenant_id, report_date, shift) DO UPDATE SET metrics_json=EXCLUDED.metrics_json, summary=EXCLUDED.summary, updated_at=NOW()
         RETURNING *\`, [tenantId, reportDate, shift, JSON.stringify(metrics), summary]);
      return result.rows[0];
    });
  }

  `;
s = s.slice(0, i1) + NEW + s.slice(i2);
fs.copyFileSync(F, F + ".bak-shiftW");
fs.writeFileSync(F, s);
console.log("WHOLESALE-OK");
