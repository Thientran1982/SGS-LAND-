import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.cache', '.replit', 'playwright-report', 'test-results', 'screenshots', 'reports', 'artifacts', 'archive', 'attached_assets', 'certs', 'public'].includes(entry.name)) continue;
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * P2-1 boundary: the legacy in-house graph engine (server/ai/stateGraph.ts)
 * must only be consumed by the legacy server/ai.ts path (and its own tests).
 * New orchestration belongs to the LangGraph adapter behind orchestrationMode.
 * Retirement plan: docs/graph-engine-consolidation.md
 */
describe('architecture boundaries — graph engines (P2-1)', () => {
  it('stateGraph is imported only by server/ai.ts and its own tests', () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(repoRoot)) {
      const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
      if (rel === 'server/ai/stateGraph.ts') continue;
      const src = fs.readFileSync(file, 'utf8');
      const importsLegacyEngine = /from ['"]\.\.?\/(?:ai\/)?stateGraph['"]/.test(src)
        || /from ['"]\.\/stateGraph['"]/.test(src);
      if (!importsLegacyEngine) continue;
      if (rel.startsWith('server/test/')) continue;
      if (rel !== 'server/ai.ts') offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
