/**
 * backupService.ts
 *
 * Sao lưu toàn bộ database (pg_dump → gzip) và lưu vào /tmp/backups.
 * Giữ tối đa N file gần nhất, tự động xóa file cũ.
 * Gửi email báo cáo cho admin sau mỗi lần backup.
 */

import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { logger } from '../middleware/logger';
import { brevoSendEmail, isBrevoConfigured } from './brevoService';

const BACKUP_DIR = process.env.BACKUP_DIR || '/tmp/backups';
const MAX_BACKUPS = parseInt(process.env.BACKUP_MAX_FILES || '7', 10);
const ADMIN_EMAIL = process.env.BACKUP_ADMIN_EMAIL || 'info@sgsland.vn';

export interface BackupResult {
  ok: boolean;
  filename: string;
  filepath: string;
  sizeBytes: number;
  durationMs: number;
  error?: string;
  rotatedFiles?: string[];
}

/**
 * Lấy connection string DB hiện tại (cùng logic db.ts).
 */
function getDbUrl(): string {
  const url =
    process.env.PROD_DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL;
  if (!url) throw new Error('No database URL configured');
  return url.replace(/[?&]channel_binding=[^&]*/g, (m) => (m.startsWith('?') ? '?' : ''))
    .replace(/\?&/, '?')
    .replace(/\?$/, '');
}

/**
 * Chạy pg_dump → gzip → file. Trả về kích thước file kết quả.
 */
async function pgDumpToFile(dbUrl: string, outPath: string): Promise<number> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const dump = spawn('pg_dump', [
    dbUrl,
    '--no-owner',
    '--no-acl',
    '--clean',
    '--if-exists',
    '--format=plain',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const errChunks: Buffer[] = [];
  dump.stderr.on('data', (c: Buffer) => errChunks.push(c));

  const gzip = createGzip({ level: 6 });
  const out = createWriteStream(outPath);

  try {
    await pipeline(dump.stdout, gzip, out);
  } catch (err: any) {
    dump.kill('SIGTERM');
    throw new Error(`pg_dump pipeline failed: ${err.message}`);
  }

  // Đợi pg_dump thoát hẳn
  const exitCode: number = await new Promise((resolve) => dump.on('close', resolve));
  if (exitCode !== 0) {
    const errMsg = Buffer.concat(errChunks).toString('utf8').slice(0, 1000);
    throw new Error(`pg_dump exited ${exitCode}: ${errMsg}`);
  }

  const stat = await fs.stat(outPath);
  return stat.size;
}

/**
 * Xóa file backup cũ, chỉ giữ MAX_BACKUPS file gần nhất.
 */
async function rotateBackups(): Promise<string[]> {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files
      .filter((f) => f.startsWith('backup-') && f.endsWith('.sql.gz'))
      .sort()
      .reverse(); // Mới nhất trước

    const toDelete = backups.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      await fs.unlink(path.join(BACKUP_DIR, f)).catch(() => null);
    }
    return toDelete;
  } catch {
    return [];
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Chạy backup đầy đủ + gửi email báo cáo. Là entrypoint cho cron + manual trigger.
 */
export async function runBackup(): Promise<BackupResult> {
  const start = Date.now();
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${ts}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  logger.info(`[Backup] Bắt đầu backup → ${filepath}`);

  try {
    const dbUrl = getDbUrl();
    const sizeBytes = await pgDumpToFile(dbUrl, filepath);
    const rotatedFiles = await rotateBackups();
    const durationMs = Date.now() - start;

    logger.info(
      `[Backup] ✓ Hoàn thành ${filename} — ${formatSize(sizeBytes)} trong ${durationMs}ms` +
      (rotatedFiles.length ? ` (xóa ${rotatedFiles.length} file cũ)` : '')
    );

    // Gửi email báo cáo (best-effort, không fail backup nếu email lỗi)
    if (isBrevoConfigured()) {
      try {
        await brevoSendEmail({
          to: ADMIN_EMAIL,
          subject: `[SGS LAND] Backup DB thành công — ${formatSize(sizeBytes)}`,
          text:
            `Backup database đã hoàn tất.\n\n` +
            `• File: ${filename}\n` +
            `• Kích thước: ${formatSize(sizeBytes)}\n` +
            `• Thời gian: ${(durationMs / 1000).toFixed(1)}s\n` +
            `• Lưu tại: ${filepath} (server)\n` +
            `• Tổng số bản backup giữ lại: ${MAX_BACKUPS}\n` +
            (rotatedFiles.length ? `• Đã xóa: ${rotatedFiles.join(', ')}\n` : '') +
            `\nTải file: GET https://sgsland.vn/api/admin/backups/${filename}\n` +
            `(Cần đăng nhập admin)\n\n` +
            `Lưu ý: file backup nằm trên /tmp của server, có thể mất sau redeploy. ` +
            `Khuyến nghị bật Neon PITR để khôi phục theo timestamp bất kỳ.`,
        });
      } catch (e: any) {
        logger.warn(`[Backup] Email báo cáo lỗi: ${e.message}`);
      }
    }

    return { ok: true, filename, filepath, sizeBytes, durationMs, rotatedFiles };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    logger.error(`[Backup] ✗ Thất bại sau ${durationMs}ms: ${err.message}`);

    if (isBrevoConfigured()) {
      try {
        await brevoSendEmail({
          to: ADMIN_EMAIL,
          subject: `[SGS LAND] ⚠️ BACKUP DB THẤT BẠI`,
          text: `Backup database đã thất bại.\n\nLỗi: ${err.message}\n\nThời gian: ${(durationMs / 1000).toFixed(1)}s\n\nVui lòng kiểm tra log production.`,
        });
      } catch { /* ignore */ }
    }

    // Xóa file backup dở dang
    await fs.unlink(filepath).catch(() => null);

    return { ok: false, filename, filepath, sizeBytes: 0, durationMs, error: err.message };
  }
}

/**
 * Liệt kê tất cả backup hiện có.
 */
export async function listBackups(): Promise<{ filename: string; sizeBytes: number; createdAt: string }[]> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files.filter((f) => f.startsWith('backup-') && f.endsWith('.sql.gz'));
    const stats = await Promise.all(
      backups.map(async (f) => {
        const s = await fs.stat(path.join(BACKUP_DIR, f));
        return { filename: f, sizeBytes: s.size, createdAt: s.mtime.toISOString() };
      })
    );
    return stats.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function getBackupFilePath(filename: string): string | null {
  // Prevent path traversal
  if (!/^backup-[\w\-]+\.sql\.gz$/.test(filename)) return null;
  return path.join(BACKUP_DIR, filename);
}
