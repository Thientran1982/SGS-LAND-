/**
 * listingBoostService.ts
 *
 * AI theo doi tin dang co luot xem cao (>20) va sinh goi y hanh dong
 * quang cao / toi uu de chu tin thu hut them nguoi xem.
 * Dung @google/genai (gemini-2.5-flash).
 */
import { GoogleGenAI } from '@google/genai';
import { logger } from '../middleware/logger';

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY chua duoc cau hinh');
  if (!_client) _client = new GoogleGenAI({ apiKey });
  return _client;
}

export interface ListingForBoost {
  id: string;
  title: string | null;
  type: string | null;
  price: number | null;
  location: string | null;
  area: number | null;
  bedrooms: number | null;
  viewCount: number;
}

/**
 * Sinh 3-5 goi y hanh dong giup tin dang thu hut them nguoi xem.
 * Co fallback tinh: neu AI loi van tra ve goi y mac dinh de email luon gui duoc.
 */
export async function generateBoostSuggestions(listing: ListingForBoost): Promise<string[]> {
  const fallback = [
    'Bo sung them anh chat luong cao va video ngan ve bat dong san.',
    'Cap nhat tieu de hap dan, ro rang loi the (vi tri, gia, tien ich).',
    'Day tin len dau / mua goi quang cao de tang hien thi.',
    'Bo sung mo ta chi tiet ve phap ly, huong nha, tien ich xung quanh.',
    'Chia se tin len mang xa hoi va nhom cong dong khu vuc.',
  ];

  const prompt = `
Tin dang BDS dang co ${listing.viewCount} luot xem (dang duoc quan tam).
Thong tin tin:
- Tieu de: ${listing.title || 'N/A'}
- Loai: ${listing.type || 'N/A'}
- Gia: ${listing.price ? listing.price.toLocaleString('vi-VN') + ' VND' : 'N/A'}
- Khu vuc: ${listing.location || 'N/A'}
- Dien tich: ${listing.area || 'N/A'} m2
- So phong ngu: ${listing.bedrooms ?? 'N/A'}

Hay dua ra 3-5 goi y HANH DONG cu the, ngan gon (moi y 1 cau) bang tieng Viet co dau,
giup chu tin quang cao/toi uu de THU HUT THEM nguoi xem va tang co hoi giao dich.
CHI tra ve JSON: { "suggestions": ["...", "..."] }
`.trim();

  try {
    const result = await getClient().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction:
          'Ban la chuyen gia marketing bat dong san. Tra loi ngan gon, thuc te, CHI tra ve JSON hop le.',
        temperature: 0.5,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const raw = (result?.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    const clean = list.filter((x: any) => typeof x === 'string' && x.trim()).slice(0, 5);
    return clean.length ? clean : fallback;
  } catch (err: any) {
    logger.warn(`[ListingBoost] AI loi, dung goi y mac dinh: ${err?.message || err}`);
    return fallback;
  }
}
