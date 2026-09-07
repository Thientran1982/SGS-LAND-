/**
 * MINH ORCHESTRATOR (Pha 2) — runtime de xuat LLM thay cho keyword matching tinh.
 * Nguyen tac: (1) chi DE XUAT intent/tool — moi han vien cao nhanh van qua approval broker;
 * (2) fallback day du ve keyword map khi LLM loi/timeout/tra JSON rac;
 * (3) moi lan de xuat ghi signal de do KPI delegation_accuracy.
 */
import { logger } from '../middleware/logger';
import { agentMemoryService } from '../services/agentMemoryService';
import { TASK_MODELS } from './modelPolicy';
import { getMinhCalibrationPromptLine } from '../services/minhCalibrationService';

export type MinhPlan = {
  intent: string;
  reason: string;
  confidence: number;
  source: 'MINH_LLM' | 'KEYWORD_FALLBACK';
};

export const MINH_INTENT_TOOLS: Record<string, string> = {
  VALUATION: 'get_valuation',
  SEARCH: 'search_listings',
  LEGAL: 'check_legal',
  PLANNING: 'check_planning',
  FINANCE: 'get_platform_knowledge',
  PROJECT: 'get_project_info',
  LONGTHANH: 'get_longthanh_market',
  INVESTMENT: 'analyze_investment',
  LANDING: 'landing_builder',
  LEAD_SCORING: 'score_lead',
  GENERAL: 'get_platform_knowledge',
};

const INTENT_DESCRIPTIONS = [
  'VALUATION - dinh gia gia tri bat dong san, hoi gia tri kha bao nhieu tien',
  'SEARCH - tim kiem can ho/nha/dat theo yeu cau cu the (vi tri, gia, dien tich)',
  'LEGAL - phap ly: so hong, rang buoc, quyen su dung dat, tranh chap',
  'PLANNING - quy hoach, ke hoach su dung dat, phep xay dung',
  'FINANCE - vay von, lai suat, thu tuc ngan hang, chinh sach tin dung',
  'PROJECT - thong tin du an cu the (aqua city, izumi, global city...): tien do, tien ich',
  'LONGTHANH - thi truong vung Long Thanh / san bay Long Thanh',
  'INVESTMENT - phan tich dau tu, cho thue, yield, ROI, loi nhuan',
  'LANDING - tao trang landing page cho du an',
  'LEAD_SCORING - cham diem khach hang tiem nang',
  'GENERAL - cau hoi tong quan khong thuoc nhom tren',
];

function buildMinhOrchestratorPrompt(
  message: string,
  ownerProfileBlock: string,
  lessonsBlock: string,
  calibrationLine = '',
): string {
  const parts = [
    'Ban la MINH - tong dieu phoi vien AI cua SGS LAND. Nhiem vu: doc tin nhan khach va chon DUNG MOT specialist phuc vu tot nhat.',
    '',
    'DANH SACH SPECIALIST (intent - mo ta):',
    ...INTENT_DESCRIPTIONS,
    '',
    'QUY TAC CHON:',
    '1. Chon theo Y NGHIA thuc su cua cau hoi, khong chi theo tu khoa xuat hien.',
    '2. Neu cau hoi nhac nhieu linh vuc, chon linh vuc TRUNG TAM cua cau hoi.',
    '3. Neu khong ro, chon GENERAL - KHONG doan.',
  ];
  if (ownerProfileBlock) parts.push('', '[HO SO CHU SO HUU]', ownerProfileBlock.slice(0, 400));
  if (lessonsBlock) parts.push('', '[BAI HOC TRUOC DO]', lessonsBlock.slice(0, 400));
  if (calibrationLine) parts.push('', calibrationLine);
  parts.push(
    '',
    'TIN NHAN KHACH: ' + JSON.stringify(message).slice(0, 600),
    '',
    'TRA LOI CHIN XAC theo JSON duy nhat (khong markdown):',
    '{"intent": "<MOT intent trong danh sach>", "reason": "<max 20 tu, tieng Viet>", "confidence": <0.0-1.0>}',
  );
  return parts.join('\n');
}

/**
 * Minh de xuat intent/tool bang LLM. Tra ve null khi bat dau sai — caller giu keyword fallback.
 * generateFn: truyen vao generateLiveChatText de tranh import vong (liveChatEngine -> minhOrchestrator).
 */
export async function minhChooseSpecialist(args: {
  tenantId: string;
  message: string;
  sessionId?: string;
  generateFn: (params: { system?: string; prompt: string; jsonMode?: boolean; timeoutMs?: number; feature?: string }) => Promise<string>;
  fallbackIntent?: string;
  fallbackTool?: string;
}): Promise<MinhPlan | null> {
  const started = Date.now();
  try {
    // Memory la gợi ý — không bắt buộc; lỗi không chặn delegation.
    let ownerBlock = '';
    let lessonsBlock = '';
    try {
      ownerBlock = await agentMemoryService.memoryBlock(args.tenantId, 'agent:owner-profile', undefined, 300);
      lessonsBlock = await agentMemoryService.memoryBlock(args.tenantId, 'agent:lessons', args.message, 300);
    } catch { /* memory optional */ }

    const calibrationLine = await getMinhCalibrationPromptLine(args.tenantId);
    const system = buildMinhOrchestratorPrompt(args.message, ownerBlock, lessonsBlock, calibrationLine);
    const raw = await args.generateFn({
      system,
      prompt: 'Chon specialist phu hop nhat roi tra ve JSON.',
      jsonMode: true,
      timeoutMs: 20000,
    });
    const cleaned = String(raw).split('`').join('').replace('json', '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const jsonSlice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(jsonSlice) as { intent?: string; reason?: string; confidence?: number };
    const intent = String(parsed.intent || '').toUpperCase().trim();
    if (!MINH_INTENT_TOOLS[intent]) {
      logger.warn('[MinhOrch] LLM tra intent khong hop le: ' + intent);
      return null;
    }
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const plan: MinhPlan = {
      intent,
      reason: String(parsed.reason || '').slice(0, 120),
      confidence,
      source: 'MINH_LLM',
    };
    logger.info('[MinhOrch] chose ' + intent + ' conf=' + confidence + ' reason="' + plan.reason + '" ms=' + (Date.now() - started));
    try {
      await agentMemoryService.recordSignal(args.tenantId, {
        signalType: 'minh_delegation',
        actorId: 'MINH',
        subjectType: 'chat_message',
        subjectId: String(args.message).slice(0, 120),
        payload: {
          intent, tool: MINH_INTENT_TOOLS[intent], reason: plan.reason,
          confidence, ms: Date.now() - started, sessionId: args.sessionId || null,
        },
        provenance: 'minh_orchestrator',
      });
    } catch { /* signal optional */ }
    return plan;
  } catch (err: any) {
    logger.warn('[MinhOrch] LLM delegation failed (' + (Date.now() - started) + 'ms): ' + (err?.message || err));
    return null;
  }
}

/** Keyword fallback dung ngay ket qua da detect — bao ve ky thuat cu. */
export function keywordPlan(intent: string, reason = 'keyword fallback'): MinhPlan {
  return { intent, reason, confidence: 0.3, source: 'KEYWORD_FALLBACK' };
}
