import path from 'path';
import fs from 'fs';

/**
 * Extract text from a Buffer (file data from PostgreSQL storage).
 * `ext` must include the dot, e.g. '.pdf', '.docx', '.txt'
 */
export async function extractTextFromBuffer(buffer: Buffer, ext: string): Promise<string> {
  try {
    if (ext === '.pdf') {
      return await extractPdfFromBuffer(buffer);
    }
    if (ext === '.docx' || ext === '.doc') {
      return await extractDocxFromBuffer(buffer);
    }
    if (ext === '.txt') {
      return buffer.toString('utf-8');
    }
    return '';
  } catch (error) {
    console.error(`Text extraction (buffer) failed for ext=${ext}:`, error);
    return '';
  }
}

/**
 * Extract text from a file path on disk (legacy / dev fallback).
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return '';
  }

  try {
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(absolutePath);
      return await extractPdfFromBuffer(buffer);
    }
    if (ext === '.docx' || ext === '.doc') {
      const buffer = fs.readFileSync(absolutePath);
      return await extractDocxFromBuffer(buffer);
    }
    if (ext === '.txt') {
      return fs.readFileSync(absolutePath, 'utf-8');
    }
    return '';
  } catch (error) {
    console.error(`Text extraction (file) failed for ${filePath}:`, error);
    return '';
  }
}

async function extractPdfFromBuffer(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array, useSystemFonts: true }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => item.str)
      .join(' ');
    if (pageText.trim()) {
      textParts.push(pageText);
    }
  }

  return textParts.join('\n');
}

async function extractDocxFromBuffer(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}
