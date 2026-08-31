/**
 * agentVoiceTeachRoutes.ts — P2 #11 + #12.
 * #11 Voice: log cuoc goi Agent Minh (dial/active/ended) + transcript + lich su.
 * #12 Teach: tai ban ghi quy trinh ban hang -> Gemini trich buoc -> promote thanh skill.
 */
import { Router, type Request, type Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { pool } from '../db';
import { logger } from '../middleware/logger';
import { apiRateLimit } from '../middleware/rateLimiter';

export const agentVoiceRouter = Router();
export const agentTeachRouter = Router();

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

function gemini(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error('API key not valid. Please pass a valid API key.');
  return new GoogleGenAI({ apiKey });
}

// ===== #11 VOICE CALL =====
agentVoiceRouter.get('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = String((req as any).user?.tenantId || DEFAULT_TENANT);
    const r = await pool.query(
      "SELECT v.id, v.phone, v.direction, v.status, v.duration_sec, v.started_at, v.ended_at, l.name AS lead_name" +
      " FROM agent_voice_calls v LEFT JOIN leads l ON l.id = v.lead_id" +
      " WHERE v.tenant_id = $1 ORDER BY v.started_at DESC LIMIT 50",
      [tenantId],
    );
    res.json({ calls: r.rows });
  } catch (err: any) {
    logger.warn('[Voice] list failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Khong tai duoc lich su cuoc goi' });
  }
});

agentVoiceRouter.post('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = String((req as any).user?.tenantId || DEFAULT_TENANT);
    const { lead_id, phone, direction, status, duration_sec, transcript_json, recording_url } = req.body || {};
    if (!phone || !/^[0-9+\s.-]{6,20}$/.test(String(phone))) {
      return res.status(400).json({ error: 'So dien thoai khong hop le' });
    }
    const r = await pool.query(
      "INSERT INTO agent_voice_calls (tenant_id, lead_id, phone, direction, status, duration_sec, transcript_json, recording_url) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id, phone, status, started_at",
      [tenantId, lead_id || null, String(phone).slice(0, 20),
       direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
       ['DIALING','ACTIVE','ENDED','FAILED','MISSED'].includes(String(status)) ? String(status) : 'DIALING',
       Math.max(0, Math.min(7200, Number(duration_sec) || 0)) || null,
       transcript_json ? JSON.stringify(transcript_json).slice(0, 100000) : null,
       recording_url ? String(recording_url).slice(0, 500) : null],
    );
    res.status(201).json({ call: r.rows[0] });
  } catch (err: any) {
    logger.warn('[Voice] log failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Ghi cuoc goi that bai' });
  }
});

agentVoiceRouter.patch('/:id', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const { status, duration_sec, transcript_json } = req.body || {};
    const r = await pool.query(
      "UPDATE agent_voice_calls SET status = COALESCE($2, status), duration_sec = COALESCE($3, duration_sec), transcript_json = COALESCE($4::jsonb, transcript_json), ended_at = CASE WHEN $2::text IN ('ENDED','FAILED','MISSED') THEN NOW() ELSE ended_at END WHERE id = $1 RETURNING id, status, duration_sec",
      [req.params.id,
       ['DIALING','ACTIVE','ENDED','FAILED','MISSED'].includes(String(status)) ? String(status) : null,
       Math.max(0, Math.min(7200, Number(duration_sec) || 0)) || null,
       transcript_json ? JSON.stringify(transcript_json).slice(0, 100000) : null],
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Cuoc goi khong ton tai' });
    res.json({ call: r.rows[0] });
  } catch (err: any) {
    logger.warn('[Voice] patch failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Cap nhat cuoc goi that bai' });
  }
});

// ===== #12 TEACH BY DEMONSTRATION =====
agentTeachRouter.get('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = String((req as any).user?.tenantId || DEFAULT_TENANT);
    const r = await pool.query(
      "SELECT id, title, scenario, status, derived_skill_id, created_at FROM agent_teach_recordings WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50",
      [tenantId],
    );
    res.json({ recordings: r.rows });
  } catch (err: any) {
    logger.warn('[Teach] list failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Khong tai duoc ban ghi' });
  }
});

agentTeachRouter.post('/', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = String(user?.tenantId || DEFAULT_TENANT);
    const { title, scenario, transcript, media_url } = req.body || {};
    if (!title || !transcript) {
      return res.status(400).json({ error: 'title va transcript la bat buoc' });
    }
    const r = await pool.query(
      "INSERT INTO agent_teach_recordings (tenant_id, title, scenario, media_url, transcript, recorded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, title, status, created_at",
      [tenantId, String(title).slice(0, 200), scenario ? String(scenario).slice(0, 500) : null,
       media_url ? String(media_url).slice(0, 500) : null,
       String(transcript).slice(0, 60000), user?.id || null],
    );
    res.status(201).json({ recording: r.rows[0] });
  } catch (err: any) {
    logger.warn('[Teach] create failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Tai ban ghi that bai' });
  }
});

// POST /:id/extract — Gemini trich cac buoc ban hang tu transcript
agentTeachRouter.post('/:id/extract', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const tenantId = String((req as any).user?.tenantId || DEFAULT_TENANT);
    const rec = await pool.query(
      "SELECT id, title, transcript FROM agent_teach_recordings WHERE tenant_id = $1 AND id = $2",
      [tenantId, req.params.id],
    );
    if (rec.rowCount === 0) return res.status(404).json({ error: 'Ban ghi khong ton tai' });
    const transcript = String(rec.rows[0].transcript || '');
    if (!transcript.trim()) return res.status(422).json({ error: 'Ban ghi chua co transcript' });

    const ai = gemini();
    const result = await ai.models.generateContent({
      model: String(process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.5-flash'),
      contents: "Tu transcript quy trinh ban hang duoi day, trich xuat CAC BUOC thao tac (moi buoc 1 dong, duyet theo thu tu thuc hien). Chi xuat danh sach buoc, khong binh luan:\n\n" + transcript.slice(0, 30000),
    });
    const raw = (result.text || '').trim();
    const steps = raw.split("\n").map((s: string) => s.replace(/^\s*[-*\d.]+\s*/, "").trim()).filter(Boolean).slice(0, 30);

    await pool.query(
      "UPDATE agent_teach_recordings SET extracted_steps = $2::jsonb, status = 'EXTRACTED' WHERE id = $1",
      [req.params.id, JSON.stringify({ steps })],
    );
    res.json({ steps });
  } catch (err: any) {
    logger.warn('[Teach] extract failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Trich buoc that bai: ' + String(err?.message || err).slice(0, 150) });
  }
});

// POST /:id/promote — bien ban ghi thanh skill trong catalog
agentTeachRouter.post('/:id/promote', apiRateLimit, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = String(user?.tenantId || DEFAULT_TENANT);
    const rec = await pool.query(
      "SELECT id, title, scenario, transcript, extracted_steps FROM agent_teach_recordings WHERE tenant_id = $1 AND id = $2",
      [tenantId, req.params.id],
    );
    if (rec.rowCount === 0) return res.status(404).json({ error: 'Ban ghi khong ton tai' });
    const row = rec.rows[0];
    if (!row.extracted_steps) return res.status(422).json({ error: 'Can trich buoc truoc khi bien thanh skill' });

    const skillKey = 'taught-' + String(req.params.id).slice(0, 8);
    const prompt = 'Quy trinh: ' + String(row.title) + "\n\n" +
      'Cac buoc:\n' + ((row.extracted_steps as any).steps || []).map((s: string, i: number) => (i + 1) + '. ' + s).join("\n") +
      "\n\nTrans tham khao:\n" + String(row.transcript || '').slice(0, 8000);

    const skill = await pool.query(
      "INSERT INTO agent_skills (tenant_id, skill_key, title, description, category, prompt_template, author_id, author_name, visibility, published) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'TENANT',TRUE) ON CONFLICT (tenant_id, skill_key) DO UPDATE SET prompt_template = EXCLUDED.prompt_template, version = agent_skills.version + 1, updated_at = NOW() RETURNING id, skill_key, title, version",
      [tenantId, skillKey, String(row.title).slice(0, 120),
       'Skill tu ban ghi quy trinh thuc te' + (row.scenario ? ' - ' + String(row.scenario).slice(0, 80) : ''),
       'sales', prompt, user?.id || null, user?.name || 'Admin'],
    );
    await pool.query(
      "UPDATE agent_teach_recordings SET derived_skill_id = $2, status = 'APPROVED' WHERE id = $1",
      [req.params.id, skill.rows[0].id],
    );
    res.json({ skill: skill.rows[0] });
  } catch (err: any) {
    logger.warn('[Teach] promote failed: ' + (err?.message || err));
    res.status(500).json({ error: 'Bien thanh skill that bai' });
  }
});
