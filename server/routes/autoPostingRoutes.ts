import { Router, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  getAutoPostingSettings,
  upsertAutoPostingSettings,
  type AutoPostingTimeWindow,
} from '../repositories/autoPostingRepository';
import { normalizeSocialPlatforms } from '../services/socialPublicationService';
import { runAutoPostingTick } from '../services/autoPostingSelector';

const MANAGER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'MARKETING']);
const AUTO_PLATFORMS = new Set(['FACEBOOK_PAGE', 'ZALO_BROADCAST']);

function tenantId(req: Request): string {
  return String((req as any).user?.tenantId || (req as any).tenantId || '');
}

function requireManager(req: Request, res: Response): boolean {
  const user = (req as any).user;
  if (!user || !MANAGER_ROLES.has(user.role)) {
    res.status(403).json({ error: 'Cần quyền quản lý marketing hoặc quản trị viên' });
    return false;
  }
  return true;
}

function normalizeWindows(value: unknown): AutoPostingTimeWindow[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error('Cần ít nhất một khung giờ đăng');
  }
  const result = value.map(item => {
    const start = String(item?.start || '');
    const end = String(item?.end || '');
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      throw new Error('Khung giờ phải có định dạng HH:MM');
    }
    const valid = (value: string) => {
      const [hour, minute] = value.split(':').map(Number);
      return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    };
    if (!valid(start) || !valid(end)) throw new Error('Khung giờ không hợp lệ');
    return { start, end };
  });
  return result;
}

function normalizePlatforms(value: unknown): string[] {
  const platforms = normalizeSocialPlatforms(value)
    .filter(platform => AUTO_PLATFORMS.has(platform));
  if (!platforms.length) throw new Error('Chọn ít nhất một nền tảng tự động');
  return platforms;
}

export function createAutoPostingRouter(
  pool: Pool,
  authenticateToken: RequestHandler,
  cronSecret: string,
): Router {
  const router = Router();

  router.get('/api/auto-posting/settings', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    res.json(await getAutoPostingSettings(pool, tenantId(req)));
  });

  router.put('/api/auto-posting/settings', authenticateToken, async (req, res) => {
    if (!requireManager(req, res)) return;
    try {
      const body = req.body || {};
      const settings = await upsertAutoPostingSettings(pool, tenantId(req), {
        enabled: Boolean(body.enabled),
        postsPerDay: Number(body.postsPerDay),
        recycleAfterDays: Number(body.recycleAfterDays),
        timeWindows: normalizeWindows(body.timeWindows),
        platforms: normalizePlatforms(body.platforms),
      });
      return res.json(settings);
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Không thể lưu cấu hình tự động' });
    }
  });

  router.post('/api/internal/auto-posting-cron', async (req, res) => {
    const provided = (req.headers['x-internal-secret'] as string | undefined) || req.body?.secret;
    if (!cronSecret || !provided || provided !== cronSecret) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      return res.json({ ok: true, results: await runAutoPostingTick(pool) });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Auto posting tick failed' });
    }
  });

  return router;
}