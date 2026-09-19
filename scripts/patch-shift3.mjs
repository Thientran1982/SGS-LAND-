import fs from "node:fs";
const F = "server/repositories/agentOperatingRepository.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("agentRuns: runs.rows[0]")) { console.log("SKIP already"); process.exit(0); }
let n = 0;
const sub = (re, repl, tag) => {
  if (!re.test(s)) { console.log("RE-MISS " + tag); process.exit(1); }
  s = s.replace(re, repl);
  n++;
  console.log("OK " + tag);
};
// 1) destructure — \s* chịu mọi khoảng trắng/xuống dòng
sub(/const \[events, questions, executions\](\s*)= (\s*)await Promise\.all\(\[/,
    "const [events, questions, executions, runs]$1= $2await Promise.all([",
    "destructure");
// 2) thêm query agent_runs: chèn trước `];` ngay sau query executions
sub(/(FROM agent_executions WHERE tenant_id=\$1 AND created_at >= \$2::date AND created_at < \$2::date \+ INTERVAL\s*'1 day'`,\s*\[tenantId, reportDate\]\);)(\s*\];)/,
    "$1\n      client.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='success')::int AS success, COUNT(*) FILTER (WHERE status='error')::int AS failed FROM agent_runs WHERE tenant_id=$1 AND created_at >= $2::date AND created_at < $2::date + INTERVAL '1 day'`, [tenantId, reportDate]),$2",
    "runs-query");
// 3) metrics
sub(/const metrics = \{ events: events\.rows\[0\], humanQuestions: questions\.rows\[0\], executions: executions\.rows\[0\] \};/,
    "const metrics = { events: events.rows[0], humanQuestions: questions.rows[0], executions: executions.rows[0], agentRuns: runs.rows[0] };",
    "metrics");
// 4) summary — thêm agent runs
sub(/(câu hỏi đã trả lời)`;/,
    "$1 · ${metrics.agentRuns.success}/${metrics.agentRuns.total} agent runs`;",
    "summary");
fs.copyFileSync(F, F + ".bak-shift3");
fs.writeFileSync(F, s);
console.log("SHIFT3-OK changes=" + n);
