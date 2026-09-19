// fix-noul-tolerant.mjs — validateAnswer noul chấp nhận {noul:"0.9"} / số trần (chống biến dạng model)
import fs from "node:fs";
const F = "server/lib/systemone.js";
let src = fs.readFileSync(F, "utf8");
if (src.includes("Tolerant: chấn nhận") || src.includes("Tolerant: chấp nhận")) { console.log("SKIP da tolerant"); process.exit(0); }
const oldNoul = 'if (q?.type === "noul") {\n    if (typeof a.noul !== "number" || !Number.isFinite(a.noul) || a.noul < 0 || a.noul > 1)\n      throw new Error(`SystemOne local: đáp ${name} noul phải là số 0..1`);\n    return a;\n  }';
const newNoul = 'if (q?.type === "noul") {\n    // Tolerant: chấp nhận {noul: 0.9} · {noul: "0.9"} · 0.9 (số trần) — model hay lệch nhẹ shape\n    let v = (typeof a === "number") ? a : (a ?? {}).noul;\n    if (typeof v === "string" && v.trim() !== "") v = Number(v);\n    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1)\n      throw new Error(`SystemOne local: đáp ${name} noul phải là số 0..1`);\n    return { noul: v };\n  }';
if (!src.includes(oldNoul)) { console.log("FAIL: khong tim thay khoi noul goc"); process.exit(1); }
src = src.split(oldNoul).join(newNoul);
fs.copyFileSync(F, F + ".bak-noul");
fs.writeFileSync(F, src);
console.log("NOUL-TOLERANT-OK (backup .bak-noul)");
