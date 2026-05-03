#!/usr/bin/env tsx
/**
 * Seed knowledge base from local markdown files.
 *
 * Usage:
 *   npm run knowledge:seed                  # seed all tenants
 *   npm run knowledge:seed -- <tenant_id>   # seed a specific tenant
 *
 * Reads `seed/knowledge/{domain}/*.md` where domain ∈ {legal, finance, market, product}
 * and indexes each file via the existing RAG pipeline (chunk + embed + store).
 *
 * Re-running is safe: previous chunks for the same source_id are replaced.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { pool } from '../server/db';
import { indexDocument } from '../server/services/ragService';

const DOMAINS = ['legal', 'finance', 'market', 'product'] as const;
type Domain = typeof DOMAINS[number];

// Map a domain folder to a sourceType used by the RAG layer.
const DOMAIN_SOURCE_TYPE: Record<Domain, string> = {
  legal:   'knowledge_legal',
  finance: 'knowledge_finance',
  market:  'knowledge_market',
  product: 'knowledge_product',
};

interface SeedFile {
  domain: Domain;
  filename: string;
  fullPath: string;
  title: string;
  content: string;
}

async function readDomain(domain: Domain): Promise<SeedFile[]> {
  const dir = path.join(process.cwd(), 'seed', 'knowledge', domain);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: SeedFile[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const fullPath = path.join(dir, entry);
    const content = await fs.readFile(fullPath, 'utf8');
    if (!content.trim()) continue;

    // Title = first H1 line if present, else filename without extension.
    const headingMatch = content.match(/^#\s+(.+)$/m);
    const title = (headingMatch?.[1] || entry.replace(/\.md$/, '').replace(/[-_]/g, ' ')).trim();
    out.push({ domain, filename: entry, fullPath, title, content });
  }
  return out;
}

async function listAllTenants(): Promise<string[]> {
  const res = await pool.query<{ id: string }>(`SELECT id FROM tenants ORDER BY created_at`);
  return res.rows.map(r => r.id);
}

async function indexForTenant(tenantId: string, files: SeedFile[]): Promise<{ ok: number; fail: number }> {
  let ok = 0, fail = 0;
  for (const f of files) {
    const sourceType = DOMAIN_SOURCE_TYPE[f.domain];
    // Stable source_id so re-runs replace previous chunks instead of duplicating.
    const sourceId = `seed/${f.domain}/${f.filename}`;
    try {
      const count = await indexDocument({
        tenantId,
        sourceType,
        sourceId,
        title: f.title,
        content: f.content,
        metadata: { domain: f.domain, source: 'seed_script', filename: f.filename },
      });
      ok++;
      console.log(`  ✓ [${f.domain}] ${f.filename} → ${count} chunk(s)`);
    } catch (err: any) {
      fail++;
      console.error(`  ✗ [${f.domain}] ${f.filename} — ${err?.message || err}`);
    }
  }
  return { ok, fail };
}

async function main() {
  const tenantArg = process.argv[2];
  console.log('[seed-knowledge] Reading seed files…');

  const allFiles: SeedFile[] = [];
  for (const d of DOMAINS) {
    const files = await readDomain(d);
    allFiles.push(...files);
  }
  if (allFiles.length === 0) {
    console.error('[seed-knowledge] No seed files found under seed/knowledge/. Aborting.');
    process.exit(1);
  }
  console.log(`[seed-knowledge] Found ${allFiles.length} file(s) across ${DOMAINS.length} domain(s).`);

  const tenants = tenantArg ? [tenantArg] : await listAllTenants();
  if (tenants.length === 0) {
    console.error('[seed-knowledge] No tenants found in DB.');
    process.exit(1);
  }
  console.log(`[seed-knowledge] Indexing for ${tenants.length} tenant(s).`);

  let totalOk = 0, totalFail = 0;
  for (const tenantId of tenants) {
    console.log(`\n[seed-knowledge] tenant=${tenantId.slice(0, 8)}…`);
    const { ok, fail } = await indexForTenant(tenantId, allFiles);
    totalOk += ok;
    totalFail += fail;
  }

  console.log(`\n[seed-knowledge] Done. ${totalOk} indexed, ${totalFail} failed.`);
  await pool.end();
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[seed-knowledge] FATAL:', err);
  process.exit(1);
});
