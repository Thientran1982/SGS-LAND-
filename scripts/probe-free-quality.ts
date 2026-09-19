// probe-free-quality.ts — chọn model free OpenRouter tốt nhất cho tiếng Việt + JSON
const orKey = process.env.OPENROUTER_API_KEY || "";
const CANDIDATES = ["nex-agi/nex-n2.5-pro:free", "qwen/qwen3.8-27b:free", "nex-agi/nex-n2.5-mini:free"];
for (const model of CANDIDATES) {
  const t0 = Date.now();
  try {
    // Test 1: tiếng Việt ngắn
    const r1 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + orKey },
      body: JSON.stringify({ model, max_tokens: 120, temperature: 0, messages: [{ role: "user", content: "Trả lời 1 câu tiếng Việt: Chợ Long Thành nổi tiếng với đặc sản gì?" }] }),
      signal: AbortSignal.timeout(40000),
    });
    const d1: any = await r1.json().catch(() => ({}));
    const vi = String(d1?.choices?.[0]?.message?.content || "").slice(0, 110).replace(/\n/g, " ");
    console.log("VI", model, r1.status, "ms=" + (Date.now() - t0), JSON.stringify(vi));
    // Test 2: JSON compliance (giống nhánh S1 choice)
    const t1 = Date.now();
    const r2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + orKey },
      body: JSON.stringify({ model, max_tokens: 300, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: 'CHỈ trả JSON đúng shape {"answers":{"x":{"choice":"<label>","confidence":số,"probabilities":{...}}}}' }, { role: "user", content: 'STATE: Khách hỏi giá đất. QUESTIONS: {"x":{"type":"choice","criteria":{"VALUATION":"dinh gia","SEARCH":"tim kiem","GENERAL":"chung"}}}' }] }),
      signal: AbortSignal.timeout(40000),
    });
    const d2: any = await r2.json().catch(() => ({}));
    const raw2 = String(d2?.choices?.[0]?.message?.content || "");
    let parsed = false;
    try { const j = JSON.parse(raw2); parsed = !!j?.answers?.x?.choice; } catch {}
    console.log("JSON", model, r2.status, "ms=" + (Date.now() - t1), "parsed=" + parsed, JSON.stringify(raw2.slice(0, 90)));
  } catch (e: any) { console.log("ERR", model, String(e?.message || e).slice(0, 110)); }
}
console.log("QUALITY-DONE");
