/**
 * Public AI consultation route for static landing pages.
 * - No auth required.
 * - Uses Gemini to answer questions about the project context (e.g. Vinhomes Hóc Môn).
 * - Stateless: full message history passed from the client each turn.
 */

import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../middleware/logger';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ConsultPayload {
  project?: string;
  messages?: ChatMessage[];
}

const PROJECT_CONTEXTS: Record<string, string> = {
  'vinhomes-hoc-mon': `
Bạn là chuyên viên tư vấn bất động sản của SGS Land, am hiểu sâu về dự án Vinhomes Hóc Môn.

THÔNG TIN DỰ ÁN VINHOMES HÓC MÔN (cập nhật 2026):
- Chủ đầu tư: Công ty CP Vinhomes (Vinhomes JSC) – Tập đoàn Vingroup.
- Vị trí: Huyện Hóc Môn, TP. Hồ Chí Minh, mặt tiền Quốc lộ 22 – cửa ngõ Tây Bắc TP.HCM.
- Quy mô: 1.080 hecta – lớn nhất TP.HCM, gấp ~4 lần Vinhomes Grand Park (271 ha).
- Quy hoạch ~150.000 cư dân; 6 phân khu: nhà phố thương mại, biệt thự đơn/song lập,
  shophouse, chung cư cao tầng smart apartment, khu giáo dục–y tế–thương mại,
  công viên & hồ điều hòa.
- Pháp lý: sổ hồng lâu dài cho thấp tầng, sổ hồng căn hộ chung cư.
- Tiến độ: dự kiến mở bán 2026, bàn giao cuốn chiếu 2028–2031.
- Hạ tầng kết nối: Vành đai 3 (hoàn thành 2026), Metro số 2 Bến Thành – Tham Lương – Hóc Môn
  (ga cuối nằm trong khu vực), cao tốc TP.HCM – Mộc Bài (đang chuẩn bị đầu tư).
- Khoảng cách: Quận 1 ~20 km (~30 phút), sân bay Tân Sơn Nhất ~15 km.
- Tiện ích nội khu (hệ sinh thái Vingroup khép kín): Vinschool liên cấp, bệnh viện Vinmec,
  trung tâm thương mại Vincom Mega Mall, hồ bơi Olympic, công viên 4 mùa, đường chạy bộ
  ven hồ, gym, an ninh AI 24/7, smart home, 30% diện tích cây xanh, trạm sạc VinFast.
- Bảng giá 2026: ĐANG CẬP NHẬT – Vinhomes JSC chưa công bố mức giá tham khảo cụ thể.
  Tuyệt đối KHÔNG bịa giá. Hướng dẫn khách đăng ký nhận bảng giá khi mở bán.
- Hotline SGS Land: 0971 132 378.

NGUYÊN TẮC TRẢ LỜI:
1. Trả lời bằng tiếng Việt, ngắn gọn, đúng trọng tâm (tối đa 4–6 câu cho mỗi lượt).
2. Chỉ dùng dữ kiện trong thông tin trên. Nếu khách hỏi điều ngoài phạm vi (ví dụ giá cụ thể,
   chính sách chiết khấu chi tiết, mã căn cụ thể), trả lời trung thực rằng dữ liệu đang
   được cập nhật và mời khách để lại số điện thoại để chuyên viên gọi lại trong 30 phút.
3. Không hứa hẹn cam kết lợi nhuận đầu tư. Có thể nêu các yếu tố hỗ trợ tăng giá
   (hạ tầng, quy hoạch lên quận, hệ sinh thái Vingroup) một cách khách quan.
4. Khi khách bày tỏ ý định mua/đầu tư, chủ động gợi ý: "Anh/chị để lại số điện thoại
   ở mục Đăng ký nhận thông tin phía dưới, chuyên viên sẽ gọi lại trong 30 phút",
   hoặc gọi hotline 0971 132 378.
5. Xưng "em", gọi khách "anh/chị". Phong cách thân thiện, chuyên nghiệp, không dùng emoji.
`.trim(),
};

const MAX_MESSAGES = 20;
const MAX_CONTENT_LEN = 1000;

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

export function createLandingAiRoutes(): Router {
  const router = Router();

  router.post('/consult', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as ConsultPayload;
      const projectKey = (body.project || 'vinhomes-hoc-mon').trim().toLowerCase();
      const systemContext = PROJECT_CONTEXTS[projectKey];
      if (!systemContext) {
        return res.status(400).json({ ok: false, error: 'Dự án không hợp lệ.' });
      }

      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0) {
        return res.status(400).json({ ok: false, error: 'Thiếu nội dung câu hỏi.' });
      }
      if (messages.length > MAX_MESSAGES) {
        return res.status(400).json({ ok: false, error: 'Cuộc hội thoại quá dài, vui lòng tải lại trang.' });
      }

      const cleaned: ChatMessage[] = messages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({
          role: m.role,
          content: String(m.content).trim().slice(0, MAX_CONTENT_LEN),
        }))
        .filter(m => m.content.length > 0);

      if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== 'user') {
        return res.status(400).json({ ok: false, error: 'Tin nhắn cuối cần đến từ người dùng.' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          ok: false,
          error: 'AI tư vấn tạm thời chưa sẵn sàng. Vui lòng gọi hotline 0971 132 378 để được hỗ trợ ngay.',
        });
      }

      // Build Gemini contents: alternating user/model turns.
      const contents = cleaned.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const result = await getClient().models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: systemContext,
          temperature: 0.4,
          maxOutputTokens: 600,
        },
      });

      const reply = (result?.text || '').trim();
      if (!reply) {
        return res.status(502).json({
          ok: false,
          error: 'Không nhận được phản hồi từ AI. Vui lòng thử lại hoặc gọi hotline 0971 132 378.',
        });
      }

      return res.json({ ok: true, reply });
    } catch (err: any) {
      logger.error(`[LandingAI] Error: ${err?.message || err}`);
      return res.status(500).json({
        ok: false,
        error: 'AI tư vấn gặp sự cố. Vui lòng thử lại hoặc gọi hotline 0971 132 378.',
      });
    }
  });

  return router;
}
