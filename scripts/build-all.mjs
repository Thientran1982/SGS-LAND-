#!/usr/bin/env node
/**
 * Build hop nhat: Vite SPA (+ Express bundle) va Next.js trong CUNG 1 lan chay.
 *
 * Ly do ton tai: truoc day `npm run build` o root chi build Vite + esbuild
 * server.ts, con Next.js phai build rieng trong apps/nextjs. Hai lan build o
 * hai thoi diem khac nhau => dist/ va .next/ lech version, widget cu goi API
 * moi (hoac nguoc lai). Script nay dong 1 BUILD_ID cho ca hai va ghi
 * build-info.json vao public/ cua ca hai app de kiem tra ngoai production.
 *
 * Dung: node scripts/build-all.mjs [--dry-run]
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry-run');
const ROOT = process.cwd();
const NEXT_DIR = join(ROOT, 'apps', 'nextjs');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'nogit';
  }
}

const BUILD_ID = `${new Date().toISOString().replace(/[:.]/g, '-')}.${gitSha()}`;

function stamp(dir) {
  const target = join(dir, 'build-info.json');
  const payload = JSON.stringify(
    { buildId: BUILD_ID, builtAt: new Date().toISOString(), backendUrl: BACKEND_URL },
    null,
    2,
  );
  if (DRY) return console.log(`[dry-run] stamp ${target}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(target, payload + '\n', 'utf8');
  console.log(`stamped ${target}`);
}

function run(cmd, cwd, extraEnv = {}) {
  console.log(`\n>>> ${cmd}   (cwd=${cwd})`);
  if (DRY) return console.log('[dry-run] skipped');
  execSync(cmd, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv, BUILD_ID, NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  });
}

console.log(`SGS LAND unified build - BUILD_ID=${BUILD_ID}${DRY ? ' (dry-run)' : ''}`);

// 1. Version stamp truoc, de ca 2 bundle nhung cung 1 BUILD_ID.
stamp(join(ROOT, 'public'));
stamp(join(NEXT_DIR, 'public'));

// 2. Vite SPA + esbuild server bundle.
// Typecheck package dung chung TRUOC: widget chat nay duoc ca Next lan Vite import,
// neu no hong thi ca 2 bundle deu hong -> fail som cho re.
run('npx tsc --noEmit -p packages/chat-widget/tsconfig.json', ROOT);

run('npm run build', ROOT);

// 3. Next.js site (can BACKEND_URL cho rewrites trong next.config.ts).
run('npm install', NEXT_DIR);
run('npm run build', NEXT_DIR, { BACKEND_URL });

console.log(`\nDone. BUILD_ID=${BUILD_ID}`);
console.log('Kiem tra sau khi deploy: /build-info.json va /_next/... phai cung buildId.');
