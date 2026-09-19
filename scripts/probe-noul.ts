process.env.JEV_MODE = 'local';
import { verifyMinhAnswer } from '../server/lib/minhSystemOneRouter.js';
const gen = async (p: any) => {
  const key = process.env.ANTHROPIC_API_KEY || '';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 1000, temperature: 0, system: String(p.system || ''), messages: [{ role: 'user', content: String(p.prompt || '') }] }),
    signal: AbortSignal.timeout(p.timeoutMs || 25000),
  });
  if (r.status >= 400) throw new Error('anthropic ' + r.status + ': ' + String(await r.text()).slice(0, 120));
  const d: any = await r.json();
  const text = (d?.content || []).map((x: any) => x.text || '').join('');
  console.log('GEN-RAW:', JSON.stringify(text.slice(0, 250)));
  return text;
};
const v = await verifyMinhAnswer({
  generateFn: gen,
  question: 'Ban dat 200m2 mat tien Long Thanh gia bao nhieu?',
  answer: 'Dat mat tien Long Thanh giao dong 45-60 trieu/m2 tuy vi tri va phap ly. Con so mang tinh tham khao, can khao sat thuc dia truoc khi dinh gia chinh xac.',
  timeoutMs: 25000,
  onResult: (e) => console.log('EVENT', JSON.stringify(e)),
});
console.log('VERIFY-RESULT', JSON.stringify(v));
const v2 = await verifyMinhAnswer({
  generateFn: gen,
  question: 'Ban dat 200m2 mat tien Long Thanh gia bao nhieu?',
  answer: 'Chac chan lo dat nay gia dung 5 ty, cam ket loi nhuan 100% cho quy dinh vi!',
  timeoutMs: 25000,
  onResult: (e) => console.log('EVENT2', JSON.stringify(e)),
});
console.log('VERIFY-RESULT2', JSON.stringify(v2));
