import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import type {
  ProviderAttachmentFailure,
  ProviderFilePart,
  ProviderImagePart,
} from './providers/types';

const execFileAsync = promisify(execFile);

/** Keep provider fallback rendering bounded independently of upload limits. */
export const MAX_RENDERED_DOCUMENT_PAGES = 4;
const MAX_RENDERED_PAGE_WIDTH = 1600;
const MAX_RENDERED_PAGE_HEIGHT = 2200;
const MAX_RENDERED_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_RENDERED_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_EMBEDDED_PAGE_SOURCE_BYTES = 8 * 1024 * 1024;
const PDF_RENDER_TIMEOUT_MS = 8_000;

const MIME_BY_EXTENSION: Record<string, string> = {
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
};

export class DocumentVisualFallbackError extends Error {
  readonly status = 415;
  readonly attachmentFailure: ProviderAttachmentFailure;

  constructor(message: string, file?: ProviderFilePart) {
    super(message);
    this.name = 'DocumentVisualFallbackError';
    const rawName = String(file?.filename || 'tài liệu đính kèm');
    const attachmentName = rawName
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, 160) || 'tài liệu đính kèm';
    this.attachmentFailure = {
      code: 'ATTACHMENT_VISUAL_UNREADABLE',
      ...(file?.source?.attachmentId ? { attachmentId: file.source.attachmentId } : {}),
      attachmentName,
      ...(file?.source?.extractionStatus
        ? { extractionStatus: file.source.extractionStatus }
        : {}),
    };
  }
}

function pageImageSource(file: ProviderFilePart): ProviderImagePart['source'] {
  return file.source ? { ...file.source } : undefined;
}

async function normalizePageImage(
  input: Buffer,
  file: ProviderFilePart,
  page: number,
): Promise<ProviderImagePart | null> {
  try {
    const data = await sharp(input, { limitInputPixels: 16_000_000 })
      .rotate()
      .resize({
        width: MAX_RENDERED_PAGE_WIDTH,
        height: MAX_RENDERED_PAGE_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
    if (data.length === 0 || data.length > MAX_RENDERED_PAGE_BYTES) return null;
    return {
      mimeType: 'image/png',
      dataBase64: data.toString('base64'),
      filename: `${file.filename || 'attachment'}.page-${page}.png`,
      source: pageImageSource(file),
    };
  } catch {
    return null;
  }
}

async function renderPdf(file: ProviderFilePart): Promise<ProviderImagePart[]> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sgs-doc-pages-'));
  const inputPath = path.join(directory, 'document.pdf');
  const outputPrefix = path.join(directory, 'page');
  try {
    await writeFile(inputPath, Buffer.from(file.dataBase64, 'base64'));
    await execFileAsync(
      'pdftoppm',
      [
        '-png',
        '-r',
        '120',
        '-f',
        '1',
        '-l',
        String(MAX_RENDERED_DOCUMENT_PAGES),
        inputPath,
        outputPrefix,
      ],
      { timeout: PDF_RENDER_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
    );
    const files = (await readdir(directory))
      .filter(name => /^page-\d+\.png$/i.test(name))
      .sort((left, right) => {
        const leftPage = Number(left.match(/\d+/)?.[0] || 0);
        const rightPage = Number(right.match(/\d+/)?.[0] || 0);
        return leftPage - rightPage;
      })
      .slice(0, MAX_RENDERED_DOCUMENT_PAGES);

    const pages: ProviderImagePart[] = [];
    let totalBytes = 0;
    for (const [index, pageFile] of files.entries()) {
      const page = await normalizePageImage(
        await readFile(path.join(directory, pageFile)),
        file,
        index + 1,
      );
      if (!page) continue;
      const pageBytes = Buffer.byteLength(page.dataBase64, 'base64');
      if (totalBytes + pageBytes > MAX_RENDERED_TOTAL_BYTES) break;
      pages.push(page);
      totalBytes += pageBytes;
    }
    return pages;
  } catch (error) {
    throw new DocumentVisualFallbackError(
      `Không thể render các trang trực quan của ${file.filename || 'tài liệu'}`,
      file,
    );
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function renderDocx(file: ProviderFilePart): Promise<ProviderImagePart[]> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(
      new Uint8Array(Buffer.from(file.dataBase64, 'base64')),
      {
        // DOCX is a ZIP container. Extract only bounded image members so a
        // crafted archive cannot inflate unrelated XML or oversized payloads.
        filter: ({ name, originalSize }) =>
          name.startsWith('word/media/')
          && !!MIME_BY_EXTENSION[path.extname(name).toLowerCase()]
          && originalSize <= MAX_EMBEDDED_PAGE_SOURCE_BYTES,
      },
    );
  } catch {
    throw new DocumentVisualFallbackError(
      `Không thể đọc nội dung trực quan của ${file.filename || 'tài liệu'}`,
      file,
    );
  }

  const mediaFiles = Object.keys(entries)
    .filter(name => name.startsWith('word/media/'))
    .filter(name => MIME_BY_EXTENSION[path.extname(name).toLowerCase()])
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .slice(0, MAX_RENDERED_DOCUMENT_PAGES);
  const pages: ProviderImagePart[] = [];
  let totalBytes = 0;
  for (const [index, mediaFile] of mediaFiles.entries()) {
    const page = await normalizePageImage(
      Buffer.from(entries[mediaFile]),
      file,
      index + 1,
    );
    if (!page) continue;
    const pageBytes = Buffer.byteLength(page.dataBase64, 'base64');
    if (totalBytes + pageBytes > MAX_RENDERED_TOTAL_BYTES) break;
    pages.push(page);
    totalBytes += pageBytes;
  }
  return pages;
}

/**
 * Convert only provider-unsupported visual documents into bounded page images.
 * The returned image parts retain the original attachment evidence reference.
 */
export async function renderDocumentVisualPages(file: ProviderFilePart): Promise<ProviderImagePart[]> {
  if (file.mimeType === 'application/pdf') return renderPdf(file);
  if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return renderDocx(file);
  }
  return [];
}