// patch-lc-wire.mjs — Rec3: auto-enroll lead vào follow-up khi handle_capture_lead chạy
import fs from "node:fs";
const F = "server/ai/liveChatEngine.ts";
let s = fs.readFileSync(F, "utf8");
if (s.includes("followupSequenceRepository")) { console.log("ALREADY-WIRED"); process.exit(0); }
const marker = s.indexOf("Captured via widget");
if (marker === -1) { console.log("MARKER-MISS"); process.exit(1); }
const createPos = s.lastIndexOf("const lead = await leadRepository.create(", marker);
if (createPos === -1) { console.log("CREATE-MISS"); process.exit(1); }
const closePos = s.indexOf("});", createPos);
if (closePos === -1) { console.log("CLOSE-MISS"); process.exit(1); }
const insertAt = closePos + 3;
const snippet = `
    // P-AUDIT Rec3: tu dong ghi danh lead moi vao follow-up D+1/3/5/7 (idempotent, fail-safe)
    try {
      const { followupSequenceRepository } = await import('../repositories/followupSequenceRepository');
      const { pool: fupPool } = await import('../db');
      const existedSeq = await (followupSequenceRepository as any).getActiveSequenceForLead(fupPool, tenantId, lead.id);
      if (!existedSeq) {
        await (followupSequenceRepository as any).createSequence(fupPool, tenantId, {
          leadId: lead.id,
          leadName: lead.name || null,
          leadPhone: lead.phone || null,
          leadEmail: (lead as any).email || null,
          leadZaloId: null,
          source: 'LIVE_CHAT',
        });
        logger.info('[FollowUp] auto-enrolled lead=' + lead.id);
      }
    } catch (enrollErr: any) {
      logger.warn('[FollowUp] auto-enroll skipped: ' + (enrollErr?.message || enrollErr));
    }`;
s = s.slice(0, insertAt) + snippet + s.slice(insertAt);
fs.copyFileSync(F, F + ".bak-rec3");
fs.writeFileSync(F, s);
console.log("WIRED-OK insertAt=" + insertAt);
