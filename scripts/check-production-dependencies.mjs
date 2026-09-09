import { spawn } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(
  process.env.PRODUCTION_DEPENDENCY_SOURCE_ROOT ?? projectRoot,
);
const productionCheckParent = resolve(
  process.env.PRODUCTION_DEPENDENCY_TEMP_PARENT ?? tmpdir(),
);
const productionCheckRoot = await mkdtemp(
  join(productionCheckParent, 'sgs-production-dependencies-'),
);
const bundlePath = join(sourceRoot, 'server.js');

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      ...options,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';

    if (options.capture) {
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.on('data', chunk => { stderr += chunk; });
    }

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill('SIGTERM');
          rejectRun(new Error(`${command} ${args.join(' ')} timed out after ${options.timeoutMs}ms`));
        }, options.timeoutMs)
      : null;

    child.once('error', error => {
      if (timeout) clearTimeout(timeout);
      rejectRun(error);
    });
    child.once('exit', (code, signal) => {
      if (timeout) clearTimeout(timeout);
      resolveRun({ code, signal, stdout, stderr });
    });
  });
}

try {
  await Promise.all([
    cp(join(projectRoot, 'package.json'), join(productionCheckRoot, 'package.json')),
    cp(join(projectRoot, 'package-lock.json'), join(productionCheckRoot, 'package-lock.json')),
    cp(bundlePath, join(productionCheckRoot, 'server.js')),
  ]);

  console.log('Installing the production-only dependency set in a temporary directory...');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const install = await run(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: productionCheckRoot,
  });
  if (install.code !== 0) {
    throw new Error(`npm ci --omit=dev failed with exit code ${install.code ?? 'unknown'}`);
  }

  console.log('Importing the bundled backend with only production dependencies...');
  const importResult = await run(
    process.execPath,
    ['--input-type=module', '-e', "await import('./server.js'); process.exit(0)"],
    {
      cwd: productionCheckRoot,
      capture: true,
      timeoutMs: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PRODUCTION_DEPENDENCY_CHECK: '1',
      },
    },
  );

  if (importResult.code !== 0) {
    const output = [importResult.stdout, importResult.stderr].filter(Boolean).join('\n').trim();
    throw new Error(
      `Bundled backend import failed with exit code ${importResult.code ?? `signal ${importResult.signal}`}.` +
      (output ? `\n${output}` : ''),
    );
  }

  console.log('Production dependency check passed.');
} finally {
  await rm(productionCheckRoot, { recursive: true, force: true });
}