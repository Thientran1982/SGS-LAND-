// patch-outbox-leak.mjs — ① chặn leak lỗi nội bộ + escalation có ngữ cảnh
import fs from "node:fs";
const F = "server/repositories/liveChatReplyOutboxRepository.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("P-AUDIT #A1")) { console.log("SKIP already"); process.exit(0); }
const o1 = "    const content = 'Minh chưa thể hoàn tất phản hồi lúc này. Tin nhắn của bạn đã được ghi nhận.';";
const n1 = "    // P-AUDIT #A1: khong lo thong bao loi noi bo cho khach — thong diep an toan + huong dan\n    const content = 'Xin lỗi anh/chị, Minh đang xử lý nên chưa trả lời được ngay. Yêu cầu của anh/chị đã được ghi nhận và Minh sẽ ưu tiên phản hồi trong ít phút. Trường hợp cần hỗ trợ ngay, anh/chị vui lòng để lại số điện thoại hoặc gọi hotline 1900999 nhé.';";
if (!s.includes(o1)) { console.log("MISS content anchor"); process.exit(1); }
s = s.replace(o1, n1);
// escalation có ngữ cảnh: chèn trước câu UPDATE outbox
const iContent = s.indexOf(n1);
const iFail = s.indexOf("const failed = await client.query(", iContent);
if (iFail === -1) { console.log("MISS failed anchor"); process.exit(1); }
const lineStart = s.lastIndexOf("\n", iFail) + 1;
const esc = [
  "    // P-AUDIT #A1b: escalation co ngu canh — nguoi xem biet khach hoi gi va loi gi",
  "    try {",
  "      const inb = await client.query(`SELECT LEFT(content, 400) AS c FROM interactions WHERE id = ${'$'}{params.inboundInteractionId}`);",
  "      const custQ = inb.rows[0]?.c || '(không đọc được tin nhắn khách)';",
  "      await client.query(",
  "        `INSERT INTO agent_human_questions (tenant_id, agent_key, question, lead_id, priority, context_json)",
  "         VALUES (${'$'}1, 'MINH', ${'$'}2, ${'$'}3, 80, ${'$'}4::jsonb)`,",
  "        [params.tenantId,",
  "         `Lỗi hệ thống khi trả lời khách — cần người xử lý thay. Câu hỏi của khách: ${custQ}. Mã lỗi: ${safeCode}`,",
  "         params.leadId,",
  "         JSON.stringify({ error: safeError, inboundInteractionId: params.inboundInteractionId })]",
  "      );",
  "    } catch { /* escalation optional */ }",
].join("\n") + "\n";
s = s.slice(0, lineStart) + esc + s.slice(lineStart);
fs.copyFileSync(F, F + ".bak-a1");
fs.writeFileSync(F, s);
console.log("LEAK-FIX-OK");
