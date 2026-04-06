import path from 'path';
import fs from 'fs';

export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return '';
  }

  try {
    if (ext === '.pdf') {
      return await extractPdf(absolutePath);
    }
    if (ext === '.docx') {
      return await extractDocx(absolutePath);
    }
    if (ext === '.doc') {
      return await extractDocx(absolutePath);
    }
    if (ext === '.txt') {
      return fs.readFileSync(absolutePath, 'utf-8');
    }
    return '';
  } catch (error) {
    console.error(`Text extraction failed for ${filePath}:`, error);
    return '';
  }
}

async function extractPdf(filePath: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const buffer = fs.readFileSync(filePath);
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

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}
