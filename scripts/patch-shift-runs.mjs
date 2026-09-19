// patch-shift-runs.mjs — shift report aggregate thêm agent_runs (nguồn thật 48k runs)
import fs from "node:fs";
const F = "server/repositories/agentOperatingRepository.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("agentRuns: runs.rows[0]")) { console.log("SKIP already"); process.exit(0); }
let n = 0;
// 1) thêm runs vào destructuring
const o1 = "const [events, questions, executions] = await Promise.all([";
const n1 = "const [events, questions, executions, runs] = await Promise.all([";
if (!s.includes(o1)) { console.log("MISS destructure anchor"); process.exit(1); }
s = s.replace(o1, n1); n++;
// 2) thêm query agent_runs vào Promise.all — chèn trước `]);` kết thúc khối
const o2 = "'1 day'`, [tenantId, reportDate]),\n    ]);";
const n2 = "'1 day'`, [tenantId, reportDate]),\n      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='success')::int AS success, COUNT(*) FILTER (WHERE status='error')::int AS failed FROM agent_runs WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $2::date + INTERVAL '1 day'`, [tenantId, reportDate]),\n    ]);";
if (!s.includes(o2)) { console.log("MISS query-end anchor"); process.exit(1); }
s = s.replace(o2, n2); n++;
// 3) metrics thêm agentRuns
const o3 = "const metrics = { events: events.rows[0], humanQuestions: questions.rows[0], executions: executions.rows[0] };";
const n3 = "const metrics = { events: events.rows[0], humanQuestions: questions.rows[0], executions: executions.rows[0], agentRuns: runs.rows[0] };";
if (!s.includes(o3)) { console.log("MISS metrics anchor"); process.exit(1); }
s = s.replace(o3, n3); n++;
// 4) summary bổ sung agent runs
const o4 = "const summary = `${metrics.executions.success}/${metrics.executions.total} runs thành công · ${metrics.events.done}/${metrics.events.total} events hoàn tất · ${metrics.humanQuestions.answered}/${metrics.humanQuestions.total} câu hỏi đã trả lời`;";
const n4 = "const summary = `${metrics.executions.success}/${metrics.executions.total} runs thành công · ${metrics.events.done}/${metrics.events.total} events hoàn tất · ${metrics.humanQuestions.answered}/${metrics.humanQuestions.total} câu hỏi đã trả lời · ${metrics.agentRuns.success}/${metrics.agentRuns.total} agent runs (P-AUDIT: nguồn thật)`;";
if (!s.includes(o4)) { console.log("MISS summary anchor"); process.exit(1); }
s = s.replace(o4, n4); n++;
fs.copyFileSync(F, F + ".bak-shift");
fs.writeFileSync(F, s);
console.log("SHIFT-RUNS-OK changes=" + n);
