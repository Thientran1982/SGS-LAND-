import { pool } from "../server/db";
const verify0 = await pool.query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'ai_learning_cycles_status_check'`);
console.log("BEFORE", JSON.stringify(verify0.rows[0]));
if (String(verify0.rows[0]?.def || "").includes("SKIPPED")) {
  console.log("ALREADY-HAS-SKIPPED");
} else {
  await pool.query(`ALTER TABLE ai_learning_cycles DROP CONSTRAINT ai_learning_cycles_status_check`);
  await pool.query(
    `ALTER TABLE ai_learning_cycles ADD CONSTRAINT ai_learning_cycles_status_check CHECK ((status = ANY (ARRAY['RUNNING'::text, 'PASSED'::text, 'FAILED'::text, 'ROLLED_BACK'::text, 'KILLED'::text, 'SKIPPED'::text])))`
  );
  console.log("CONSTRAINT-UPDATED");
}
const verify = await pool.query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'ai_learning_cycles_status_check'`);
console.log("AFTER", JSON.stringify(verify.rows[0]));
await pool.end();
process.exit(0);
