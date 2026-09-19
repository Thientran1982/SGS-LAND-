import fs from "node:fs";
const F = "server/ai/liveChatEngine.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("price_followup_needed")) { console.log("SKIP already"); process.exit(0); }
const re = /(if \(clarification\) \{\s*\n)(\s*liveChatTimings\.classifyMs)/;
if (!re.test(s)) { console.log("RE-MISS"); process.exit(1); }
const block = [
  "  // P-AUDIT #A2: khách hỏi giá là nhu cầu mua thật — track để pipeline giá phản hồi sau,",
  "  // đồng thời là đầu vào cho việc nối tool thị trường vào nhánh clarify (price-first).",
  "  try {",
  "    void (async () => {",
  "      const { agentMemoryService } = await import('../services/agentMemoryService');",
  "      await agentMemoryService.recordSignal(tenantId, {",
  "        signalType: 'price_followup_needed',",
  "        actorId: 'MINH',",
  "        subjectType: 'chat_message',",
  "        subjectId: String(msg).slice(0, 120),",
  "        dedupeKey: `price-fup:${sessionId || 'no-sess'}:${Date.now().toString(36)}`,",
  "        payload: { message: String(msg).slice(0, 200), language: clarificationLanguage },",
  "        provenance: 'live_chat_engine',",
  "      }).catch(() => undefined);",
  "    })().catch(() => undefined);",
  "  } catch { /* optional */ }",
].join("\n");
s = s.replace(re, (m, p1, p2) => p1 + block + "\n" + p2);
fs.writeFileSync(F, s);
console.log("PRICE-SIGNAL2-OK");
