/**
 * RAG Service — Retrieval-Augmented Generation
 *
 * Luồng hoạt động:
 *  1. INDEXING:   Document text → chunk() → embed() → lưu vào knowledge_chunks
 *  2. RETRIEVAL:  Query → embed() → cosine similarity search → top-K chunks
 *  3. GENERATION: Context chunks + user query → Gemini → câu trả lời có căn cứ
 */

import { pool } from '../db';

// ── Constants ──────────────────────────────────────────────────────────────

const EMBEDDING_MODEL   = 'models/gemini-embedding-001'; // 3072 dims, reduced to 768
const EMBEDDING_DIMS    = 768;                           // outputDimensionality
const CHUNK_SIZE        = 600;   // characters per chunk (≈ 150 tokens)
const CHUNK_OVERLAP     = 100;   // overlap để không mất context
const DEFAULT_TOP_K     = 5;     // số chunk trả về khi search
const MIN_SIMILARITY    = 0.35;  // loại chunk quá xa

// ── Embedding cache (in-memory, TTL 10 min) ───────────────────────────────

const embedCache = new Map<string, { vec: number[]; exp: number }>();

async function embedText(text: string): Promise<number[]> {
  const key = text.slice(0, 200);
  const cached = embedCache.get(key);
  if (cached && Date.now() < cached.exp) return cached.vec;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
  if (!apiKey) throw new Error('[RAG] GEMINI_API_KEY chưa được cấu hình');

  const url = `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      content: { parts: [{ text: text.slice(0, 10000) }] },
      outputDimensionality: EMBEDDING_DIMS,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[RAG] Embedding API lỗi ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json() as { embedding?: { values?: number[] } };
  const vec = data.embedding?.values;
  if (!vec?.length) throw new Error('[RAG] Embedding trống — kiểm tra API key và quota');

  embedCache.set(key, { vec, exp: Date.now() + 10 * 60 * 1000 });
  if (embedCache.size > 500) {
    const oldest = embedCache.keys().next().value;
    if (oldest) embedCache.delete(oldest);
  }
  return vec;
}

// ── Text chunking ──────────────────────────────────────────────────────────

/**
 * Chia văn bản thành các chunk có overlap.
 * Ưu tiên cắt tại dấu chấm câu / xuống dòng để giữ ngữ nghĩa.
 */
export function chunkText(text: string, title?: string): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];

  const prefix = title ? `[${title}] ` : '';
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = start + CHUNK_SIZE;
    if (end < clean.length) {
      // Ưu tiên cắt tại boundary tự nhiên: \n\n > \n > dấu chấm > khoảng trắng
      const boundaries = [
        clean.lastIndexOf('\n\n', end),
        clean.lastIndexOf('\n', end),
        clean.lastIndexOf('. ', end),
        clean.lastIndexOf(' ', end),
      ];
      for (const b of boundaries) {
        if (b > start + CHUNK_SIZE * 0.5) { end = b + 1; break; }
      }
    }
    const chunk = (prefix + clean.slice(start, end)).trim();
    if (chunk.length > 20) chunks.push(chunk);
    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
    if (end >= clean.length) break;
  }
  return chunks;
}

// ── Indexing ───────────────────────────────────────────────────────────────

export interface IndexOptions {
  tenantId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Index một tài liệu: chunk → embed → upsert vào knowledge_chunks.
 * Xóa chunks cũ trước để tránh duplicate.
 * @returns số chunks đã index
 */
export async function indexDocument(opts: IndexOptions): Promise<number> {
  const { tenantId, sourceType, sourceId, title, content, metadata = {} } = opts;

  const chunks = chunkText(content, title);
  if (!chunks.length) {
    // Tài liệu rỗng: xóa chunks cũ và return
    await pool.query(
      `DELETE FROM knowledge_chunks WHERE tenant_id=$1 AND source_type=$2 AND source_id=$3`,
      [tenantId, sourceType, sourceId]
    );
    return 0;
  }

  // Embed tất cả chunks (sequential để tránh rate limit)
  const embeddings: number[][] = [];
  for (const chunk of chunks) {
    try {
      embeddings.push(await embedText(chunk));
    } catch (err) {
      console.error(`[RAG] Embed lỗi chunk "${chunk.slice(0, 50)}":`, err);
      embeddings.push(new Array(768).fill(0)); // zero vector fallback
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Xóa chunks cũ của cùng source
    await client.query(
      `DELETE FROM knowledge_chunks WHERE tenant_id=$1 AND source_type=$2 AND source_id=$3`,
      [tenantId, sourceType, sourceId]
    );

    // Insert chunks mới
    for (let i = 0; i < chunks.length; i++) {
      const vec = `[${embeddings[i].join(',')}]`;
      await client.query(
        `INSERT INTO knowledge_chunks
          (tenant_id, source_type, source_id, chunk_index, content, embedding, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
         ON CONFLICT (tenant_id, source_type, source_id, chunk_index) DO UPDATE
           SET content=EXCLUDED.content, embedding=EXCLUDED.embedding,
               metadata=EXCLUDED.metadata, updated_at=NOW()`,
        [tenantId, sourceType, sourceId, i, chunks[i], vec, JSON.stringify({ ...metadata, title })]
      );
    }

    await client.query('COMMIT');
    console.log(`[RAG] Indexed ${chunks.length} chunks — ${sourceType}:${sourceId} (tenant:${tenantId.slice(0,8)})`);
    return chunks.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Retrieval ──────────────────────────────────────────────────────────────

export interface SearchResult {
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
}

/**
 * Tìm kiếm các chunks gần nhất với query bằng cosine similarity.
 * Sử dụng pgvector operator `<=>` (cosine distance).
 */
export async function semanticSearch(
  tenantId: string,
  query: string,
  topK = DEFAULT_TOP_K,
  sourceTypes?: string[]
): Promise<SearchResult[]> {
  const queryVec = await embedText(query);
  const vecStr = `[${queryVec.join(',')}]`;

  const typeFilter = sourceTypes?.length
    ? `AND source_type = ANY($4::text[])`
    : '';

  const params: any[] = [tenantId, vecStr, topK];
  if (sourceTypes?.length) params.push(sourceTypes);

  const result = await pool.query(
    `SELECT
       source_type, source_id, chunk_index, content, metadata,
       1 - (embedding <=> $2::vector) AS similarity
     FROM knowledge_chunks
     WHERE tenant_id = $1 ${typeFilter}
       AND embedding IS NOT NULL
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    params
  );

  return result.rows
    .filter((r: any) => r.similarity >= MIN_SIMILARITY)
    .map((r: any) => ({
      sourceType: r.source_type,
      sourceId: r.source_id,
      chunkIndex: r.chunk_index,
      content: r.content,
      similarity: parseFloat(r.similarity),
      metadata: r.metadata || {},
    }));
}

// ── Context builder (cho AI prompt) ───────────────────────────────────────

/**
 * Lấy context từ knowledge base và format sẵn để inject vào AI prompt.
 * Trả về chuỗi rỗng nếu không tìm thấy kết quả liên quan.
 */
export async function buildRagContext(
  tenantId: string,
  query: string,
  topK = DEFAULT_TOP_K
): Promise<string> {
  try {
    const results = await semanticSearch(tenantId, query, topK);
    if (!results.length) return '';

    const parts = results.map((r, i) => {
      const title = r.metadata?.title ? `[${r.metadata.title}]` : `[${r.sourceType}:${r.sourceId}]`;
      return `--- Nguồn ${i + 1} ${title} (độ liên quan: ${(r.similarity * 100).toFixed(0)}%) ---\n${r.content}`;
    });

    return `\n[KNOWLEDGE BASE — thông tin nội bộ đã xác minh]\n${parts.join('\n\n')}\n[END KNOWLEDGE BASE]\n`;
  } catch (err) {
    console.error('[RAG] buildRagContext lỗi:', err);
    return '';
  }
}

// ── Stats & management ─────────────────────────────────────────────────────

export async function getIndexStats(tenantId: string): Promise<{
  total: number;
  byType: Record<string, number>;
  sources: number;
}> {
  const result = await pool.query(
    `SELECT source_type, COUNT(*)::int as cnt, COUNT(DISTINCT source_id)::int as srcs
     FROM knowledge_chunks WHERE tenant_id=$1 GROUP BY source_type`,
    [tenantId]
  );
  const byType: Record<string, number> = {};
  let total = 0;
  let sources = 0;
  for (const row of result.rows) {
    byType[row.source_type] = row.cnt;
    total += row.cnt;
    sources += row.srcs;
  }
  return { total, byType, sources };
}

export async function deleteSource(tenantId: string, sourceType: string, sourceId: string): Promise<number> {
  const result = await pool.query(
    `DELETE FROM knowledge_chunks WHERE tenant_id=$1 AND source_type=$2 AND source_id=$3`,
    [tenantId, sourceType, sourceId]
  );
  return result.rowCount ?? 0;
}
