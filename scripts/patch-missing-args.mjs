// patch-missing-args.mjs — get_valuation thiếu area: trả needs-info thay vì error (Rec 3/4)
import fs from "node:fs";
const F = "server/ai/minhBrain.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("needsInfo = true")) { console.log("SKIP already"); process.exit(0); }
const re = /(let error: string \| null = )missing\.length \? 'MINH_MISSING_ARGS: ' \+ missing\.join\(', '\) : null;(\s*\n\s*)if \(!error\) \{/;
if (!re.test(s)) { console.log("RE-MISS"); process.exit(1); }
const insert = [
  "null;",
  "  let needsInfo = false;",
  "  if (missing.length) {",
  "    // P-AUDIT: thiếu tham số không phải lỗi hệ thống — trả needs-info để Minh hỏi lại khách",
  "    needsInfo = true;",
  "    status = 'SUCCESS';",
  "    output = { needsInfo: true, missing, message: `Để xử lý chính xác, cho Minh biết thêm: ${missing.join(', ')}` } as any;",
  "  }",
  "  if (!error && !needsInfo) {",
].join("\n");
s = s.replace(re, (m, p1, p2) => p1 + insert.replace(/\n/g, "\n") + "\n" + p2.replace(/^\s*\n/, "\n"));
// đơn giản hơn: ghép thủ công
s = fs.readFileSync(F, "utf8");
s = s.replace(re, (m, p1, p2) => p1 + "null;\n" + "  let needsInfo = false;\n" + "  if (missing.length) {\n" + "    // P-AUDIT: thiếu tham số không phải lỗi hệ thống — trả needs-info để Minh hỏi lại khách\n" + "    needsInfo = true;\n" + "    status = 'SUCCESS';\n" + "    output = { needsInfo: true, missing, message: `Để xử lý chính xác, cho Minh biết thêm: ${missing.join(', ')}` } as any;\n" + "  }\n" + "  if (!error && !needsInfo) {" + p2.replace(/^\s*\n/, "\n"));
fs.copyFileSync(F, F + ".bak-margs");
fs.writeFileSync(F, s);
console.log("MISSING-ARGS-FIX-OK");
