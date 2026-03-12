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
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}
