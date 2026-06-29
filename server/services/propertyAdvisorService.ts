/**
 * propertyAdvisorService.ts
 *
 * AI Property Advisor - Tu van dau tu BDS.
 * Nguoi dung nhap: ngan sach, khu vuc, muc dich (o/dau tu/cho thue),
 * muc chap nhan rui ro, ky vong dong tien.
 * AI tra ve 3-5 du an phu hop kem: diem dau tu (/100), ty suat loi nhuan
 * du kien, phan tich uu/nhuoc diem, va so sanh giua cac du an.
 *
 * Dung @google/genai (gemini-2.5-flash) theo dung pattern san co cua he thong.
 */
import { GoogleGenAI } from '@google/genai';
import { Pool } from 'pg';
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

export type AdvisorPurpose = 'o' | 'dau_tu' | 'cho_thue';
export type AdvisorRisk = 'thap' | 'trung_binh' | 'cao';
export type AdvisorCashflow = 'khong_quan_trong' | 'on_dinh' | 'toi_da';

export interface AdvisorInput {
  budgetMin?: number;          // VND
  budgetMax?: number;          // VND
  area?: string;               // khu vuc mong muon, vd "Quan 2, TP.HCM"
  purpose: AdvisorPurpose;
  risk: AdvisorRisk;
  cashflow?: AdvisorCashflow;
  notes?: string;
}

interface ProjectRow {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  location: string | null;
  total_units: number | null;
  status: string | null;
  metadata: any;
}

export interface AdvisorProjectResult {
  projectId: string;
  name: string;
  location: string;
  priceFrom: string;
  developer: string;
  type: string;
  investmentScore: number;        // /100
  expectedRoiPct: string;         // vd "8-12%/nam"
  pros: string[];
  cons: string[];
  reasoning: string;
}

export interface AdvisorResponse {
  recommendations: AdvisorProjectResult[];
  comparison: string;             // so sanh tong hop giua cac du an
  disclaimer: string;
}

const PURPOSE_LABEL: Record<AdvisorPurpose, string> = {
  o: 'De o (an cu)',
  dau_tu: 'Dau tu sinh loi (mua di ban lai / tang gia)',
  cho_thue: 'Cho thue tao dong tien',
};
const RISK_LABEL: Record<AdvisorRisk, string> = {
  thap: 'Thap (uu tien an toan, bao toan von)',
  trung_binh: 'Trung binh (can bang)',
  cao: 'Cao (chap nhan bien dong de toi da loi nhuan)',
};

/**
 * Lay danh sach du an ACTIVE cua tenant lam ung vien cho AI.
 * Loc so bo theo khu vuc neu nguoi dung co nhap (de giam token, tang do chinh xac).
 */
export async function fetchCandidateProjects(
  pool: Pool,
  tenantId: string,
  area?: string,
): Promise<ProjectRow[]> {
  const params: any[] = [tenantId];
  let areaClause = '';
  if (area && area.trim()) {
    params.push(`%${area.trim().toLowerCase()}%`);
    areaClause = ` AND (LOWER(location) LIKE $2 OR LOWER(name) LIKE $2 OR LOWER(COALESCE(description,'')) LIKE $2)`;
  }
  const result = await pool.query(
    `SELECT id, name, code, description, location, total_units, status, metadata
       FROM projects
      WHERE tenant_id = $1
        AND status = 'ACTIVE'
        ${areaClause}
      ORDER BY created_at DESC
      LIMIT 40`,
    params,
  );
  // Neu loc theo khu vuc khong ra ket qua, fallback lay tat ca du an ACTIVE.
  if (result.rowCount === 0 && areaClause) {
    const fb = await pool.query(
      `SELECT id, name, code, description, location, total_units, status, metadata
         FROM projects
        WHERE tenant_id = $1 AND status = 'ACTIVE'
        ORDER BY created_at DESC
        LIMIT 40`,
      [tenantId],
    );
    return fb.rows;
  }
  return result.rows;
}

function formatVnd(v?: number): string {
  if (!v || v <= 0) return 'khong gioi han';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} ty`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} trieu`;
  return `${v}`;
}

function buildCatalog(projects: ProjectRow[]): string {
  return projects
    .map((p, i) => {
      const m = p.metadata || {};
      return [
        `#${i + 1} [projectId=${p.id}]`,
        `Ten: ${p.name}`,
        `Chu dau tu: ${m.developer || 'N/A'}`,
        `Khu vuc: ${p.location || 'N/A'}`,
        `Loai hinh: ${m.type || 'N/A'}`,
        `Quy mo: ${m.scale || 'N/A'}`,
        `Gia tu: ${m.priceFrom || 'N/A'}`,
        `Trang thai ban giao: ${m.badge || 'N/A'}`,
        `Mo ta: ${(p.description || '').slice(0, 240)}`,
      ].join(' | ');
    })
    .join('\n');
}

/**
 * Goi AI de tao tu van. Tra ve AdvisorResponse da parse JSON an toan.
 */
export async function generateAdvice(
  pool: Pool,
  tenantId: string,
  input: AdvisorInput,
): Promise<AdvisorResponse> {
  const projects = await fetchCandidateProjects(pool, tenantId, input.area);
  if (projects.length === 0) {
    return {
      recommendations: [],
      comparison: 'Hien chua co du an phu hop trong he thong de tu van.',
      disclaimer:
        'Thong tin chi mang tinh tham khao, khong phai loi khuyen dau tu tai chinh.',
    };
  }

  const catalog = buildCatalog(projects);
  const validIds = projects.map((p) => p.id);

  const systemInstruction = [
    'Ban la chuyen gia tu van dau tu bat dong san tai Viet Nam, khach quan va than trong.',
    'Chi duoc chon du an TU danh sach catalog cung cap (dung dung projectId co san).',
    'Chon 3 den 5 du an phu hop nhat voi nhu cau nguoi dung.',
    'Cham diem dau tu /100 dua tren su phu hop voi ngan sach, khu vuc, muc dich, khau vi rui ro va ky vong dong tien.',
    'Uoc luong ty suat loi nhuan du kien theo khoang (vd "8-12%/nam") va ghi ro day la uoc tinh tham khao.',
    'Phan tich uu/nhuoc diem cu the, trung thuc; khong thoi phong, khong cam ket loi nhuan.',
    'Tra ket qua bang tieng Viet co dau.',
    'CHI tra ve JSON hop le theo dung schema, khong them van ban ngoai JSON.',
  ].join(' ');

  const userPrompt = `
NHU CAU NGUOI DUNG:
- Ngan sach: tu ${formatVnd(input.budgetMin)} den ${formatVnd(input.budgetMax)} VND
- Khu vuc mong muon: ${input.area || 'khong gioi han'}
- Muc dich: ${PURPOSE_LABEL[input.purpose]}
- Khau vi rui ro: ${RISK_LABEL[input.risk]}
- Ky vong dong tien: ${input.cashflow || 'khong neu'}
- Ghi chu them: ${input.notes || 'khong'}

DANH SACH DU AN (CATALOG) - CHI chon trong day:
${catalog}

YEU CAU: Tra ve JSON dung schema:
{
  "recommendations": [
    {
      "projectId": "<id tu catalog>",
      "name": "<ten>",
      "location": "<khu vuc>",
      "priceFrom": "<gia tu>",
      "developer": "<chu dau tu>",
      "type": "<loai hinh>",
      "investmentScore": <so 0-100>,
      "expectedRoiPct": "<vd 8-12%/nam>",
      "pros": ["<uu diem>"],
      "cons": ["<nhuoc diem>"],
      "reasoning": "<vi sao phu hop voi nguoi dung>"
    }
  ],
  "comparison": "<so sanh tong hop giua cac du an da chon>",
  "disclaimer": "<canh bao day la thong tin tham khao>"
}
`.trim();

  let raw = '';
  try {
    const result = await getClient().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 2500,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    raw = (result?.text || '').trim();
  } catch (err: any) {
    logger.error(`[PropertyAdvisor] Loi goi AI: ${err?.message || err}`);
    throw new Error('AI tu van gap su co, vui long thu lai sau.');
  }

  let parsed: AdvisorResponse;
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    logger.error(`[PropertyAdvisor] Khong parse duoc JSON tu AI: ${raw.slice(0, 200)}`);
    throw new Error('AI tra ve dinh dang khong hop le, vui long thu lai.');
  }

  // Hau kiem: chi giu du an co projectId hop le, gioi han 5, clamp diem 0-100.
  const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  parsed.recommendations = recs
    .filter((r) => r && validIds.includes(r.projectId))
    .slice(0, 5)
    .map((r) => ({
      ...r,
      investmentScore: Math.max(0, Math.min(100, Math.round(Number(r.investmentScore) || 0))),
      pros: Array.isArray(r.pros) ? r.pros.slice(0, 6) : [],
      cons: Array.isArray(r.cons) ? r.cons.slice(0, 6) : [],
    }));

  if (!parsed.disclaimer) {
    parsed.disclaimer =
      'Thong tin chi mang tinh tham khao, khong phai loi khuyen dau tu tai chinh. Vui long tu tham dinh truoc khi quyet dinh.';
  }
  return parsed;
}
