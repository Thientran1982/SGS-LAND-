import fs from "node:fs";
const F = "server/repositories/agentOperatingRepository.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("agentRuns: runs.rows[0]")) { console.log("SKIP already"); process.exit(0); }
let n = 0;
const j = (arr) => arr.join("\n");
// 1) destructure (xuống 2 dòng thật)
apply(j([
  "      const [events, questions, executions] =",
  "await Promise.all([",
]), j([
  "      const [events, questions, executions, runs] =",
  "await Promise.all([",
]), "destructure");
// 2) thêm query agent_runs sau query executions (dòng cuối của Promise.all)
apply(j([
  "FROM agent_executions WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $2::date + INTERVAL",
  "      '1 day'`, [tenantId, reportDate]);",
  "    ];",
]), j([
  "FROM agent_executions WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $2::date + INTERVAL",
  "      '1 day'`, [tenantId, reportDate]);",
  "      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='success')::int AS success, COUNT(*) FILTER (WHERE status='error')::int AS failed FROM agent_runs WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $2::date + INTERVAL '1 day'`, [tenantId, reportDate]);",
  "    ];",
]), "runs-query");
// 3) metrics + summary
apply(
  "const metrics = { events: events.rows[0], humanQuestions: questions.rows[0], executions: executions.rows[0] };",
  "const metrics = { events: events.rows[0], humanQuestions: questions.rows[0], executions: executions.rows[0], agentRuns: runs.rows[0] };",
  "metrics"
);
apply(
  "câu hỏi đã trả lời`;",
  "câu hỏi đã trả lời · ${metrics.agentRuns.success}/${metrics.agentRuns.total} agent runs`;",
  "summary"
);
function apply(oldStr, newStr, tag) {
  if (!s.includes(oldStr)) { console.log("MISS " + tag); process.exit(1); }
  s = s.split(oldStr).join(newStr);
  n++;
  console.log("OK " + tag);
}
fs.copyFileSync(F, F + ".bak-shift2");
fs.writeFileSync(F, s);
console.log("SHIFT2-OK changes=" + n);
