// patch-price-signal.mjs — ② track nhu cầu giá tại nhánh CLARIFY (feed pipeline giá sau này)
import fs from "node:fs";
const F = "server/ai/liveChatEngine.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("price_followup_needed")) { console.log("SKIP already"); process.exit(0); }
const o = [
  "if (clarification) {",
  "liveChatTimings.classifyMs = Date.now() - liveChatStartedAt;",
].join("\n");
const n = [
  "if (clarification) {",
  "  // P-AUDIT #A2: khách hỏi giá là nhu cầu mua thật — track lại để pipeline giá phản hồi sau,",
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
  "liveChatTimings.classifyMs = Date.now() - liveChatStartedAt;",
].join("\n");
if (!s.includes(o)) { console.log("MISS anchor"); process.exit(1); }
s = s.replace(o, n);
fs.copyFileSync(F, F + ".bak-a2");
fs.writeFileSync(F, s);
console.log("PRICE-SIGNAL-OK");
