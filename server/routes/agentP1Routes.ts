/**
 * agentP1Routes.ts — P1: Transcribe voice + Conversation outline.
 * 1) POST /api/public/livechat/transcribe  — nhan audio base64, dung Gemini
 *    xuat text tieng Viet (thay the Web Speech API chi chay tren Chrome).
 * 2) GET  /api/public/livechat/outline/:leadId — tom tat cau truc hoi thoai
 *    de user xem lai phien chat (kieu conversation outline cua Grok Bot).
 */
import { Router, type Request, type Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { pool } from '../db';
import { interactionRepository } from '../repositories/interactionRepository';
import { logger } from '../middleware/logger';
import { livechatRateLimit } from '../middleware/rateLimiter';

export const agentP1Router = Router();

const MAX_AUDIO_B64 = 6 * 1024 * 1024; // ~4.5MB audio sau khi base64

let _geminiP1: GoogleGenAI | null = null;
function getGeminiP1(): GoogleGenAI {
  if (_geminiP1) return _geminiP1;
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error('API key not valid. Please pass a valid API key.');
  _geminiP1 = new GoogleGenAI({ apiKey });
  return _geminiP1;
}

// ===== 1) TRANSCRIBE VOICE =====
agentP1Router.post('/transcribe', livechatRateLimit, async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, lang } = req.body || {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'audioBase64 la bat buoc' });
    }
    if (audioBase64.length > MAX_AUDIO_B64) {
      return res.status(413).json({ error: 'Audio qua lon (toi da ~4.5MB)' });
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(audioBase64.slice(0, 256))) {
      return res.status(400).json({ error: 'audioBase64 khong hop le' });
    }
    const audioMime = /^(audio|video)\/[a-z0-9.+-]+$/.test(String(mimeType))
      ? String(mimeType)
      : 'audio/webm';
    const ai = getGeminiP1();
    const result = await ai.models.generateContent({
      model: String(process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.5-flash'),
      contents: [{
        role: 'user',
        parts: [
          { text: `Transcribe hoan chinh doan am thanh sau sang tieng Viet (lang ${lang || 'vi'}). Chi xuat van ban chuyen bi, khong binh luan, khong thut lai.` },
          { inlineData: { mimeType: audioMime, data: audioBase64 } },
        ],
      }],
    });
    const text = (result.text || '').trim();
    if (!text) return res.status(422).json({ error: 'Khong nghe duoc noi dung' });
    return res.json({ text: text.slice(0, 4000) });
  } catch (err: any) {
    logger.warn(`[P1Transcribe] failed: ${err?.message || err}`);
    return res.status(500).json({ error: 'Transcribe that bai, vui long thu lai hoac goi 0379 281 445' });
  }
});

// ===== 2) CONVERSATION OUTLINE =====
// Tong hop phien chat thanh outline co cau truc:
// { greeting, topics: [{question, answer, ts}], contact, booking, lastActive }
agentP1Router.get('/outline/:leadId', livechatRateLimit, async (req: Request, res: Response) => {
  try {
    const leadId = String(req.params.leadId || '');
    if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
      return res.status(400).json({ error: 'leadId khong hop le' });
    }
    const PT = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';
    const all: any[] = (await interactionRepository.findByLead(PT, leadId)) || [];
    if (all.length === 0) {
      return res.status(404).json({ error: 'Khong tim thay phien chat' });
    }
    const rows: any[] = all.slice(0, 200).map((m: any) => ({
      content: m.content,
      direction: m.direction,
      metadata: m.metadata,
      created_at: m.created_at ?? m.createdAt ?? null,
    }));
    const outlineTopics: Array<{ question: string; answer: string; ts: string }> = [];
    let greeting: string | null = null;
    let lastActive: string | null = null;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const dir = String(row.direction || '').toUpperCase();
      const content = String(row.content || '').trim();
      lastActive = row.created_at;
      if (i === 0 && dir === 'OUTBOUND') { greeting = content.slice(0, 300); continue; }
      if (dir === 'INBOUND' && content) {
        const next = rows[i + 1];
        const answer = next && String(next.direction || '').toUpperCase() === 'OUTBOUND'
          ? String(next.content || '').slice(0, 500)
          : '';
        outlineTopics.push({
          question: content.slice(0, 300),
          answer,
          ts: row.created_at,
        });
      }
    }
    return res.json({
      leadId,
      messageCount: rows.length,
      greeting,
      topics: outlineTopics.slice(-30),
      lastActive,
    });
  } catch (err: any) {
    logger.warn(`[P1Outline] failed: ${err?.message || err}`);
    return res.status(500).json({ error: 'Khong tai duoc outline' });
  }
});
